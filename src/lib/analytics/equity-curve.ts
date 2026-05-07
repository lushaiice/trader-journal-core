/** Equity curve & portfolio timeline generation. */
import type {
  EquityPoint,
  NormalizedTrade,
  PortfolioSnapshot,
  TimeRange,
} from "@/types/analytics";
import { allExitEvents, type ExitEvent } from "./normalize";
import { inRange } from "./time-range";

function dayKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function fromDayKey(k: string): Date {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export interface EquityCurveOptions {
  baseCapital?: number;
  range?: TimeRange;
}

/**
 * Build a daily equity curve from realized exit events.
 * Each point aggregates all exits that closed on that day.
 */
export function buildEquityCurve(
  trades: NormalizedTrade[],
  opts: EquityCurveOptions = {},
): EquityPoint[] {
  const baseCapital = opts.baseCapital ?? 0;
  const events = allExitEvents(trades);
  const filtered = opts.range
    ? events.filter((e) => inRange(e.date, opts.range!))
    : events;

  if (!filtered.length) return [];

  const buckets = new Map<string, { pnl: number; trades: Set<string> }>();
  for (const ev of filtered) {
    const k = dayKey(ev.date);
    const slot = buckets.get(k) ?? { pnl: 0, trades: new Set<string>() };
    slot.pnl += ev.netPnl;
    slot.trades.add(ev.tradeId);
    buckets.set(k, slot);
  }

  const sortedKeys = [...buckets.keys()].sort();
  let cumulative = 0;
  return sortedKeys.map((k) => {
    const slot = buckets.get(k)!;
    cumulative += slot.pnl;
    return {
      date: fromDayKey(k),
      dailyPnl: slot.pnl,
      cumulativePnl: cumulative,
      equity: baseCapital + cumulative,
      tradesClosed: slot.trades.size,
    };
  });
}

/** Convert equity points into portfolio snapshots with returns %. */
export function buildPortfolioTimeline(
  curve: EquityPoint[],
  baseCapital: number,
): PortfolioSnapshot[] {
  if (baseCapital <= 0) {
    return curve.map((p) => ({
      date: p.date,
      equity: p.equity,
      cumulativePnl: p.cumulativePnl,
      cumulativeReturnPct: 0,
      tradesClosed: p.tradesClosed,
    }));
  }
  return curve.map((p) => ({
    date: p.date,
    equity: p.equity,
    cumulativePnl: p.cumulativePnl,
    cumulativeReturnPct: p.cumulativePnl / baseCapital,
    tradesClosed: p.tradesClosed,
  }));
}

export type { ExitEvent };
