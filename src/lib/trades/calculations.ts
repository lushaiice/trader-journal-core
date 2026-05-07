import type { Tables } from "@/integrations/supabase/types";

export type TradeRow = Tables<"trades">;
export type ExitRow = Tables<"trade_exits">;
export type DisciplineRow = Tables<"discipline_logs">;

/** Total quantity exited across all partial exits. */
export function totalExitQty(exits: Pick<ExitRow, "quantity">[]): number {
  return exits.reduce((a, e) => a + Number(e.quantity || 0), 0);
}

/** Quantity still open on a trade. */
export function remainingQty(
  entryQty: number,
  exits: Pick<ExitRow, "quantity">[],
): number {
  return Math.max(0, Number(entryQty || 0) - totalExitQty(exits));
}

/** Quantity-weighted average exit price. Returns null if nothing exited. */
export function weightedAvgExit(
  exits: Pick<ExitRow, "exit_price" | "quantity">[],
): number | null {
  const qty = totalExitQty(exits);
  if (qty <= 0) return null;
  const notional = exits.reduce(
    (a, e) => a + Number(e.exit_price || 0) * Number(e.quantity || 0),
    0,
  );
  return notional / qty;
}

export function tradeStatus(
  trade: Pick<TradeRow, "quantity">,
  exits: Pick<ExitRow, "quantity">[],
): "open" | "partial" | "closed" {
  const filled = totalExitQty(exits);
  const qty = Number(trade.quantity);
  if (filled <= 0) return "open";
  if (filled >= qty) return "closed";
  return "partial";
}

/** Gross P&L before fees, signed by side. */
export function grossPnl(trade: TradeRow, exits: ExitRow[]): number {
  const sign = trade.side === "long" ? 1 : -1;
  return exits.reduce(
    (acc, e) =>
      acc +
      (Number(e.exit_price) - Number(trade.entry_price)) *
        Number(e.quantity) *
        sign,
    0,
  );
}

/** Total fees: entry costs + per-exit fees. */
export function totalFees(trade: TradeRow, exits: ExitRow[]): number {
  const entryFees =
    (Number(trade.brokerage) || 0) +
    (Number(trade.taxes) || 0) +
    (Number(trade.other_fees) || 0);
  const exitFees = exits.reduce((a, e) => a + (Number(e.fees) || 0), 0);
  return entryFees + exitFees;
}

export function netPnl(trade: TradeRow, exits: ExitRow[]): number {
  return grossPnl(trade, exits) - totalFees(trade, exits);
}

/** Per-unit risk based on stop loss (actual or planned). */
export function riskPerUnit(trade: TradeRow): number | null {
  const sl = trade.stop_loss ?? trade.planned_stop_loss;
  if (sl == null) return null;
  const r = Math.abs(Number(trade.entry_price) - Number(sl));
  return r === 0 ? null : r;
}

/** Total INR at risk = risk/unit * planned quantity. */
export function riskAmount(trade: TradeRow): number | null {
  const r = riskPerUnit(trade);
  if (r == null) return null;
  return r * Number(trade.quantity);
}

/** Notional position exposure at entry. */
export function positionExposure(trade: TradeRow): number {
  return Number(trade.entry_price) * Number(trade.quantity);
}

export function rMultiple(trade: TradeRow, exits: ExitRow[]): number | null {
  const r = riskPerUnit(trade);
  if (r == null) return null;
  const avg = weightedAvgExit(exits);
  if (avg == null) return null;
  const sign = trade.side === "long" ? 1 : -1;
  return ((avg - Number(trade.entry_price)) * sign) / r;
}

export function disciplineScore(logs: DisciplineRow[]): number | null {
  if (!logs.length) return null;
  const NEGATIVE = new Set(["Overtraded", "Emotional trade"]);
  const score = logs.reduce((a, l) => {
    const good = NEGATIVE.has(l.rule) ? !l.followed : l.followed;
    return a + (good ? 1 : 0);
  }, 0);
  return Math.round((score / logs.length) * 100);
}

export function formatINR(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n);
}
