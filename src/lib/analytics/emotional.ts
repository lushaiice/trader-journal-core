/** Emotional analytics — bucket performance by 1..5 score. */
import type {
  EmotionalAnalytics,
  EmotionalAnalyticsBucket,
  NormalizedTrade,
} from "@/types/analytics";
import { realizedTrades } from "./metrics";

const EPS = 1e-9;

function bucketBy(
  trades: NormalizedTrade[],
  pick: (t: NormalizedTrade) => number | null,
): EmotionalAnalyticsBucket[] {
  const groups = new Map<number, NormalizedTrade[]>();
  for (const t of trades) {
    const v = pick(t);
    if (v == null) continue;
    const arr = groups.get(v) ?? [];
    arr.push(t);
    groups.set(v, arr);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([score, items]) => {
      const wins = items.filter((t) => t.netPnl > EPS).length;
      const winRate = items.length ? wins / items.length : null;
      const netPnl = items.reduce((a, t) => a + t.netPnl, 0);
      const avgNetPnl = items.length ? netPnl / items.length : 0;
      return {
        score,
        trades: items.length,
        winRate,
        avgNetPnl,
        expectancy: items.length ? netPnl / items.length : null,
      };
    });
}

export function buildEmotionalAnalytics(
  trades: NormalizedTrade[],
): EmotionalAnalytics {
  const realized = realizedTrades(trades);
  return {
    confidence: bucketBy(realized, (t) => t.confidence),
    recoveryUrge: bucketBy(realized, (t) => t.recoveryUrge),
    emotionLevel: bucketBy(realized, (t) => t.emotionLevel),
    disciplineFeel: bucketBy(realized, (t) => t.disciplineFeel),
  };
}
