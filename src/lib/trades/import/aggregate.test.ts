import { describe, it, expect } from "vitest";
import { aggregateFills } from "./aggregate";
import { importZerodhaTradebook } from "./index";
import type { Fill } from "./types";

let tidCounter = 0;
const mkFill = (
  overrides: Partial<Fill> & Pick<Fill, "side" | "quantity" | "price"> & { time?: string; symbol?: string; orderId?: string },
): Fill => {
  tidCounter++;
  const time = overrides.time ?? `2025-10-01T09:30:${String(tidCounter).padStart(2, "0")}`;
  return {
    symbol: overrides.symbol ?? "RELIANCE",
    instrumentType: "equity",
    side: overrides.side,
    quantity: overrides.quantity,
    price: overrides.price,
    tradeId: overrides.tradeId ?? `T${tidCounter}`,
    orderId: overrides.orderId ?? `O${tidCounter}`,
    executedAt: new Date(time + "Z"),
    tradeDate: time.slice(0, 10),
    entryTimeHHMMSS: time.slice(11, 19),
    exchange: "NSE",
    segment: "EQ",
    series: "EQ",
    expiryDate: null,
  };
};

describe("aggregateFills", () => {
  it("simple long round-trip", () => {
    const fills = [
      mkFill({ side: "buy", quantity: 10, price: 100 }),
      mkFill({ side: "sell", quantity: 10, price: 110 }),
    ];
    const { trades, warnings } = aggregateFills(fills);
    expect(warnings).toEqual([]);
    expect(trades.length).toBe(1);
    expect(trades[0].side).toBe("long");
    expect(trades[0].status).toBe("closed");
    expect(trades[0].entry_price).toBe(100);
    expect(trades[0].quantity).toBe(10);
    expect(trades[0].exits.length).toBe(1);
    expect(trades[0].exits[0].exit_price).toBe(110);
    expect(trades[0].source).toBe("csv_import");
  });

  it("simple short round-trip", () => {
    const fills = [
      mkFill({ side: "sell", quantity: 5, price: 200 }),
      mkFill({ side: "buy", quantity: 5, price: 190 }),
    ];
    const { trades } = aggregateFills(fills);
    expect(trades[0].side).toBe("short");
    expect(trades[0].status).toBe("closed");
  });

  it("multiple fills of same order aggregated into one exit", () => {
    const fills = [
      mkFill({ side: "buy", quantity: 10, price: 100, orderId: "O-IN" }),
      mkFill({ side: "sell", quantity: 4, price: 110, orderId: "O-OUT" }),
      mkFill({ side: "sell", quantity: 6, price: 120, orderId: "O-OUT" }),
    ];
    const { trades } = aggregateFills(fills);
    expect(trades.length).toBe(1);
    expect(trades[0].exits.length).toBe(1);
    expect(trades[0].exits[0].quantity).toBe(10);
    expect(trades[0].exits[0].exit_price).toBeCloseTo((4 * 110 + 6 * 120) / 10);
  });

  it("weighted entry across multiple entry fills", () => {
    const fills = [
      mkFill({ side: "buy", quantity: 4, price: 100, orderId: "O1" }),
      mkFill({ side: "buy", quantity: 6, price: 110, orderId: "O2" }),
      mkFill({ side: "sell", quantity: 10, price: 120, orderId: "O3" }),
    ];
    const { trades } = aggregateFills(fills);
    expect(trades[0].entry_price).toBeCloseTo((4 * 100 + 6 * 110) / 10);
    expect(trades[0].quantity).toBe(10);
  });

  it("partial exits with multiple distinct sell orders", () => {
    const fills = [
      mkFill({ side: "buy", quantity: 10, price: 100 }),
      mkFill({ side: "sell", quantity: 3, price: 105, orderId: "OA" }),
      mkFill({ side: "sell", quantity: 7, price: 115, orderId: "OB" }),
    ];
    const { trades } = aggregateFills(fills);
    expect(trades.length).toBe(1);
    expect(trades[0].status).toBe("closed");
    expect(trades[0].exits.length).toBe(2);
  });

  it("open position warning when never closed", () => {
    const fills = [
      mkFill({ side: "buy", quantity: 5, price: 100, time: "2025-10-01T09:30:00" }),
      mkFill({ side: "buy", quantity: 5, price: 110, time: "2025-10-02T09:30:00" }),
    ];
    const { trades, warnings } = aggregateFills(fills);
    expect(trades.length).toBe(1);
    expect(trades[0].status).toBe("open");
    expect(trades[0].exits).toEqual([]);
    expect(warnings.some((w) => w.code === "open_position")).toBe(true);
  });

  it("flip through zero produces two trades + warning", () => {
    const fills = [
      mkFill({ side: "buy", quantity: 10, price: 100 }),
      mkFill({ side: "sell", quantity: 15, price: 110 }),
      mkFill({ side: "buy", quantity: 5, price: 105 }),
    ];
    const { trades, warnings } = aggregateFills(fills);
    expect(trades.length).toBe(2);
    expect(trades[0].side).toBe("long");
    expect(trades[0].status).toBe("closed");
    expect(trades[0].quantity).toBe(10);
    expect(trades[0].exits[0].quantity).toBe(10);
    expect(trades[1].side).toBe("short");
    expect(trades[1].status).toBe("closed");
    expect(trades[1].quantity).toBe(5);
    expect(warnings.some((w) => w.code === "position_flip")).toBe(true);
  });

  it("is deterministic regardless of input order", () => {
    const base = [
      mkFill({ side: "buy", quantity: 4, price: 100, orderId: "O1", time: "2025-10-01T09:00:00" }),
      mkFill({ side: "buy", quantity: 6, price: 110, orderId: "O2", time: "2025-10-01T09:01:00" }),
      mkFill({ side: "sell", quantity: 10, price: 120, orderId: "O3", time: "2025-10-01T10:00:00" }),
    ];
    const shuffled = [base[2], base[0], base[1]];
    const a = aggregateFills(base);
    const b = aggregateFills(shuffled);
    expect(JSON.stringify(a.trades)).toBe(JSON.stringify(b.trades));
  });
});

describe("importZerodhaTradebook end-to-end", () => {
  it("integrates parse + aggregate with stats", () => {
    const csv =
      "symbol,isin,trade_date,exchange,segment,series,trade_type,auction,quantity,price,trade_id,order_id,order_execution_time\n" +
      "RELIANCE,IN,2025-10-01,NSE,EQ,EQ,buy,,10,100,T1,O1,2025-10-01T09:30:00\n" +
      "RELIANCE,IN,2025-10-01,NSE,EQ,EQ,sell,,10,110,T2,O2,2025-10-01T10:30:00\n" +
      "TCS,IN,2025-10-01,NSE,EQ,EQ,buy,,5,3000,T3,O3,2025-10-01T11:30:00\n";
    const res = importZerodhaTradebook(csv);
    expect(res.stats.rowsParsed).toBe(3);
    expect(res.stats.tradesClosed).toBe(1);
    expect(res.stats.tradesOpen).toBe(1);
    expect(res.stats.symbols).toBe(2);
    expect(res.warnings.some((w) => w.code === "open_position")).toBe(true);
  });
});
