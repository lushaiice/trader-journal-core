import type { Tables } from "@/integrations/supabase/types";

export type TradeRow = Tables<"trades">;
export type ExitRow = Tables<"trade_exits">;
export type DisciplineRow = Tables<"discipline_logs">;

export function tradeStatus(trade: TradeRow, exits: ExitRow[]): "open" | "partial" | "closed" {
  const filled = exits.reduce((a, e) => a + Number(e.quantity), 0);
  const qty = Number(trade.quantity);
  if (filled <= 0) return "open";
  if (filled >= qty) return "closed";
  return "partial";
}

export function netPnl(trade: TradeRow, exits: ExitRow[]): number {
  const sign = trade.side === "long" ? 1 : -1;
  const grossPerUnit = exits.reduce(
    (acc, e) => acc + (Number(e.exit_price) - Number(trade.entry_price)) * Number(e.quantity) * sign,
    0,
  );
  const fees = (Number(trade.brokerage) || 0) + (Number(trade.taxes) || 0) + (Number(trade.other_fees) || 0);
  const exitFees = exits.reduce((a, e) => a + (Number(e.fees) || 0), 0);
  return grossPerUnit - fees - exitFees;
}

export function rMultiple(trade: TradeRow, exits: ExitRow[]): number | null {
  const sl = trade.stop_loss ?? trade.planned_stop_loss;
  if (!sl) return null;
  const risk = Math.abs(Number(trade.entry_price) - Number(sl));
  if (risk === 0) return null;
  const filled = exits.reduce((a, e) => a + Number(e.quantity), 0) || 1;
  const avgExit = exits.reduce((a, e) => a + Number(e.exit_price) * Number(e.quantity), 0) / filled;
  const sign = trade.side === "long" ? 1 : -1;
  return ((avgExit - Number(trade.entry_price)) * sign) / risk;
}

export function disciplineScore(logs: DisciplineRow[]): number | null {
  if (!logs.length) return null;
  // Negative rules invert: "Overtraded" followed=true is bad.
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
