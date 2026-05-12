import { describe, it, expect } from "vitest";
import {
  processQualityScore,
  readinessScore,
  emotionalScore,
  PROCESS_WEIGHTS,
} from "@/lib/behavior/scoring";
import {
  currentStreak,
  longestStreak,
  consistencyInLast,
  streakSummary,
} from "@/lib/behavior/streaks";
import { CHECKLIST_ITEMS } from "@/lib/workspace/constants";

describe("behavior scoring", () => {
  it("emotionalScore normalizes 1..5 to 0..100", () => {
    expect(emotionalScore(null)).toBe(0);
    expect(emotionalScore(1)).toBe(20);
    expect(emotionalScore(5)).toBe(100);
  });

  it("readinessScore returns 0 with no answers", () => {
    expect(readinessScore({})).toBe(0);
  });

  it("readinessScore=100 when every item is healthy", () => {
    const items: Record<string, boolean> = {};
    for (const i of CHECKLIST_ITEMS) items[i.id] = i.positive ? true : false;
    expect(readinessScore(items)).toBe(100);
  });

  it("processQualityScore weights sum correctly", () => {
    const s = processQualityScore({
      checklist: undefined,
      disciplineFollowRate: 100,
      emotionalScoreOf5: 5,
      journaledToday: true,
      consistencyDays: 7,
    });
    const expected =
      0 * PROCESS_WEIGHTS.checklist +
      100 * PROCESS_WEIGHTS.discipline +
      100 * PROCESS_WEIGHTS.emotional +
      100 * PROCESS_WEIGHTS.journaling +
      100 * PROCESS_WEIGHTS.consistency;
    expect(s.total).toBe(Math.round(expected));
  });

  it("handles missing data without throwing", () => {
    const s = processQualityScore({});
    expect(s.total).toBe(0);
    expect(s.checklist).toBe(0);
  });
});

describe("streaks", () => {
  const today = new Date("2026-05-12T12:00:00Z");
  const k = (d: string) => d;

  it("currentStreak counts back from today", () => {
    expect(
      currentStreak(["2026-05-12", "2026-05-11", "2026-05-10"].map(k), today),
    ).toBe(3);
  });

  it("currentStreak allows missing today (yesterday counts)", () => {
    expect(currentStreak(["2026-05-11", "2026-05-10"], today)).toBe(2);
  });

  it("currentStreak is 0 when gap > 1 day", () => {
    expect(currentStreak(["2026-05-08", "2026-05-07"], today)).toBe(0);
  });

  it("longestStreak finds longest consecutive run", () => {
    expect(
      longestStreak(["2026-05-01", "2026-05-02", "2026-05-04", "2026-05-05", "2026-05-06"]),
    ).toBe(3);
  });

  it("consistencyInLast counts days in window", () => {
    expect(
      consistencyInLast(
        ["2026-05-12", "2026-05-10", "2026-05-08", "2026-05-01"],
        7,
        today,
      ),
    ).toBe(3);
  });

  it("streakSummary returns all zeros for empty", () => {
    const s = streakSummary([], today);
    expect(s).toEqual({ current: 0, longest: 0, last7: 0, last30: 0 });
  });
});
