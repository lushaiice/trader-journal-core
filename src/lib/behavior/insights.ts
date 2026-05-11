/**
 * Deterministic, analytics-derived observations.
 * Calm, reflective tone — no AI, no hype.
 */

export interface InsightInput {
  processScore: number;
  consistencyDays: number; // last 7
  tradeCount: number;
  reflectionStreak: number;
  checklistStreak: number;
  recentDisciplineAvg?: number | null; // 0..100
  monthlyDisciplineTrend?: number | null; // -1 worse, 0 flat, 1 improving
}

export function buildInsights(input: InsightInput): string[] {
  const out: string[] = [];

  if (input.consistencyDays >= 5) {
    out.push(
      `You journaled ${input.consistencyDays} of the last 7 days. Consistency is compounding.`,
    );
  }

  if (input.reflectionStreak >= 3) {
    out.push(`${input.reflectionStreak} days of completed reflections.`);
  }

  if (input.checklistStreak >= 3) {
    out.push(`Checklist consistency improving — ${input.checklistStreak} days in a row.`);
  }

  if (input.processScore < 50 && input.tradeCount > 0) {
    out.push("Process quality is soft today. Slow down before the next trade.");
  }

  if (input.processScore >= 75) {
    out.push("Process is sharp today. Protect this state — fewer trades, higher quality.");
  }

  if (input.tradeCount === 0) {
    out.push("No trades yet. Patience is a position too.");
  }

  if (input.monthlyDisciplineTrend === 1) {
    out.push("Discipline trending up over the last month.");
  } else if (input.monthlyDisciplineTrend === -1) {
    out.push("Discipline has softened this month. Worth a review.");
  }

  return out;
}
