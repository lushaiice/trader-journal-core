import { describe, it, expect } from "vitest";
import { reconstructPositions } from "@/lib/import/reconstruct";
import type { Order } from "@/lib/import/types";

function o(overrides: Partial<Order>): Order {
  return {
    order_id: "o",
    symbol: "INFY",
    segment: "EQ",
    expiry_date: null,
    side: "buy",
    quantity: 10,
    avg_price: 100,
    execution_time: "2025-01-02T09:00:00",
    source_fill_ids: ["EQ:t"],
    ...overrides,
  };
}

describe("reconstructPositions", () => {
  it("closes a simple long round-trip", () => {
    const { trades, orphans } = reconstructPositions(
      [
        o({
          order_id: "o1",
          side: "buy",
          quantity: 10,
          avg_price: 100,
          execution_time: "2025-01-02T09:00:00",
          source_fill_ids: ["EQ:t1"],
        }),
        o({
          order_id: "o2",
          side: "sell",
          quantity: 10,
          avg_price: 120,
          execution_time: "2025-01-02T14:00:00",
          source_fill_ids: ["EQ:t2"],
        }),
      ],
      false,
    );
    expect(orphans).toHaveLength(0);
    expect(trades).toHaveLength(1);
    expect(trades[0].kind).toBe("closed");
    expect(trades[0].side).toBe("long");
    expect(trades[0].gross_pnl).toBeCloseTo(200);
    expect(trades[0].source_fill_ids.sort()).toEqual(["EQ:t1", "EQ:t2"]);
  });

  it("handles short-to-open options: sell then buy → closed short", () => {
    const { trades } = reconstructPositions(
      [
        o({
          order_id: "o1",
          side: "sell",
          symbol: "NIFTY24450PE",
          segment: "FO",
          expiry_date: "2025-09-16",
          quantity: 75,
          avg_price: 120,
          execution_time: "2025-09-15T09:20:00",
          source_fill_ids: ["FO:t1"],
        }),
        o({
          order_id: "o2",
          side: "buy",
          symbol: "NIFTY24450PE",
          segment: "FO",
          expiry_date: "2025-09-16",
          quantity: 75,
          avg_price: 80,
          execution_time: "2025-09-16T10:15:00",
          source_fill_ids: ["FO:t2"],
        }),
      ],
      true,
    );
    expect(trades).toHaveLength(1);
    expect(trades[0].side).toBe("short");
    expect(trades[0].instrument_type).toBe("options");
    expect(trades[0].entry_price).toBe(120);
    expect(trades[0].gross_pnl).toBeCloseTo((120 - 80) * 75);
  });

  it("scale-in then partial reduce → one open trade with average-cost entry", () => {
    const { trades, orphans } = reconstructPositions(
      [
        o({
          order_id: "b1",
          side: "buy",
          quantity: 100,
          avg_price: 100,
          execution_time: "2025-01-02T09:00:00",
          source_fill_ids: ["EQ:b1"],
        }),
        o({
          order_id: "b2",
          side: "buy",
          quantity: 100,
          avg_price: 105,
          execution_time: "2025-01-02T10:00:00",
          source_fill_ids: ["EQ:b2"],
        }),
        o({
          order_id: "s1",
          side: "sell",
          quantity: 150,
          avg_price: 120,
          execution_time: "2025-01-02T14:00:00",
          source_fill_ids: ["EQ:s1"],
        }),
      ],
      false,
    );
    // Net position accounting: single averaged position, one exit for 150.
    // Residual open qty = max(0, 200 - 150) = 50.
    expect(orphans).toHaveLength(0);
    expect(trades).toHaveLength(1);
    const t = trades[0];
    expect(t.kind).toBe("open");
    expect(t.side).toBe("long");
    expect(t.quantity).toBe(200);
    expect(t.entry_price).toBeCloseTo(102.5);
    expect(t.exits).toHaveLength(1);
    expect(t.exits[0].quantity).toBe(150);
    expect(t.source_fill_ids.sort()).toEqual(["EQ:b1", "EQ:b2", "EQ:s1"]);
  });

  it("emits an orphan when only a closing fill exists", () => {
    const { trades, orphans } = reconstructPositions(
      [
        o({
          order_id: "s1",
          side: "sell",
          quantity: 25,
          avg_price: 500,
          execution_time: "2025-01-02T10:00:00",
          source_fill_ids: ["EQ:s1"],
        }),
      ],
      false,
    );
    expect(trades).toHaveLength(0);
    expect(orphans).toHaveLength(1);
    expect(orphans[0].quantity).toBe(25);
    expect(orphans[0].side).toBe("sell");
  });

  it("treats re-entries after flat as separate trades", () => {
    const { trades } = reconstructPositions(
      [
        o({
          order_id: "b1",
          side: "buy",
          quantity: 10,
          avg_price: 100,
          execution_time: "2025-01-02T09:00:00",
          source_fill_ids: ["EQ:1"],
        }),
        o({
          order_id: "s1",
          side: "sell",
          quantity: 10,
          avg_price: 110,
          execution_time: "2025-01-02T10:00:00",
          source_fill_ids: ["EQ:2"],
        }),
        o({
          order_id: "b2",
          side: "buy",
          quantity: 10,
          avg_price: 105,
          execution_time: "2025-01-02T11:00:00",
          source_fill_ids: ["EQ:3"],
        }),
        o({
          order_id: "s2",
          side: "sell",
          quantity: 10,
          avg_price: 108,
          execution_time: "2025-01-02T12:00:00",
          source_fill_ids: ["EQ:4"],
        }),
      ],
      false,
    );
    expect(trades).toHaveLength(2);
    expect(trades.every((t) => t.kind === "closed")).toBe(true);
    expect(trades[0].gross_pnl + trades[1].gross_pnl).toBeCloseTo(130);
  });

  it("scale-in across many buys then sell all → single closed trade at average cost", () => {
    const { trades, orphans } = reconstructPositions(
      [
        o({ order_id: "b1", side: "buy", quantity: 10, avg_price: 100, execution_time: "2025-01-02T09:00:00", source_fill_ids: ["EQ:b1"] }),
        o({ order_id: "b2", side: "buy", quantity: 20, avg_price: 110, execution_time: "2025-01-02T09:30:00", source_fill_ids: ["EQ:b2"] }),
        o({ order_id: "b3", side: "buy", quantity: 20, avg_price: 120, execution_time: "2025-01-02T10:00:00", source_fill_ids: ["EQ:b3"] }),
        o({ order_id: "s1", side: "sell", quantity: 50, avg_price: 130, execution_time: "2025-01-02T14:00:00", source_fill_ids: ["EQ:s1"] }),
      ],
      false,
    );
    expect(orphans).toHaveLength(0);
    expect(trades).toHaveLength(1);
    const t = trades[0];
    expect(t.kind).toBe("closed");
    expect(t.quantity).toBe(50);
    const avg = (10 * 100 + 20 * 110 + 20 * 120) / 50;
    expect(t.entry_price).toBeCloseTo(avg);
    expect(t.gross_pnl).toBeCloseTo((130 - avg) * 50);
  });

  it("invariant: net-long equity → open qty = net", () => {
    const { trades, orphans } = reconstructPositions(
      [
        o({ order_id: "b1", side: "buy", quantity: 100, avg_price: 100, execution_time: "t1", source_fill_ids: ["EQ:b1"] }),
        o({ order_id: "s1", side: "sell", quantity: 40, avg_price: 110, execution_time: "t2", source_fill_ids: ["EQ:s1"] }),
      ],
      false,
    );
    expect(orphans).toHaveLength(0);
    const openQty = trades
      .filter((t) => t.kind === "open")
      .reduce((a, t) => a + (t.quantity - t.exits.reduce((x, e) => x + e.quantity, 0)), 0);
    expect(openQty).toBe(60); // 100 - 40
  });

  it("invariant: net-short equity (excess sell) → orphan qty = |net|, zero open", () => {
    const { trades, orphans } = reconstructPositions(
      [
        o({ order_id: "b1", side: "buy", quantity: 50, avg_price: 100, execution_time: "t1", source_fill_ids: ["EQ:b1"] }),
        o({ order_id: "s1", side: "sell", quantity: 50, avg_price: 110, execution_time: "t2", source_fill_ids: ["EQ:s1"] }),
        o({ order_id: "s2", side: "sell", quantity: 30, avg_price: 115, execution_time: "t3", source_fill_ids: ["EQ:s2"] }),
      ],
      false,
    );
    // 50 buy + 50 sell closes cleanly. The 30 sell has nothing to close → orphan 30.
    expect(orphans.reduce((a, x) => a + x.quantity, 0)).toBe(30);
    expect(trades.filter((t) => t.kind === "open")).toHaveLength(0);
    expect(trades.filter((t) => t.kind === "closed")).toHaveLength(1);
  });

  it("F&O flip: long → short in one order", () => {
    const { trades } = reconstructPositions(
      [
        o({
          order_id: "b1",
          side: "buy",
          symbol: "NIFTYFUT",
          segment: "FO",
          expiry_date: "2025-09-25",
          quantity: 50,
          avg_price: 20000,
          execution_time: "2025-09-15T09:00:00",
          source_fill_ids: ["FO:b1"],
        }),
        o({
          order_id: "s1",
          side: "sell",
          symbol: "NIFTYFUT",
          segment: "FO",
          expiry_date: "2025-09-25",
          quantity: 80,
          avg_price: 20100,
          execution_time: "2025-09-15T10:00:00",
          source_fill_ids: ["FO:s1"],
        }),
      ],
      true,
    );
    // Closes long 50, flips short 30.
    expect(trades).toHaveLength(2);
    const closed = trades.find((t) => t.kind === "closed")!;
    const open = trades.find((t) => t.kind === "open")!;
    expect(closed.side).toBe("long");
    expect(closed.quantity).toBe(50);
    expect(open.side).toBe("short");
    expect(open.quantity).toBe(30);
    expect(open.entry_price).toBe(20100);
  });
});

