import { describe, it, expect } from "vitest";
import { parseZerodhaTradebook, inferInstrumentType, parseCsv } from "./zerodha";

const HEADER =
  "symbol,isin,trade_date,exchange,segment,series,trade_type,auction,quantity,price,trade_id,order_id,order_execution_time";

describe("parseCsv", () => {
  it("handles quoted fields and CRLF", () => {
    const rows = parseCsv('a,b,c\r\n"x,y","z""q",1\r\n');
    expect(rows).toEqual([
      ["a", "b", "c"],
      ["x,y", 'z"q', "1"],
    ]);
  });
});

describe("inferInstrumentType", () => {
  it("classifies EQ/FO suffixes", () => {
    expect(inferInstrumentType("RELIANCE", "EQ")).toBe("equity");
    expect(inferInstrumentType("NIFTY25NOV24000CE", "FO")).toBe("options");
    expect(inferInstrumentType("NIFTY25NOV24000PE", "FO")).toBe("options");
    expect(inferInstrumentType("NIFTY25NOVFUT", "FO")).toBe("futures");
    expect(inferInstrumentType("ABC", "CDS")).toBeNull();
    expect(inferInstrumentType("WEIRD", "FO")).toBeNull();
  });
});

describe("parseZerodhaTradebook", () => {
  it("parses a simple buy/sell pair", () => {
    const csv =
      HEADER +
      "\nRELIANCE,IN123,2025-10-01,NSE,EQ,EQ,buy,,10,100.5,T1,O1,2025-10-01T09:30:00" +
      "\nRELIANCE,IN123,2025-10-01,NSE,EQ,EQ,sell,,10,110.0,T2,O2,2025-10-01T10:30:00\n";
    const res = parseZerodhaTradebook(csv);
    expect(res.fills.length).toBe(2);
    expect(res.fills[0].instrumentType).toBe("equity");
    expect(res.fills[0].symbol).toBe("RELIANCE");
    expect(res.fills[0].entryTimeHHMMSS).toBe("09:30:00");
    expect(res.warnings).toEqual([]);
    expect(res.rowsParsed).toBe(2);
    expect(res.rowsSkipped).toBe(0);
  });

  it("flags unsupported segment (currency/commodity) and skips row", () => {
    const csv =
      HEADER +
      "\nUSDINR,xx,2025-10-01,CDS,CDS,XX,buy,,1,82.5,T1,O1,2025-10-01T09:30:00\n";
    const res = parseZerodhaTradebook(csv);
    expect(res.fills.length).toBe(0);
    expect(res.warnings[0].code).toBe("unsupported_segment");
    expect(res.rowsSkipped).toBe(1);
  });

  it("rejects non-positive qty/price", () => {
    const csv =
      HEADER +
      "\nABC,xx,2025-10-01,NSE,EQ,EQ,buy,,0,100,T1,O1,2025-10-01T09:30:00" +
      "\nABC,xx,2025-10-01,NSE,EQ,EQ,buy,,5,0,T2,O2,2025-10-01T09:30:01\n";
    const res = parseZerodhaTradebook(csv);
    expect(res.fills.length).toBe(0);
    expect(res.warnings.filter((w) => w.code === "bad_row").length).toBe(2);
  });

  it("flags symbol too long", () => {
    const long = "A".repeat(41);
    const csv =
      HEADER +
      `\n${long},xx,2025-10-01,NSE,EQ,EQ,buy,,1,100,T1,O1,2025-10-01T09:30:00\n`;
    const res = parseZerodhaTradebook(csv);
    expect(res.warnings[0].code).toBe("symbol_too_long");
  });

  it("parses F&O with expiry_date column", () => {
    const header = HEADER + ",expiry_date";
    const csv =
      header +
      "\nNIFTY25NOVFUT,xx,2025-11-01,NFO,FO,XX,buy,,50,24000,T1,O1,2025-11-01T09:30:00,2025-11-27\n";
    const res = parseZerodhaTradebook(csv);
    expect(res.fills[0].instrumentType).toBe("futures");
    expect(res.fills[0].expiryDate).toBe("2025-11-27");
  });

  it("normalizes DD-MM-YYYY trade_date and order_execution_time to ISO", () => {
    const csv =
      HEADER +
      "\n3MINDIA,IN1,26-11-2025,NSE,EQ,EQ,buy,,2,100,T1,O1,26-11-2025T15:24:31" +
      "\n3MINDIA,IN1,27-11-2025,NSE,EQ,EQ,sell,,2,110,T2,O2,27-11-2025T10:00:00\n";
    const res = parseZerodhaTradebook(csv);
    expect(res.warnings).toEqual([]);
    expect(res.fills).toHaveLength(2);
    expect(res.fills[0].tradeDate).toBe("2025-11-26");
    expect(res.fills[0].entryTimeHHMMSS).toBe("15:24:31");
    expect(res.fills[1].tradeDate).toBe("2025-11-27");
    expect(res.fills[0].executedAt.getTime()).toBeLessThan(
      res.fills[1].executedAt.getTime(),
    );
  });

  it("normalizes DD-MM-YYYY expiry_date", () => {
    const header = HEADER + ",expiry_date";
    const csv =
      header +
      "\nNIFTY25NOVFUT,xx,01-11-2025,NFO,FO,XX,buy,,50,24000,T1,O1,01-11-2025T09:30:00,27-11-2025\n";
    const res = parseZerodhaTradebook(csv);
    expect(res.fills[0].expiryDate).toBe("2025-11-27");
    expect(res.fills[0].tradeDate).toBe("2025-11-01");
  });

  it("handles mixed ISO and DD-MM-YYYY rows and orders chronologically", () => {
    const csv =
      HEADER +
      "\nFOO,xx,27-11-2025,NSE,EQ,EQ,sell,,1,110,T2,O2,27-11-2025T10:00:00" +
      "\nFOO,xx,2025-11-26,NSE,EQ,EQ,buy,,1,100,T1,O1,2025-11-26T09:00:00\n";
    const res = parseZerodhaTradebook(csv);
    expect(res.warnings).toEqual([]);
    const sorted = [...res.fills].sort(
      (a, b) => a.executedAt.getTime() - b.executedAt.getTime(),
    );
    expect(sorted[0].tradeDate).toBe("2025-11-26");
    expect(sorted[1].tradeDate).toBe("2025-11-27");
  });

  it("rejects garbage dates as bad_row", () => {
    const csv =
      HEADER +
      "\nABC,xx,2025/13/40,NSE,EQ,EQ,buy,,1,100,T1,O1,2025/13/40T09:30:00\n";
    const res = parseZerodhaTradebook(csv);
    expect(res.fills).toHaveLength(0);
    expect(res.warnings.some((w) => w.code === "bad_row")).toBe(true);
  });

  it("suffixes non-EQ equity series so AXISBANK-BL stays distinct from AXISBANK", () => {
    const csv =
      HEADER +
      "\nAXISBANK,IN,2025-10-01,NSE,EQ,EQ,buy,,1,1000,T1,O1,2025-10-01T09:30:00" +
      "\nAXISBANK,IN,2025-10-02,NSE,EQ,BL,buy,,1,1050,T2,O2,2025-10-02T09:30:00" +
      "\nIDFCFIRSTB,IN,2025-10-03,NSE,EQ,BE,buy,,1,80,T3,O3,2025-10-03T09:30:00\n";
    const res = parseZerodhaTradebook(csv);
    expect(res.fills.map((f) => f.symbol)).toEqual([
      "AXISBANK",
      "AXISBANK-BL",
      "IDFCFIRSTB-BE",
    ]);
  });
});

