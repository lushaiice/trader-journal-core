/** Centralized behavioral scoring. Pure functions only. */

import {
  CHECKLIST_ITEMS,
  type ChecklistResponses,
} from "@/lib/workspace/constants";

export function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}

/** 0..100 readiness score, weighted by checklist items. */
export function readinessScore(items: ChecklistResponses): number {
  let earned = 0;
  let max = 0;
  for (const item of CHECKLIST_ITEMS) {
    max += item.weight;
    const v = items[item.id];
    if (v === undefined) continue;
    const healthy = item.positive ? v === true : v === false;
    if (healthy) earned += item.weight;
  }
  return max ? Math.round((earned / max) * 100) : 0;
}

export function checklistCompletion(items: ChecklistResponses): number {
  const total = CHECKLIST_ITEMS.length;
  const answered = CHECKLIST_ITEMS.filter((i) => items[i.id] !== undefined).length;
  return total ? Math.round((answered / total) * 100) : 0;
}

/** 1..5 emotional score → 0..100. */
export function emotionalScore(score?: number | null): number {
  if (score == null) return 0;
  return clamp((score / 5) * 100);
}

export interface ProcessInputs {
  checklist?: ChecklistResponses | null;
  disciplineFollowRate?: number | null; // 0..100
  emotionalScoreOf5?: number | null; // 1..5
  journaledToday?: boolean;
  consistencyDays?: number; // 0..7
}

export interface ProcessQualityBreakdown {
  checklist: number;
  discipline: number;
  emotional: number;
  journaling: number;
  consistency: number;
  total: number;
}

export const PROCESS_WEIGHTS = {
  checklist: 0.25,
  discipline: 0.25,
  emotional: 0.2,
  journaling: 0.15,
  consistency: 0.15,
} as const;

export function processQualityScore(input: ProcessInputs): ProcessQualityBreakdown {
  const checklist = input.checklist ? readinessScore(input.checklist) : 0;
  const discipline = clamp(input.disciplineFollowRate ?? 0);
  const emotional = emotionalScore(input.emotionalScoreOf5);
  const journaling = input.journaledToday ? 100 : 0;
  const consistency = clamp(((input.consistencyDays ?? 0) / 7) * 100);

  const total =
    checklist * PROCESS_WEIGHTS.checklist +
    discipline * PROCESS_WEIGHTS.discipline +
    emotional * PROCESS_WEIGHTS.emotional +
    journaling * PROCESS_WEIGHTS.journaling +
    consistency * PROCESS_WEIGHTS.consistency;

  return {
    checklist: Math.round(checklist),
    discipline: Math.round(discipline),
    emotional: Math.round(emotional),
    journaling: Math.round(journaling),
    consistency: Math.round(consistency),
    total: Math.round(total),
  };
}

export type ProcessTone = "strong" | "steady" | "soft";

export function processTone(score: number): ProcessTone {
  if (score >= 75) return "strong";
  if (score >= 50) return "steady";
  return "soft";
}

export function average(values: number[]): number {
  if (!values.length) return 0;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}
