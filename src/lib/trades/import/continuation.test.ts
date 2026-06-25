import { describe, it, expect } from "vitest";
import { aggregateFills } from "./aggregate";
import type { Fill, SeedPosition } from "./types";

let tid = 0;
const mkFill = (o: Partial<Fill> & Pick<Fill, "side" | "quantity" | "price"> & { time?: string; symbol?: string; orderId?: string }): Fill => {
  tid++;
  const time = o.time ?? `2026-02-01T09:30:${String(tid).padStart(2, "0")}`;
  return {
    symbol: o.symbol ?? "RELIANCE",
    instrumentType: "equity",
    side: o.side,
    quantity: o.quantity,
    price: o.price,
    tradeId: o.tradeId ?? `T${tid}`,
    orderId: o.orderId ?? `O${tid}`,
    executedAt: new Date(time + "Z"),
    tradeDate: time.slice(0, 10),
    entryTimeHHMMSS: time.slice(11, 19),
    exchange: "NSE",
    segment: "EQ",
    series: "EQ",
    expiryDate: null,
  };
};

const seed = (overrides: Partial<SeedPosition> = {}): SeedPosition => ({
  tradeId: "existing-trade-id",
  symbol: "RELIANCE",
  side: "long",
  entryPrice: 100,
  entryQuantity: 10,
  openQuantity: 10,
  earliestEntryAt: new Date("2026-01-15T09:30:00Z"),
  ...overrides,
});

describe("aggregateFills (seeded / continuation)", () => {
  it("closes a seeded long position", () => {
    const fills = [mkFill({ side: "sell", quantity: 10, price: 120 })];
    const { trades, continuations } = aggregateFills(fills, { seedPositions: [seed()] });
    expect(trades).toEqual([]);
    const c = continuations.get("RELIANCE")!;
    expect(c).toBeDefined();
    expect(c.existingTradeId).toBe("existing-trade-id");
    expect(c.newStatus).toBe("closed");
    expect(c.newExits.length).toBe(1);
    expect(c.newExits[0].quantity).toBe(10);
    expect(c.newEntryPrice).toBe(100);
    expect(c.newQuantity).toBe(10);
    expect(c.flipRemainder).toBeUndefined();
  });

  it("partially closes a seeded position", () => {
    const fills = [mkFill({ side: "sell", quantity: 4, price: 115 })];
    const { continuations } = aggregateFills(fills, { seedPositions: [seed()] });
    const c = continuations.get("RELIANCE")!;
    expect(c.newStatus).toBe("partial");
    expect(c.newExits[0].quantity).toBe(4);
  });

  it("adds to a position — entry recomputed with warning", () => {
    const fills = [mkFill({ side: "buy", quantity: 10, price: 120 })];
    const { continuations } = aggregateFills(fills, { seedPositions: [seed()] });
    const c = continuations.get("RELIANCE")!;
    expect(c.newExits).toEqual([]);
    expect(c.newQuantity).toBe(20);
    expect(c.newEntryPrice).toBeCloseTo((10 * 100 + 10 * 120) / 20);
    expect(c.warnings).toContain("added_to_position");
    expect(c.newStatus).toBe("open");
  });

  it("equity over-sell against seed closes the lot and warns (no phantom short)", () => {
    const fills = [mkFill({ side: "sell", quantity: 15, price: 110 })];
    const { continuations, warnings } = aggregateFills(fills, {
      seedPositions: [seed()],
    });
    const c = continuations.get("RELIANCE")!;
    expect(c.newStatus).toBe("closed");
    expect(c.newExits[0].quantity).toBe(10);
    expect(c.newExits[0].entryPrice).toBe(100);
    // Equity cannot flip into a short — over-sell remainder is dropped.
    expect(c.flipRemainder).toBeUndefined();
    expect(warnings.some((w) => w.code === "position_flip")).toBe(true);
  });


  it("out_of_order_fill is dropped and warned", () => {
    const fills = [
      mkFill({ side: "sell", quantity: 5, price: 120, time: "2026-01-10T09:30:00" }),
      mkFill({ side: "sell", quantity: 5, price: 121, time: "2026-02-01T09:30:00" }),
    ];
    const { continuations, warnings } = aggregateFills(fills, { seedPositions: [seed()] });
    const c = continuations.get("RELIANCE")!;
    // only the in-order fill is applied
    expect(c.newExits.length).toBe(1);
    expect(c.newExits[0].quantity).toBe(5);
    expect(c.newStatus).toBe("partial");
    expect(warnings.some((w) => w.code === "out_of_order_fill")).toBe(true);
    expect(c.warnings).toContain("out_of_order_fill");
  });

  it("short seed: covering buys close it", () => {
    const fills = [mkFill({ side: "buy", quantity: 8, price: 90 })];
    const { continuations } = aggregateFills(fills, {
      seedPositions: [seed({ side: "short", entryPrice: 100, entryQuantity: 8, openQuantity: 8 })],
    });
    const c = continuations.get("RELIANCE")!;
    expect(c.newStatus).toBe("closed");
    expect(c.newExits[0].quantity).toBe(8);
  });

  it("status accounts for previously-exited qty in PARTIAL seed", () => {
    // seed: 10 entered, 4 already exited (open 6). New: sell 6 → fully closed.
    const fills = [mkFill({ side: "sell", quantity: 6, price: 120 })];
    const { continuations } = aggregateFills(fills, {
      seedPositions: [seed({ entryQuantity: 10, openQuantity: 6 })],
    });
    const c = continuations.get("RELIANCE")!;
    expect(c.newStatus).toBe("closed");
  });

  it("symbols without seed still produce fresh trades", () => {
    const fills = [
      mkFill({ symbol: "INFY", side: "buy", quantity: 5, price: 1500 }),
      mkFill({ symbol: "INFY", side: "sell", quantity: 5, price: 1550 }),
    ];
    const { trades, continuations } = aggregateFills(fills, {
      seedPositions: [seed({ symbol: "RELIANCE" })],
    });
    expect(continuations.size).toBe(0);
    expect(trades.length).toBe(1);
    expect(trades[0].symbol).toBe("INFY");
  });
});
