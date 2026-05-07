/** Formatting helpers for analytics outputs. */
export function formatPercent(v: number | null, digits = 1): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${(v * 100).toFixed(digits)}%`;
}

export function formatRatio(v: number | null, digits = 2): string {
  if (v == null) return "—";
  if (!Number.isFinite(v)) return "∞";
  return v.toFixed(digits);
}

export function formatRMultiple(v: number | null): string {
  if (v == null) return "—";
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}R`;
}

export function formatDuration(ms: number | null): string {
  if (ms == null || ms <= 0) return "—";
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
