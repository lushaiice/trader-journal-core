/** Process Quality scoring — independent of profitability. */
import { readinessScore, type ChecklistResponses } from "./constants";

export interface ProcessInputs {
  checklist?: ChecklistResponses | null;
  /** 0..100 — discipline rules followed today */
  disciplineFollowRate?: number | null;
  /** 1..5 trader-reported discipline feel */
  emotionalScore?: number | null;
  /** Whether the user logged a journal/reflection today */
  journaledToday?: boolean;
  /** Number of disciplined days in last 7 (consistency) */
  consistencyDays?: number;
}

export interface ProcessQualityBreakdown {
  checklist: number;
  discipline: number;
  emotional: number;
  journaling: number;
  consistency: number;
  total: number;
}

const WEIGHTS = {
  checklist: 0.25,
  discipline: 0.25,
  emotional: 0.2,
  journaling: 0.15,
  consistency: 0.15,
};

export function processQualityScore(input: ProcessInputs): ProcessQualityBreakdown {
  const checklist = input.checklist ? readinessScore(input.checklist) : 0;
  const discipline = clamp(input.disciplineFollowRate ?? 0, 0, 100);
  const emotional = input.emotionalScore != null ? (input.emotionalScore / 5) * 100 : 0;
  const journaling = input.journaledToday ? 100 : 0;
  const consistency = clamp(((input.consistencyDays ?? 0) / 7) * 100, 0, 100);

  const total =
    checklist * WEIGHTS.checklist +
    discipline * WEIGHTS.discipline +
    emotional * WEIGHTS.emotional +
    journaling * WEIGHTS.journaling +
    consistency * WEIGHTS.consistency;

  return {
    checklist: Math.round(checklist),
    discipline: Math.round(discipline),
    emotional: Math.round(emotional),
    journaling: Math.round(journaling),
    consistency: Math.round(consistency),
    total: Math.round(total),
  };
}

export function processTone(score: number): "strong" | "steady" | "soft" {
  if (score >= 75) return "strong";
  if (score >= 50) return "steady";
  return "soft";
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function average(values: number[]): number {
  if (!values.length) return 0;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}
