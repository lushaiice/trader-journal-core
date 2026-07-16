/**
 * Rebalancing calculator — pure math tool.
 *
 * Given priced holdings and user-entered target weights (percent 0–100),
 * compute the value + share shifts needed to reach those targets.
 *
 * Assumes total portfolio value is held CONSTANT (a pure rebalance:
 * no fresh capital added, no leverage). Unallocated percent implicitly
 * moves to cash via net sells.
 *
 * This is a calculation tool ONLY: it never recommends securities,
 * promises outcomes, or places orders.
 */

export interface RebalanceInput {
  symbol: string;
  marketValue: number;
  lastClose: number | null;
}

export type RebalanceAction = "buy" | "sell" | "hold";

export interface RebalanceRow {
  symbol: string;
  marketValue: number;
  lastClose: number | null;
  currentWeight: number; // fraction 0–1
  targetWeight: number; // fraction 0–1
  targetValue: number;
  deltaValue: number; // + buy / − sell
  deltaShares: number | null;
  action: RebalanceAction;
}

export interface RebalanceResult {
  rows: RebalanceRow[];
  total: number;
  targetsSumPct: number;
  unallocatedPct: number;
  overAllocated: boolean;
}

const VALUE_TOL = 0.5; // ₹ tolerance for hold vs buy/sell
const PCT_EPSILON = 0.01;

export function computeRebalance(
  holdings: RebalanceInput[],
  targetWeights: Record<string, number>,
): RebalanceResult {
  const total = holdings.reduce((s, h) => s + (h.marketValue || 0), 0);

  let targetsSumPct = 0;
  for (const h of holdings) {
    const pct = targetWeights[h.symbol];
    if (typeof pct === "number" && Number.isFinite(pct)) {
      targetsSumPct += pct;
    }
  }

  const rows: RebalanceRow[] = holdings.map((h) => {
    const currentWeight = total > 0 ? h.marketValue / total : 0;
    const rawPct = targetWeights[h.symbol];
    const pct = typeof rawPct === "number" && Number.isFinite(rawPct) ? rawPct : 0;
    const targetWeight = pct / 100;
    const targetValue = targetWeight * total;
    const deltaValue = targetValue - h.marketValue;
    const deltaShares = h.lastClose != null && h.lastClose > 0 ? deltaValue / h.lastClose : null;
    const action: RebalanceAction =
      deltaValue > VALUE_TOL ? "buy" : deltaValue < -VALUE_TOL ? "sell" : "hold";
    return {
      symbol: h.symbol,
      marketValue: h.marketValue,
      lastClose: h.lastClose,
      currentWeight,
      targetWeight,
      targetValue,
      deltaValue,
      deltaShares,
      action,
    };
  });

  const unallocatedPct = 100 - targetsSumPct;
  const overAllocated = targetsSumPct > 100 + PCT_EPSILON;

  return { rows, total, targetsSumPct, unallocatedPct, overAllocated };
}
