import { describe, it, expect } from "vitest";
import { reconstructFromFills } from "@/lib/import";
import type { Fill } from "@/lib/import/types";

function f(overrides: Partial<Fill>): Fill {
  return {
    symbol: "INFY",
    segment: "EQ",
    expiry_date: null,
    isin: "IN0001",
    exchange: "NSE",
    trade_date: "2025-01-02",
    trade_type: "buy",
    quantity: 10,
    price: 100,
    trade_id: "t",
    order_id: "o",
    order_execution_time: "2025-01-02T09:00:00",
    ...overrides,
  };
}

describe("reconstructFromFills", () => {
  it("reconstructs a mixed EQ + FO fill set in one call", () => {
    const fills: Fill[] = [
      // Equity round-trip
      f({ trade_id: "e1", order_id: "eo1", side: undefined as never, trade_type: "buy", quantity: 10, price: 100 }),
      f({
        trade_id: "e2",
        order_id: "eo2",
        trade_type: "sell",
        quantity: 10,
        price: 120,
        order_execution_time: "2025-01-02T14:00:00",
      }),
      // F&O sell-to-open, then buy-to-cover
      f({
        symbol: "NIFTY25JANFUT",
        segment: "FO",
        expiry_date: "2025-01-30",
        isin: null,
        trade_id: "f1",
        order_id: "fo1",
        trade_type: "sell",
        quantity: 50,
        price: 22000,
        order_execution_time: "2025-01-03T09:15:00",
      }),
      f({
        symbol: "NIFTY25JANFUT",
        segment: "FO",
        expiry_date: "2025-01-30",
        isin: null,
        trade_id: "f2",
        order_id: "fo2",
        trade_type: "buy",
        quantity: 50,
        price: 21900,
        order_execution_time: "2025-01-03T15:00:00",
      }),
    ];
    const { trades, orphans } = reconstructFromFills(fills);
    expect(orphans).toHaveLength(0);
    expect(trades).toHaveLength(2);
    const eq = trades.find((t) => t.instrument_type === "equity")!;
    const fo = trades.find((t) => t.instrument_type !== "equity")!;
    expect(eq.side).toBe("long");
    expect(eq.gross_pnl).toBeCloseTo(200);
    // FO sell-to-open reconstructs as a short round-trip.
    expect(fo.side).toBe("short");
    expect(fo.gross_pnl).toBeCloseTo((22000 - 21900) * 50);
  });

  it("is idempotent — union of a fill set with itself yields the same book", () => {
    const fills: Fill[] = [
      f({ trade_id: "a1", order_id: "ao1", trade_type: "buy", quantity: 10, price: 100 }),
      f({
        trade_id: "a2",
        order_id: "ao2",
        trade_type: "sell",
        quantity: 10,
        price: 110,
        order_execution_time: "2025-01-02T14:00:00",
      }),
    ];
    // Simulate the merge-dedupe step (segment+trade_id): union with itself
    // must not duplicate rows.
    const key = (x: Fill) => `${x.segment}:${x.trade_id}`;
    const seen = new Set(fills.map(key));
    const merged = [...fills, ...fills.filter((x) => !seen.has(key(x)))];
    expect(merged).toHaveLength(fills.length);
    const a = reconstructFromFills(fills).trades;
    const b = reconstructFromFills(merged).trades;
    expect(b).toEqual(a);
  });

  it("incremental merge: a new closing fill closes an existing open position", () => {
    const opening: Fill[] = [
      f({ trade_id: "x1", order_id: "xo1", trade_type: "buy", quantity: 10, price: 100 }),
    ];
    const first = reconstructFromFills(opening);
    expect(first.trades).toHaveLength(1);
    expect(first.trades[0].kind).toBe("open");

    const newFills: Fill[] = [
      f({
        trade_id: "x2",
        order_id: "xo2",
        trade_type: "sell",
        quantity: 10,
        price: 130,
        order_execution_time: "2025-01-05T14:00:00",
      }),
    ];
    const merged = [...opening, ...newFills];
    const second = reconstructFromFills(merged);
    expect(second.trades).toHaveLength(1);
    expect(second.trades[0].kind).toBe("closed");
    expect(second.trades[0].gross_pnl).toBeCloseTo(300);
  });

  it("incremental merge: a brand-new symbol appears as its own trade", () => {
    const a: Fill[] = [
      f({ trade_id: "a1", order_id: "ao1", trade_type: "buy", quantity: 5, price: 100 }),
      f({
        trade_id: "a2",
        order_id: "ao2",
        trade_type: "sell",
        quantity: 5,
        price: 110,
        order_execution_time: "2025-01-02T14:00:00",
      }),
    ];
    const b: Fill[] = [
      f({
        symbol: "TCS",
        isin: "IN0002",
        trade_id: "b1",
        order_id: "bo1",
        trade_type: "buy",
        quantity: 4,
        price: 3000,
        order_execution_time: "2025-02-01T09:15:00",
      }),
      f({
        symbol: "TCS",
        isin: "IN0002",
        trade_id: "b2",
        order_id: "bo2",
        trade_type: "sell",
        quantity: 4,
        price: 3100,
        order_execution_time: "2025-02-01T14:00:00",
      }),
    ];
    const { trades } = reconstructFromFills([...a, ...b]);
    expect(trades.map((t) => t.symbol).sort()).toEqual(["INFY", "TCS"]);
  });
});
