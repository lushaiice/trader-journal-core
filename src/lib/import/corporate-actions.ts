import type { Order } from "./types";

/** Corporate action stored in-app. `ratio` is the quantity multiplier f = newQty/oldQty. */
export interface CorporateAction {
  isin: string | null;
  symbol: string;
  action_type: "split" | "bonus" | "consolidation";
  ex_date: string; // YYYY-MM-DD
  ratio: number; // quantity multiplier
}

/** Holding baseline: an existing position acquired before the export window. */
export interface HoldingBaseline {
  isin: string | null;
  symbol: string;
  avg_cost: number;
  as_of_date: string | null; // YYYY-MM-DD
}

/**
 * UI ratio inputs → stored quantity multiplier.
 * - split "N new for M old": f = N / M
 * - bonus "N bonus for M held": f = (N + M) / M
 * - consolidation "M old become N new": f = N / M (< 1)
 */
export function computeRatioFactor(
  kind: "split" | "bonus" | "consolidation",
  n: number,
  m: number,
): number {
  if (!(n > 0) || !(m > 0)) throw new Error("Ratio inputs must be positive.");
  if (kind === "bonus") return (n + m) / m;
  return n / m;
}

function orderMatchesAction(order: Order, action: CorporateAction): boolean {
  if (action.isin && order.isin) return action.isin === order.isin;
  return action.symbol.toUpperCase() === order.symbol.toUpperCase();
}

function orderDate(order: Order): string {
  // ISO-safe lexicographic compare — first 10 chars are yyyy-mm-dd.
  return order.execution_time.slice(0, 10);
}

/**
 * Pre-normalize orders to the current share basis: for every action whose
 * ex_date is STRICTLY AFTER an order's execution date, multiply quantity by
 * the action's ratio and divide avg_price by the same. This lets a buy of
 * 100 pre-split and a sell of 500 post-split reconcile as one trade.
 */
export function adjustOrdersForCorporateActions(
  orders: Order[],
  actions: CorporateAction[],
): Order[] {
  if (actions.length === 0) return orders;
  return orders.map((order) => {
    const d = orderDate(order);
    let factor = 1;
    for (const a of actions) {
      if (!orderMatchesAction(order, a)) continue;
      if (a.ex_date > d) factor *= a.ratio;
    }
    if (factor === 1) return order;
    return {
      ...order,
      quantity: order.quantity * factor,
      avg_price: order.avg_price / factor,
    };
  });
}

/** Find a baseline for the given isin/symbol; isin match wins. */
export function findBaseline(
  isin: string | null,
  symbol: string,
  baselines: HoldingBaseline[],
): HoldingBaseline | undefined {
  if (isin) {
    const byIsin = baselines.find((b) => b.isin && b.isin === isin);
    if (byIsin) return byIsin;
  }
  return baselines.find((b) => b.symbol.toUpperCase() === symbol.toUpperCase());
}
