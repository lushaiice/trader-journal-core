/**
 * Cashflow-aware equity curve & normalized return calculations.
 *
 * Trading P&L is kept distinct from external cashflows. Deposits and
 * withdrawals shift the equity baseline but do NOT inflate or deflate
 * trading performance metrics.
 */
import type { CapitalEvent } from "@/types/capital";
import { signedAmount, sortEvents } from "./events";

export type CashflowKind = "initial" | "deposit" | "withdrawal";

export interface CapitalAdjustedPoint {
  date: Date;
  /** Cumulative net trading P&L up to this point. */
  cumulativePnl: number;
  /** Cumulative external cashflow (initial + deposits − withdrawals). */
  cumulativeCashflow: number;
  /** Total equity = cashflow + cumulativePnl. */
  equity: number;
  /** Net P&L realized on this date alone (0 if a pure cashflow event). */
  dailyPnl: number;
  /** Cashflow event delta on this date alone. */
  cashflowDelta: number;
  /** Optional cashflow-event marker (only set on cashflow days). */
  cashflowKind?: CashflowKind;
  cashflowAmount?: number;
  cashflowNote?: string | null;
  tradesClosed: number;
}

interface PnlBucket {
  kind: "pnl";
  dailyPnl: number;
  tradesClosed: number;
}
interface CashflowBucket {
  kind: "cashflow";
  delta: number;
  cashflowKind: CashflowKind;
  amount: number;
  note: string | null;
}

export interface PnlDaily {
  date: Date;
  netPnl: number;
  tradesClosed: number;
}

function dayKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
function fromKey(k: string): Date {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/**
 * Build a unified equity curve combining daily trading P&L with capital
 * events. Cashflow days carry the marker metadata so charts can annotate.
 */
export function buildCapitalAdjustedEquityCurve(
  pnlDays: PnlDaily[],
  capitalEvents: CapitalEvent[],
): CapitalAdjustedPoint[] {
  const buckets = new Map<string, { pnl?: PnlBucket; flows: CashflowBucket[] }>();

  for (const p of pnlDays) {
    const k = dayKey(p.date);
    const slot = buckets.get(k) ?? { flows: [] };
    slot.pnl = { kind: "pnl", dailyPnl: p.netPnl, tradesClosed: p.tradesClosed };
    buckets.set(k, slot);
  }

  for (const ev of sortEvents(capitalEvents)) {
    const k = ev.eventDate;
    const slot = buckets.get(k) ?? { flows: [] };
    slot.flows.push({
      kind: "cashflow",
      delta: signedAmount(ev),
      cashflowKind: ev.eventType,
      amount: Number(ev.amount) || 0,
      note: ev.notes,
    });
    buckets.set(k, slot);
  }

  const keys = [...buckets.keys()].sort();
  let cumPnl = 0;
  let cumCash = 0;
  const out: CapitalAdjustedPoint[] = [];

  for (const k of keys) {
    const slot = buckets.get(k)!;
    const dailyPnl = slot.pnl?.dailyPnl ?? 0;
    cumPnl += dailyPnl;
    const flowDelta = slot.flows.reduce((a, f) => a + f.delta, 0);
    cumCash += flowDelta;

    // Emit the day point (post-flows, post-pnl).
    const point: CapitalAdjustedPoint = {
      date: fromKey(k),
      cumulativePnl: cumPnl,
      cumulativeCashflow: cumCash,
      equity: cumCash + cumPnl,
      dailyPnl,
      cashflowDelta: flowDelta,
      tradesClosed: slot.pnl?.tradesClosed ?? 0,
    };
    if (slot.flows.length) {
      // Use the largest absolute flow as the marker (typical case: 1 per day).
      const primary = slot.flows.reduce((a, b) =>
        Math.abs(b.delta) > Math.abs(a.delta) ? b : a,
      );
      point.cashflowKind = primary.cashflowKind;
      point.cashflowAmount = primary.amount;
      point.cashflowNote = primary.note;
    }
    out.push(point);
  }

  return out;
}

export interface CapitalAdjustedReturn {
  /** Net trading P&L over the curve. */
  netTradingPnl: number;
  /** Total external cashflow (initial + deposits − withdrawals). */
  netCashflow: number;
  /** Final equity at the end of the curve. */
  endingEquity: number;
  /**
   * Capital base for return calculation: average deployed capital across
   * the curve (time-weighted). Returns null if no capital was ever deployed.
   */
  averageCapital: number | null;
  /** netTradingPnl / averageCapital. null when base is 0. */
  capitalAdjustedReturn: number | null;
  /**
   * Time-weighted return: chains daily returns over deployed capital,
   * neutralizing the impact of deposits/withdrawals. null if undefined.
   */
  timeWeightedReturn: number | null;
}

/**
 * Compute capital-adjusted return metrics from a unified curve.
 * Deposits and withdrawals are excluded from the return numerator;
 * average deployed capital is the denominator.
 */
export function computeCapitalAdjustedReturn(
  curve: CapitalAdjustedPoint[],
): CapitalAdjustedReturn {
  if (!curve.length) {
    return {
      netTradingPnl: 0,
      netCashflow: 0,
      endingEquity: 0,
      averageCapital: null,
      capitalAdjustedReturn: null,
      timeWeightedReturn: null,
    };
  }
  const last = curve[curve.length - 1];

  // Average capital deployed across the curve, weighted by # of points.
  let capitalSum = 0;
  let capitalCount = 0;
  for (const p of curve) {
    if (p.cumulativeCashflow > 0) {
      capitalSum += p.cumulativeCashflow;
      capitalCount += 1;
    }
  }
  const averageCapital = capitalCount ? capitalSum / capitalCount : null;

  // Time-weighted return: chain (1 + dailyPnl / capitalBeforeFlow) per day.
  let twrFactor = 1;
  let twrValid = false;
  let prevCash = 0;
  let prevEquity = 0;
  for (let i = 0; i < curve.length; i++) {
    const p = curve[i];
    // Capital base at the START of this day (before today's flow).
    const baseEquity = i === 0 ? p.cumulativeCashflow - p.cashflowDelta : prevEquity;
    if (baseEquity > 0 && p.dailyPnl !== 0) {
      twrFactor *= 1 + p.dailyPnl / baseEquity;
      twrValid = true;
    } else if (baseEquity > 0) {
      twrFactor *= 1;
      twrValid = true;
    }
    prevCash = p.cumulativeCashflow;
    prevEquity = p.equity;
  }
  // Suppress unused-var warnings without changing math.
  void prevCash;

  return {
    netTradingPnl: last.cumulativePnl,
    netCashflow: last.cumulativeCashflow,
    endingEquity: last.equity,
    averageCapital,
    capitalAdjustedReturn:
      averageCapital && averageCapital > 0
        ? last.cumulativePnl / averageCapital
        : null,
    timeWeightedReturn: twrValid ? twrFactor - 1 : null,
  };
}
