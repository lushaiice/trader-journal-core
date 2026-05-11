/**
 * Streak + consistency calculations.
 * Inputs are sets of ISO date strings (yyyy-MM-dd) — fully deterministic.
 */

const DAY_MS = 86_400_000;

function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Count consecutive days (ending today or yesterday) present in `dates`. */
export function currentStreak(dates: Iterable<string>, today: Date = new Date()): number {
  const set = new Set(dates);
  if (!set.size) return 0;
  let cursor = new Date(today);
  // Allow today not yet logged — start from yesterday if needed
  if (!set.has(toKey(cursor))) cursor = new Date(cursor.getTime() - DAY_MS);
  let count = 0;
  while (set.has(toKey(cursor))) {
    count += 1;
    cursor = new Date(cursor.getTime() - DAY_MS);
  }
  return count;
}

/** Longest run of consecutive days in `dates`. */
export function longestStreak(dates: Iterable<string>): number {
  const arr = Array.from(new Set(dates)).sort();
  if (!arr.length) return 0;
  let best = 1;
  let run = 1;
  for (let i = 1; i < arr.length; i += 1) {
    const prev = new Date(arr[i - 1]).getTime();
    const cur = new Date(arr[i]).getTime();
    if (cur - prev === DAY_MS) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 1;
    }
  }
  return best;
}

/** Count how many of the trailing N days appear in `dates`. */
export function consistencyInLast(
  dates: Iterable<string>,
  days: number,
  today: Date = new Date(),
): number {
  const set = new Set(dates);
  let count = 0;
  for (let i = 0; i < days; i += 1) {
    const d = new Date(today.getTime() - i * DAY_MS);
    if (set.has(toKey(d))) count += 1;
  }
  return count;
}

export interface StreakSummary {
  current: number;
  longest: number;
  last7: number;
  last30: number;
}

export function streakSummary(
  dates: Iterable<string>,
  today: Date = new Date(),
): StreakSummary {
  const arr = Array.from(dates);
  return {
    current: currentStreak(arr, today),
    longest: longestStreak(arr),
    last7: consistencyInLast(arr, 7, today),
    last30: consistencyInLast(arr, 30, today),
  };
}

export function streakLabel(streak: number, kind: string): string {
  if (streak <= 0) return `Start a new ${kind} streak today.`;
  if (streak === 1) return `Day 1 of ${kind}. Show up tomorrow.`;
  return `${streak} days of ${kind}. Quietly compounding.`;
}
