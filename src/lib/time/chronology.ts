/**
 * Deterministic chronology helpers — analytics integrity depends on stable
 * event ordering across timezones and devices. All persisted timestamps are
 * UTC; display happens in the user's local zone.
 */

/** Stable comparator: by UTC time ascending, then by string id for ties. */
export function compareChronological<T extends { date: Date | string; id?: string }>(
  a: T,
  b: T,
): number {
  const ta = new Date(a.date).getTime();
  const tb = new Date(b.date).getTime();
  if (ta !== tb) return ta - tb;
  const ia = a.id ?? "";
  const ib = b.id ?? "";
  return ia.localeCompare(ib);
}

/** Sort a list deterministically without mutating the input. */
export function sortChronological<T extends { date: Date | string; id?: string }>(
  items: readonly T[],
): T[] {
  return items.slice().sort(compareChronological);
}

/** YYYY-MM-DD bucket in the user's local timezone. Use for daily aggregates. */
export function localDayKey(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** UTC YYYY-MM-DD — for cross-device deterministic aggregation. */
export function utcDayKey(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
}
