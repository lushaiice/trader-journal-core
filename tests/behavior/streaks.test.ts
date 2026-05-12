import { describe, it, expect } from "vitest";
import {
  currentStreak,
  longestStreak,
  consistencyInLast,
  streakSummary,
} from "@/lib/behavior/streaks";

const today = new Date("2026-05-12T12:00:00Z");
const day = (offset: number) => {
  const d = new Date(today.getTime() - offset * 86_400_000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};

describe("streak engine", () => {
  it("returns 0 for empty input", () => {
    expect(currentStreak([], today)).toBe(0);
    expect(longestStreak([])).toBe(0);
  });

  it("counts consecutive days ending today", () => {
    expect(currentStreak([day(0), day(1), day(2)], today)).toBe(3);
  });

  it("tolerates today missing if yesterday logged", () => {
    expect(currentStreak([day(1), day(2)], today)).toBe(2);
  });

  it("breaks streak on a gap", () => {
    expect(currentStreak([day(0), day(2), day(3)], today)).toBe(1);
  });

  it("computes longest run across non-contiguous data", () => {
    expect(longestStreak([day(0), day(1), day(5), day(6), day(7), day(8)])).toBe(4);
  });

  it("consistency window counts unique days only", () => {
    expect(consistencyInLast([day(0), day(0), day(2)], 7, today)).toBe(2);
  });

  it("summary aggregates all four metrics", () => {
    const s = streakSummary([day(0), day(1), day(3), day(20)], today);
    expect(s.current).toBe(2);
    expect(s.longest).toBe(2);
    expect(s.last7).toBe(3);
    expect(s.last30).toBe(4);
  });
});
