import type { Fill, Order } from "./types";

/** Encode the dedupe key: segment-scoped so EQ + FO trade_ids can't collide. */
export function fillKey(segment: string, tradeId: string): string {
  return `${segment.toUpperCase()}:${tradeId}`;
}

/**
 * Coalesce fills into orders keyed by order_id.
 * - avg_price is quantity-weighted (VWAP within the order)
 * - quantity is summed
 * - execution_time is the earliest fill time
 * - all fills in an order must share a side
 */
export function groupFillsIntoOrders(fills: Fill[]): Order[] {
  const byOrderId = new Map<string, Fill[]>();
  for (const f of fills) {
    const list = byOrderId.get(f.order_id) ?? [];
    list.push(f);
    byOrderId.set(f.order_id, list);
  }

  const orders: Order[] = [];
  for (const [order_id, group] of byOrderId) {
    const first = group[0];
    const sides = new Set(group.map((g) => g.trade_type));
    if (sides.size > 1) {
      throw new Error(`Order ${order_id} has mixed buy/sell fills — cannot reconstruct.`);
    }
    let totalQty = 0;
    let notional = 0;
    let earliest = first.order_execution_time;
    const fillIds: string[] = [];
    for (const f of group) {
      totalQty += f.quantity;
      notional += f.quantity * f.price;
      if (f.order_execution_time < earliest) earliest = f.order_execution_time;
      fillIds.push(fillKey(f.segment, f.trade_id));
    }
    orders.push({
      order_id,
      symbol: first.symbol,
      segment: first.segment,
      expiry_date: first.expiry_date,
      isin: first.isin,
      exchange: first.exchange,
      side: first.trade_type,
      quantity: totalQty,
      avg_price: notional / totalQty,
      execution_time: earliest,
      source_fill_ids: fillIds,
    });
  }

  orders.sort((a, b) =>
    a.execution_time === b.execution_time
      ? a.order_id.localeCompare(b.order_id)
      : a.execution_time.localeCompare(b.execution_time),
  );
  return orders;
}
