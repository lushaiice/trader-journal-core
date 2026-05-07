/** Time range filtering utilities. Pure. */
import type { TimeRange, TimeRangeKey } from "@/types/analytics";
import type { NormalizedTrade } from "@/types/analytics";

const DAY_MS = 24 * 60 * 60 * 1000;

export const TIME_RANGE_LABELS: Record<TimeRangeKey, string> = {
  "7D": "7 Days",
  "1M": "1 Month",
  "1Y": "1 Year",
  "3Y": "3 Years",
  YTD: "Year to Date",
  ALL: "All Time",
};

export function buildTimeRange(key: TimeRangeKey, now: Date = new Date()): TimeRange {
  const end = now;
  let start: Date | null = null;
  switch (key) {
    case "7D":
      start = new Date(end.getTime() - 7 * DAY_MS);
      break;
    case "1M":
      start = new Date(end);
      start.setMonth(start.getMonth() - 1);
      break;
    case "1Y":
      start = new Date(end);
      start.setFullYear(start.getFullYear() - 1);
      break;
    case "3Y":
      start = new Date(end);
      start.setFullYear(start.getFullYear() - 3);
      break;
    case "YTD":
      start = new Date(end.getFullYear(), 0, 1);
      break;
    case "ALL":
    default:
      start = null;
  }
  return { key, label: TIME_RANGE_LABELS[key], start, end };
}

export function inRange(date: Date, range: TimeRange): boolean {
  const t = date.getTime();
  if (range.start && t < range.start.getTime()) return false;
  if (t > range.end.getTime()) return false;
  return true;
}

/**
 * Filter trades by activity within range.
 * - closed/partial trades: included if their close (or last exit) falls in range
 * - open trades: included if entry date falls in range
 */
export function filterTradesByRange(
  trades: NormalizedTrade[],
  range: TimeRange,
): NormalizedTrade[] {
  return trades.filter((t) => {
    const ref = t.closeDate ?? t.entryDate;
    return inRange(ref, range);
  });
}
