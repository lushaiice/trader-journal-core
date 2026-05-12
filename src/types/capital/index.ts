/** Capital domain types — pure, framework-independent. */

export type CapitalEventType = "initial" | "deposit" | "withdrawal";

export interface CapitalEvent {
  id: string;
  userId: string;
  eventType: CapitalEventType;
  /** Always non-negative; sign is implied by eventType. */
  amount: number;
  /** ISO date (YYYY-MM-DD) representing the event day. */
  eventDate: string;
  notes: string | null;
  createdAt: string;
}

/** Input for create/update — id/timestamps managed by service. */
export interface CapitalEventInput {
  eventType: CapitalEventType;
  amount: number;
  eventDate: string; // YYYY-MM-DD
  notes?: string | null;
}

/** A single point on the capital ledger after a deposit/withdrawal/initial. */
export interface CapitalLedgerPoint {
  date: Date;
  event: CapitalEvent;
  /** Signed delta to capital. (+ for deposit/initial, − for withdrawal) */
  signedDelta: number;
  /** Running deposited capital after this event. */
  runningCapital: number;
}

export interface CapitalSummary {
  initialCapital: number;
  totalDeposits: number;
  totalWithdrawals: number;
  /** initialCapital + deposits − withdrawals (excludes trading P&L). */
  netDeposited: number;
  events: number;
}
