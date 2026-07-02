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

describe("parse + variant detection", () => {
  it("parses equity tradebook", () => {
    const parsed = parseCsv(EQ_CSV);
    expect(detectVariant(parsed.headers)).toBe("equity");
    const { fills } = rowsToFills(parsed);
    expect(fills).toHaveLength(2);
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
});
