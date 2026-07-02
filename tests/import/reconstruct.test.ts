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

  it("splits an over-buying position into closed + open", () => {
    const { trades } = reconstructPositions(
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
    // First 100 closed by 100 of the sell; second lot (100) partially closed by 50 → still open.
    expect(trades).toHaveLength(2);
    const closed = trades.find((t) => t.kind === "closed")!;
    const open = trades.find((t) => t.kind === "open")!;
    expect(closed.quantity).toBe(100);
    expect(closed.entry_price).toBe(100);
    expect(closed.gross_pnl).toBeCloseTo((120 - 100) * 100);
    expect(open.quantity).toBe(100);
    expect(open.entry_price).toBe(105);
    expect(open.exits[0].quantity).toBe(50);
    // Split-fill: the shared closing fill must appear on BOTH reconstructed
    // trades so downstream persistence can dedupe idempotently.
    expect(closed.source_fill_ids).toContain("EQ:s1");
    expect(open.source_fill_ids).toContain("EQ:s1");
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
});
