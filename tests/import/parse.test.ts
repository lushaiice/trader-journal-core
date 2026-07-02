import { describe, it, expect } from "vitest";
import { parseCsv } from "@/lib/import/parse-csv";
import { detectVariant, rowsToFills } from "@/lib/import/tradebook-schema";

const EQ_CSV = `symbol,isin,trade_date,exchange,segment,series,trade_type,auction,quantity,price,trade_id,order_id,order_execution_time
INFY,INE009A01021,2025-01-02,NSE,EQ,EQ,buy,false,10,1800.5,T1,O1,2025-01-02T09:30:00
INFY,INE009A01021,2025-01-02,NSE,EQ,EQ,sell,false,10,1820,T2,O2,2025-01-02T14:00:00
`;

const FO_CSV = `symbol,trade_date,exchange,segment,series,trade_type,auction,quantity,price,trade_id,order_id,order_execution_time,expiry_date
NIFTY2591624450PE,2025-09-15,NFO,FO,OPT,sell,false,75,120,T1,O1,2025-09-15T09:20:00,2025-09-16
NIFTY2591624450PE,2025-09-16,NFO,FO,OPT,buy,false,75,80,T2,O2,2025-09-16T10:15:00,2025-09-16
`;

// Last row truncated mid-line (simulates interrupted download).
const EQ_CSV_TRUNCATED = `symbol,isin,trade_date,exchange,segment,series,trade_type,auction,quantity,price,trade_id,order_id,order_execution_time
INFY,INE009A01021,2025-01-02,NSE,EQ,EQ,buy,false,10,1800.5,T1,O1,2025-01-02T09:30:00
INFY,INE009A01021,2025-01-02,NSE,EQ,EQ,sell,false,10,1820,T2,O2,2025-01-02T14:00:00
INFY,INE009A01021,2025-01-03,NSE,EQ,EQ,buy`;

// One row is semantically invalid (bad side / negative quantity).
const EQ_CSV_INVALID_ROW = `symbol,isin,trade_date,exchange,segment,series,trade_type,auction,quantity,price,trade_id,order_id,order_execution_time
INFY,INE009A01021,2025-01-02,NSE,EQ,EQ,buy,false,10,1800.5,T1,O1,2025-01-02T09:30:00
INFY,INE009A01021,2025-01-02,NSE,EQ,EQ,wat,false,10,1820,T2,O2,2025-01-02T14:00:00
`;

// Headers-only file — no data rows at all.
const HEADER_ONLY = `symbol,isin,trade_date,exchange,segment,series,trade_type,auction,quantity,price,trade_id,order_id,order_execution_time
`;

describe("parse + variant detection", () => {
  it("parses equity tradebook", () => {
    const parsed = parseCsv(EQ_CSV);
    expect(detectVariant(parsed.headers)).toBe("equity");
    const { fills, skippedRows } = rowsToFills(parsed);
    expect(fills).toHaveLength(2);
    expect(skippedRows).toHaveLength(0);
    expect(fills[0].symbol).toBe("INFY");
    expect(fills[0].segment).toBe("EQ");
    expect(fills[0].expiry_date).toBeNull();
  });

  it("parses F&O tradebook and keeps expiry", () => {
    const parsed = parseCsv(FO_CSV);
    expect(detectVariant(parsed.headers)).toBe("fo");
    const { fills } = rowsToFills(parsed);
    expect(fills[0].expiry_date).toBe("2025-09-16");
    expect(fills[0].segment).toBe("FO");
  });

  it("rejects a CSV with missing columns", () => {
    expect(() => detectVariant(["symbol", "quantity"])).toThrow(/Missing columns/);
  });

  it("skips a truncated final row but keeps the good rows", () => {
    const parsed = parseCsv(EQ_CSV_TRUNCATED);
    const { fills, skippedRows } = rowsToFills(parsed);
    expect(fills).toHaveLength(2);
    expect(skippedRows.length).toBeGreaterThanOrEqual(1);
    // The truncated line is row 4 (1-based including header).
    expect(skippedRows.some((s) => s.rowNumber === 4)).toBe(true);
  });

  it("skips a semantically invalid row and reports it, keeping good rows", () => {
    const parsed = parseCsv(EQ_CSV_INVALID_ROW);
    const { fills, skippedRows } = rowsToFills(parsed);
    expect(fills).toHaveLength(1);
    expect(skippedRows).toHaveLength(1);
    expect(skippedRows[0].rowNumber).toBe(3);
  });

  it("throws when there are no valid rows at all", () => {
    const parsed = parseCsv(HEADER_ONLY);
    expect(() => rowsToFills(parsed)).toThrow(/No valid trade rows/);
  });
});
