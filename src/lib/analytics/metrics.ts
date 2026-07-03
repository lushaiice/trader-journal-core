/** Core analytics metric calculations — pure, framework-independent. */
import type { AnalyticsSummary, NormalizedTrade } from "@/types/analytics";

const EPS = 1e-9;

function mean(xs: number[]): number | null {
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function stdev(xs: number[]): number | null {
  if (xs.length < 2) return null;
  const m = mean(xs)!;
  const variance = xs.reduce((a, b) => a + (b - m) * (b - m), 0) / (xs.length - 1);
  return Math.sqrt(variance);
}

/** Closed/partial trades have a realized P&L; open trades are excluded. */
export function realizedTrades(trades: NormalizedTrade[]): NormalizedTrade[] {
  return trades.filter((t) => t.status !== "open" && t.filledQty > 0);
}

export function summarizeAnalytics(trades: NormalizedTrade[]): AnalyticsSummary {
  const realized = realizedTrades(trades);
  const wins = realized.filter((t) => t.netPnl > EPS);
  const losses = realized.filter((t) => t.netPnl < -EPS);
  const breakeven = realized.length - wins.length - losses.length;

  const winRate = realized.length ? wins.length / realized.length : null;
  const lossRate = realized.length ? losses.length / realized.length : null;

  const avgWinner = mean(wins.map((t) => t.netPnl));
  const avgLoser = mean(losses.map((t) => t.netPnl));

  const totalNetPnl = realized.reduce((a, t) => a + t.netPnl, 0);
  const totalGrossPnl = realized.reduce((a, t) => a + t.grossPnl, 0);
  const totalFees = trades.reduce((a, t) => a + t.fees, 0);

  const grossProfit = wins.reduce((a, t) => a + t.netPnl, 0);
  const grossLoss = Math.abs(losses.reduce((a, t) => a + t.netPnl, 0));
  const profitFactor =
    grossLoss > EPS ? grossProfit / grossLoss : grossProfit > EPS ? Infinity : null;

  const expectancy =
    winRate != null && lossRate != null && avgWinner != null && avgLoser != null
      ? winRate * avgWinner + lossRate * avgLoser
      : realized.length
        ? totalNetPnl / realized.length
        : null;

  const rs = realized.map((t) => t.rMultiple).filter((r): r is number => r != null);
  const avgRMultiple = mean(rs);

  const returns = realized.map((t) => t.netPnl);
  const sd = stdev(returns);
  const meanRet = mean(returns);
  const sharpeRatio = sd != null && sd > EPS && meanRet != null ? meanRet / sd : null;

  const durations = realized.map((t) => t.holdingDurationMs).filter((d): d is number => d != null);
  const avgHoldingDurationMs = mean(durations);

  const largestWin = wins.length ? Math.max(...wins.map((t) => t.netPnl)) : null;
  const largestLoss = losses.length ? Math.min(...losses.map((t) => t.netPnl)) : null;

  return {
    tradeCount: trades.length,
    closedCount: trades.filter((t) => t.status === "closed").length,
    // Partially-closed positions still carry live exposure, so count them as open.
    openCount: trades.filter((t) => t.status !== "closed").length,
    wins: wins.length,
    losses: losses.length,
    breakeven,
    winRate,
    lossRate,
    avgWinner,
    avgLoser,
    expectancy,
    profitFactor,
    sharpeRatio,
    avgRMultiple,
    totalNetPnl,
    totalGrossPnl,
    totalFees,
    avgHoldingDurationMs,
    largestWin,
    largestLoss,
  };
}

export const EMPTY_ANALYTICS_SUMMARY: AnalyticsSummary = {
  tradeCount: 0,
  closedCount: 0,
  openCount: 0,
  wins: 0,
  losses: 0,
  breakeven: 0,
  winRate: null,
  lossRate: null,
  avgWinner: null,
  avgLoser: null,
  expectancy: null,
  profitFactor: null,
  sharpeRatio: null,
  avgRMultiple: null,
  totalNetPnl: 0,
  totalGrossPnl: 0,
  totalFees: 0,
  avgHoldingDurationMs: null,
  largestWin: null,
  largestLoss: null,
};
