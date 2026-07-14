import { describe, it, expect } from "vitest";
import { reconstructPositions } from "@/lib/import/reconstruct";
import {
  adjustOrdersForCorporateActions,
  computeRatioFactor,
  type CorporateAction,
  type HoldingBaseline,
} from "@/lib/import/corporate-actions";
import type { Order } from "@/lib/import/types";

function o(overrides: Partial<Order>): Order {
  return {
    order_id: "o",
    symbol: "TATA",
    segment: "EQ",
    expiry_date: null,
    isin: "INE001",
    exchange: "NSE",
    side: "buy",
    quantity: 10,
    avg_price: 100,
    execution_time: "2025-01-02T09:00:00",
    source_fill_ids: ["EQ:t"],
    ...overrides,
  };
}

describe("computeRatioFactor", () => {
  it("split N:M => N/M", () => {
    expect(computeRatioFactor("split", 5, 1)).toBe(5);
  });
  it("bonus N:M => (N+M)/M", () => {
    expect(computeRatioFactor("bonus", 1, 1)).toBe(2);
    expect(computeRatioFactor("bonus", 3, 2)).toBeCloseTo(2.5);
  });
  it("consolidation N:M => N/M (<1)", () => {
    expect(computeRatioFactor("consolidation", 1, 5)).toBeCloseTo(0.2);
  });
});

describe("adjustOrdersForCorporateActions", () => {
  it("multiplies pre-ex-date orders by the ratio and divides price", () => {
    const orders = [o({ execution_time: "2024-01-01T09:00:00", quantity: 100, avg_price: 1000 })];
    const actions: CorporateAction[] = [
      {
        isin: "INE001",
        symbol: "TATA",
        action_type: "split",
        ex_date: "2024-03-01",
        ratio: 5,
      },
    ];
    const [adj] = adjustOrdersForCorporateActions(orders, actions);
    expect(adj.quantity).toBe(500);
    expect(adj.avg_price).toBe(200);
  });

  it("leaves post-ex-date orders untouched", () => {
    const orders = [o({ execution_time: "2024-06-01T09:00:00", quantity: 500, avg_price: 200 })];
    const actions: CorporateAction[] = [
      { isin: "INE001", symbol: "TATA", action_type: "split", ex_date: "2024-03-01", ratio: 5 },
    ];
    const [adj] = adjustOrdersForCorporateActions(orders, actions);
    expect(adj.quantity).toBe(500);
    expect(adj.avg_price).toBe(200);
  });
});

describe("reconstructPositions with corporate actions", () => {
  it("split 1:5 reconciles pre-split buy with post-split sell", () => {
    const orders = [
      o({
        order_id: "b",
        side: "buy",
        quantity: 100,
        avg_price: 1000,
        execution_time: "2024-01-01T09:00:00",
        source_fill_ids: ["EQ:b"],
      }),
      o({
        order_id: "s",
        side: "sell",
        quantity: 500,
        avg_price: 200,
        execution_time: "2024-06-01T14:00:00",
        source_fill_ids: ["EQ:s"],
      }),
    ];
    const actions: CorporateAction[] = [
      { isin: "INE001", symbol: "TATA", action_type: "split", ex_date: "2024-03-01", ratio: 5 },
    ];
    const { trades, orphans } = reconstructPositions(orders, false, { actions });
    expect(orphans).toHaveLength(0);
    expect(trades).toHaveLength(1);
    expect(trades[0].kind).toBe("closed");
    expect(trades[0].quantity).toBe(500);
    expect(trades[0].entry_price).toBeCloseTo(200);
    expect(trades[0].gross_pnl).toBeCloseTo(0);
  });

  it("bonus 1:1 (ratio 2) reconciles", () => {
    const orders = [
      o({
        order_id: "b",
        side: "buy",
        quantity: 100,
        avg_price: 1000,
        execution_time: "2024-01-01T09:00:00",
        source_fill_ids: ["EQ:b"],
      }),
      o({
        order_id: "s",
        side: "sell",
        quantity: 200,
        avg_price: 500,
        execution_time: "2024-06-01T14:00:00",
        source_fill_ids: ["EQ:s"],
      }),
    ];
    const actions: CorporateAction[] = [
      { isin: "INE001", symbol: "TATA", action_type: "bonus", ex_date: "2024-03-01", ratio: 2 },
    ];
    const { trades, orphans } = reconstructPositions(orders, false, { actions });
    expect(orphans).toHaveLength(0);
    expect(trades).toHaveLength(1);
    expect(trades[0].quantity).toBe(200);
    expect(trades[0].entry_price).toBeCloseTo(500);
  });

  it("consolidation (ratio 0.5) reconciles", () => {
    const orders = [
      o({
        order_id: "b",
        side: "buy",
        quantity: 200,
        avg_price: 100,
        execution_time: "2024-01-01T09:00:00",
        source_fill_ids: ["EQ:b"],
      }),
      o({
        order_id: "s",
        side: "sell",
        quantity: 100,
        avg_price: 200,
        execution_time: "2024-06-01T14:00:00",
        source_fill_ids: ["EQ:s"],
      }),
    ];
    const actions: CorporateAction[] = [
      {
        isin: "INE001",
        symbol: "TATA",
        action_type: "consolidation",
        ex_date: "2024-03-01",
        ratio: 0.5,
      },
    ];
    const { trades, orphans } = reconstructPositions(orders, false, { actions });
    expect(orphans).toHaveLength(0);
    expect(trades).toHaveLength(1);
    expect(trades[0].quantity).toBe(100);
    expect(trades[0].entry_price).toBeCloseTo(200);
  });

  it("holding baseline converts an orphan sell into a closed long", () => {
    const orders = [
      o({
        order_id: "s",
        side: "sell",
        quantity: 50,
        avg_price: 120,
        execution_time: "2024-06-01T14:00:00",
        source_fill_ids: ["EQ:s"],
      }),
    ];
    const baselines: HoldingBaseline[] = [
      { isin: null, symbol: "TATA", avg_cost: 100, as_of_date: "2023-01-01" },
    ];
    const { trades, orphans } = reconstructPositions(orders, false, { baselines });
    expect(orphans).toHaveLength(0);
    expect(trades).toHaveLength(1);
    expect(trades[0].side).toBe("long");
    expect(trades[0].quantity).toBe(50);
    expect(trades[0].entry_price).toBe(100);
    expect(trades[0].gross_pnl).toBe(1000);
  });
});
