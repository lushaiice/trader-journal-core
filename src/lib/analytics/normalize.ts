/**
 * Normalize raw trade rows + exits + discipline logs into a single
 * analytics-friendly shape. Pure functions, no React.
 */
import type {
  TradeRow,
  ExitRow,
  DisciplineRow,
} from "@/lib/trades/calculations";
import {
  grossPnl,
  netPnl,
  positionExposure,
  rMultiple,
  remainingQty,
  riskAmount,
  riskPerUnit,
  totalExitQty,
  totalFees,
  tradeStatus,
  weightedAvgExit,
} from "@/lib/trades/calculations";
import type { NormalizedTrade } from "@/types/analytics";
import type { TradeWithRelations } from "@/lib/trades/api";

function lastExitDate(exits: ExitRow[]): Date | null {
  if (!exits.length) return null;
  let max = 0;
  for (const e of exits) {
    const t = new Date(e.exit_date).getTime();
    if (t > max) max = t;
  }
  return max ? new Date(max) : null;
}

export function normalizeTrade(input: TradeWithRelations): NormalizedTrade {
  const { trade, exits, discipline } = input;
  const status = tradeStatus(trade, exits);
  const filled = totalExitQty(exits);
  const entryDate = new Date(trade.entry_date);
  const closeDate = status === "closed" ? lastExitDate(exits) : null;
  const holdingDurationMs =
    closeDate ? closeDate.getTime() - entryDate.getTime() : null;

  return {
    id: trade.id,
    symbol: trade.symbol,
    side: (trade.side as "long" | "short") ?? "long",
    status,
    entryDate,
    closeDate,
    entryPrice: Number(trade.entry_price),
    quantity: Number(trade.quantity),
    filledQty: filled,
    remainingQty: remainingQty(Number(trade.quantity), exits),
    avgExit: weightedAvgExit(exits),
    grossPnl: grossPnl(trade, exits),
    netPnl: netPnl(trade, exits),
    fees: totalFees(trade, exits),
    riskPerUnit: riskPerUnit(trade),
    riskAmount: riskAmount(trade),
    positionExposure: positionExposure(trade),
    rMultiple: rMultiple(trade, exits),
    holdingDurationMs,
    tags: trade.tags ?? [],
    confidence: trade.confidence,
    emotionLevel: trade.emotion_level,
    recoveryUrge: trade.recovery_urge,
    disciplineFeel: trade.discipline_feel,
    setupMatch: trade.setup_match,
    raw: { trade, exits, discipline },
  };
}

export function normalizeTrades(rows: TradeWithRelations[]): NormalizedTrade[] {
  return rows.map(normalizeTrade);
}

/** Per-exit realized P&L event, useful for equity curves. */
export interface ExitEvent {
  tradeId: string;
  date: Date;
  /** Net P&L attributed to this exit (gross minus prorated fees). */
  netPnl: number;
  grossPnl: number;
}

export function exitEvents(n: NormalizedTrade): ExitEvent[] {
  const { raw } = n;
  const sign = n.side === "long" ? 1 : -1;
  const totalQty = totalExitQty(raw.exits);
  const fees = n.fees;
  return raw.exits.map((e) => {
    const qty = Number(e.quantity);
    const gross =
      (Number(e.exit_price) - Number(raw.trade.entry_price)) * qty * sign;
    const feeShare = totalQty > 0 ? fees * (qty / totalQty) : 0;
    return {
      tradeId: n.id,
      date: new Date(e.exit_date),
      grossPnl: gross,
      netPnl: gross - feeShare,
    };
  });
}

export function allExitEvents(trades: NormalizedTrade[]): ExitEvent[] {
  return trades.flatMap(exitEvents).sort((a, b) => a.date.getTime() - b.date.getTime());
}
