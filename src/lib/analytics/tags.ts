/** Tag-level performance aggregation. */
import type { NormalizedTrade, TagAnalytics } from "@/types/analytics";
import { realizedTrades } from "./metrics";

const EPS = 1e-9;

function mean(xs: number[]): number | null {
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function aggregateByTag(trades: NormalizedTrade[]): TagAnalytics[] {
  const realized = realizedTrades(trades);
  const groups = new Map<string, NormalizedTrade[]>();
  for (const t of realized) {
    for (const tag of t.tags) {
      if (!tag) continue;
      const arr = groups.get(tag) ?? [];
      arr.push(t);
      groups.set(tag, arr);
    }
  }
  return [...groups.entries()].map(([tag, items]) => {
    const wins = items.filter((t) => t.netPnl > EPS).length;
    const losses = items.filter((t) => t.netPnl < -EPS).length;
    const winRate = items.length ? wins / items.length : null;
    const netPnl = items.reduce((a, t) => a + t.netPnl, 0);
    const rs = items.map((t) => t.rMultiple).filter((r): r is number => r != null);
    return {
      tag,
      trades: items.length,
      wins,
      losses,
      winRate,
      netPnl,
      avgRMultiple: mean(rs),
      expectancy: items.length ? netPnl / items.length : null,
    };
  });
}

export function topPerformingTags(trades: NormalizedTrade[], limit = 5): TagAnalytics[] {
  return [...aggregateByTag(trades)]
    .filter((t) => t.trades >= 1)
    .sort((a, b) => b.netPnl - a.netPnl)
    .slice(0, limit);
}

export function worstPerformingTags(trades: NormalizedTrade[], limit = 5): TagAnalytics[] {
  return [...aggregateByTag(trades)]
    .filter((t) => t.trades >= 1)
    .sort((a, b) => a.netPnl - b.netPnl)
    .slice(0, limit);
}
