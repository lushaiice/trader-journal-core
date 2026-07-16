/**
 * Portfolio risk, concentration, allocation & exposure — pure functions.
 * Frameworks-free; consumed by the /portfolio route.
 */
import type { NormalizedTrade } from "@/types/analytics";
import { realizedTrades } from "@/lib/analytics/metrics";
import type { Holding } from "@/lib/portfolio/holdings";

const EPS = 1e-9;

// ─────────────────────────── Return risk ────────────────────────────

export interface ReturnRisk {
  /** Mean per-trade net P&L (₹). null if no realized trades. */
  meanReturn: number | null;
  /** Sample standard deviation of per-trade net P&L (₹). null if <2 realized trades. */
  volatility: number | null;
  /** sqrt(mean(min(0,r)^2)) with MAR=0. null if <2 realized trades. */
  downsideDeviation: number | null;
  /** meanReturn / downsideDeviation. null when there is no downside or <2 trades. */
  sortino: number | null;
}

function mean(xs: number[]): number | null {
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function sampleStdev(xs: number[]): number | null {
  if (xs.length < 2) return null;
  const m = mean(xs)!;
  const v = xs.reduce((a, b) => a + (b - m) * (b - m), 0) / (xs.length - 1);
  return Math.sqrt(v);
}

export function computeReturnRisk(trades: NormalizedTrade[]): ReturnRisk {
  const realized = realizedTrades(trades);
  const returns = realized.map((t) => t.netPnl);
  const meanReturn = mean(returns);
  const volatility = sampleStdev(returns);

  let downsideDeviation: number | null = null;
  if (returns.length >= 2) {
    const sq = returns.map((r) => (r < 0 ? r * r : 0));
    downsideDeviation = Math.sqrt(sq.reduce((a, b) => a + b, 0) / returns.length);
  }
  const sortino =
    meanReturn != null && downsideDeviation != null && downsideDeviation > EPS
      ? meanReturn / downsideDeviation
      : null;

  return { meanReturn, volatility, downsideDeviation, sortino };
}

// ─────────────────────────── Concentration ──────────────────────────

export interface ConcentrationWeight {
  symbol: string;
  weight: number;
}

export interface Concentration {
  herfindahl: number | null;
  topWeight: number | null;
  top3Weight: number | null;
  weights: ConcentrationWeight[];
}

/** Concentration from priced equity holdings (uses marketValue). */
export function computeConcentration(pricedHoldings: Holding[]): Concentration {
  const total = pricedHoldings.reduce((a, h) => a + (h.marketValue ?? 0), 0);
  if (total <= EPS) {
    return { herfindahl: null, topWeight: null, top3Weight: null, weights: [] };
  }
  const weights: ConcentrationWeight[] = pricedHoldings
    .map((h) => ({ symbol: h.symbol, weight: (h.marketValue ?? 0) / total }))
    .sort((a, b) => b.weight - a.weight);
  const herfindahl = weights.reduce((a, w) => a + w.weight * w.weight, 0);
  const topWeight = weights[0]?.weight ?? null;
  const top3Weight = weights.slice(0, 3).reduce((a, w) => a + w.weight, 0);
  return { herfindahl, topWeight, top3Weight, weights };
}

// ──────────────────────── Allocation & exposure ─────────────────────

export interface AllocationShare {
  value: number;
  share: number;
}

export interface Allocation {
  deployedValue: number;
  exposurePct: number | null;
  byInstrument: { equity: AllocationShare; derivatives: AllocationShare };
  byDirection: { long: AllocationShare; short: AllocationShare };
}

/**
 * Value each open/partial position: equity uses market value when priced
 * (otherwise cost). Derivatives are valued at remaining cost.
 */
export function computeAllocation(
  openTrades: NormalizedTrade[],
  priceBySymbol: Record<string, { close: number } | undefined>,
  capitalBase: number,
): Allocation {
  let equityVal = 0;
  let derivVal = 0;
  let longVal = 0;
  let shortVal = 0;

  for (const t of openTrades) {
    if (t.status !== "open" && t.status !== "partial") continue;
    const remaining = t.remainingQty;
    if (remaining <= 0) continue;

    const instrumentType = String(t.raw.trade.instrument_type ?? "equity");
    const isEquity = instrumentType === "equity";
    const price = priceBySymbol[t.symbol];
    const unit = isEquity && price && Number.isFinite(price.close) ? price.close : t.entryPrice;
    const value = remaining * unit;

    if (isEquity) equityVal += value;
    else derivVal += value;

    if (t.side === "short") shortVal += value;
    else longVal += value;
  }

  const deployedValue = equityVal + derivVal;
  const shareOf = (v: number): number => (deployedValue > EPS ? v / deployedValue : 0);

  return {
    deployedValue,
    exposurePct: capitalBase > EPS ? deployedValue / capitalBase : null,
    byInstrument: {
      equity: { value: equityVal, share: shareOf(equityVal) },
      derivatives: { value: derivVal, share: shareOf(derivVal) },
    },
    byDirection: {
      long: { value: longVal, share: shareOf(longVal) },
      short: { value: shortVal, share: shareOf(shortVal) },
    },
  };
}
