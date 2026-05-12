/**
 * Pure helpers for normalizing and reasoning about capital events.
 * No React, no Supabase — safe to unit test.
 */
import type {
  CapitalEvent,
  CapitalEventType,
  CapitalLedgerPoint,
  CapitalSummary,
} from "@/types/capital";

/** Sign multiplier for an event type. Withdrawals are negative. */
export function eventSign(type: CapitalEventType): 1 | -1 {
  return type === "withdrawal" ? -1 : 1;
}

/** Signed delta to capital for an event (negative for withdrawals). */
export function signedAmount(event: Pick<CapitalEvent, "eventType" | "amount">): number {
  return eventSign(event.eventType) * Math.max(0, Number(event.amount) || 0);
}

/** Sort events chronologically (date asc, then createdAt asc as tiebreaker). */
export function sortEvents(events: CapitalEvent[]): CapitalEvent[] {
  return [...events].sort((a, b) => {
    const da = a.eventDate.localeCompare(b.eventDate);
    if (da !== 0) return da;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

/** Build a chronological capital ledger with running balance. */
export function buildCapitalLedger(events: CapitalEvent[]): CapitalLedgerPoint[] {
  const sorted = sortEvents(events);
  let running = 0;
  return sorted.map((event) => {
    const delta = signedAmount(event);
    running += delta;
    return {
      date: new Date(`${event.eventDate}T00:00:00Z`),
      event,
      signedDelta: delta,
      runningCapital: running,
    };
  });
}

/** Headline summary of capital flows. */
export function summarizeCapital(events: CapitalEvent[]): CapitalSummary {
  let initial = 0;
  let deposits = 0;
  let withdrawals = 0;
  for (const e of events) {
    const a = Math.max(0, Number(e.amount) || 0);
    if (e.eventType === "initial") initial += a;
    else if (e.eventType === "deposit") deposits += a;
    else if (e.eventType === "withdrawal") withdrawals += a;
  }
  return {
    initialCapital: initial,
    totalDeposits: deposits,
    totalWithdrawals: withdrawals,
    netDeposited: initial + deposits - withdrawals,
    events: events.length,
  };
}

/**
 * Capital deployed (net deposited) as of a given date — i.e. the cost basis
 * the trader had committed at that moment in time.
 */
export function capitalAt(events: CapitalEvent[], at: Date): number {
  const cutoff = at.getTime();
  let running = 0;
  for (const ev of sortEvents(events)) {
    const ts = new Date(`${ev.eventDate}T00:00:00Z`).getTime();
    if (ts > cutoff) break;
    running += signedAmount(ev);
  }
  return running;
}
