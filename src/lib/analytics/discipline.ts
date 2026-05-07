/** Discipline analytics from per-trade discipline logs. */
import type {
  DisciplineAnalytics,
  DisciplineRuleStat,
  NormalizedTrade,
} from "@/types/analytics";
import { disciplineScore } from "@/lib/trades/calculations";
import type { DisciplineRow } from "@/lib/trades/calculations";

const NEGATIVE_RULES = new Set(["Overtraded", "Emotional trade"]);

function isViolation(log: DisciplineRow): boolean {
  return NEGATIVE_RULES.has(log.rule) ? log.followed : !log.followed;
}

function dayKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export function buildDisciplineAnalytics(
  trades: NormalizedTrade[],
): DisciplineAnalytics {
  const allLogs: DisciplineRow[] = trades.flatMap((t) => t.raw.discipline);

  // Per-rule stats
  const ruleMap = new Map<string, { followed: number; total: number }>();
  let violations = 0;
  for (const log of allLogs) {
    const slot = ruleMap.get(log.rule) ?? { followed: 0, total: 0 };
    slot.total += 1;
    if (log.followed) slot.followed += 1;
    ruleMap.set(log.rule, slot);
    if (isViolation(log)) violations += 1;
  }
  const rules: DisciplineRuleStat[] = [...ruleMap.entries()].map(
    ([rule, s]) => ({
      rule,
      total: s.total,
      followed: s.followed,
      violated: s.total - s.followed,
      followRate: s.total ? s.followed / s.total : null,
    }),
  );

  // Trend by day (per-trade discipline scores)
  const dayBuckets = new Map<string, DisciplineRow[]>();
  for (const t of trades) {
    if (!t.raw.discipline.length) continue;
    const k = dayKey(t.entryDate);
    const arr = dayBuckets.get(k) ?? [];
    arr.push(...t.raw.discipline);
    dayBuckets.set(k, arr);
  }
  const trend = [...dayBuckets.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, logs]) => {
      const [y, m, d] = k.split("-").map(Number);
      const score = disciplineScore(logs) ?? 0;
      return { date: new Date(Date.UTC(y, m - 1, d)), score, logs: logs.length };
    });

  const averageScore = disciplineScore(allLogs);

  const topViolations = [...rules]
    .filter((r) => r.violated > 0)
    .sort((a, b) => b.violated - a.violated)
    .slice(0, 5);

  return {
    averageScore,
    totalLogs: allLogs.length,
    totalViolations: violations,
    trend,
    rules,
    topViolations,
  };
}
