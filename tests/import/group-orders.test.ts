import { describe, it, expect } from "vitest";
import { groupFillsIntoOrders } from "@/lib/import/group-orders";
import type { Fill } from "@/lib/import/types";

function f(overrides: Partial<Fill>): Fill {
  return {
    symbol: "INFY",
    segment: "EQ",
    expiry_date: null,
    trade_date: "2025-01-02",
    trade_type: "buy",
    quantity: 1,
    price: 100,
    trade_id: "t",
    order_id: "o",
    order_execution_time: "2025-01-02T09:00:00",
    ...overrides,
  };
}

describe("groupFillsIntoOrders", () => {
  it("computes VWAP and earliest time", () => {
    const orders = groupFillsIntoOrders([
      f({ trade_id: "a", quantity: 4, price: 100, order_execution_time: "2025-01-02T09:00:05" }),
      f({ trade_id: "b", quantity: 6, price: 110, order_execution_time: "2025-01-02T09:00:01" }),
    ]);
    expect(orders).toHaveLength(1);
    expect(orders[0].quantity).toBe(10);
    expect(orders[0].avg_price).toBeCloseTo((4 * 100 + 6 * 110) / 10);
    expect(orders[0].execution_time).toBe("2025-01-02T09:00:01");
    expect(orders[0].source_fill_ids.sort()).toEqual(["EQ:a", "EQ:b"]);
  });

  it("rejects mixed-side fills in one order", () => {
    expect(() =>
      groupFillsIntoOrders([
        f({ order_id: "x", trade_id: "a", trade_type: "buy" }),
        f({ order_id: "x", trade_id: "b", trade_type: "sell" }),
      ]),
    ).toThrow(/mixed buy\/sell/);
  });

  it("sorts orders chronologically", () => {
    const orders = groupFillsIntoOrders([
      f({ order_id: "b", trade_id: "1", order_execution_time: "2025-01-02T10:00:00" }),
      f({ order_id: "a", trade_id: "2", order_execution_time: "2025-01-02T09:00:00" }),
    ]);
    expect(orders.map((o) => o.order_id)).toEqual(["a", "b"]);
  });
});
