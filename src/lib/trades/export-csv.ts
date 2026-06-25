import type { TradeWithRelations } from "@/lib/trades/api";
import {
  grossPnl,
  netPnl,
  totalFees,
  totalExitQty,
  weightedAvgExit,
  tradeStatus,
} from "@/lib/trades/calculations";

const HEADERS = [
  "symbol",
  "instrument_type",
  "side",
  "status",
  "entry_date",
  "entry_time",
  "entry_price",
  "quantity",
  "exit_quantity",
  "avg_exit_price",
  "last_exit_date",
  "brokerage",
  "taxes",
  "other_fees",
  "total_fees",
  "gross_pnl",
  "net_pnl",
  "planned_entry",
  "planned_stop_loss",
  "planned_target",
  "stop_loss",
  "confidence",
  "emotion_level",
  "recovery_urge",
  "discipline_feel",
  "setup_match",
  "tags",
  "source",
  "notes",
] as const;

function esc(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function tradesToCsv(rows: TradeWithRelations[]): string {
  const lines: string[] = [HEADERS.join(",")];
  for (const { trade, exits } of rows) {
    const lastExit = exits
      .map((e) => e.exit_date)
      .filter(Boolean)
      .sort()
      .at(-1) ?? "";
    const tags = Array.isArray(trade.tags) ? trade.tags.join("|") : "";
    const record: Record<(typeof HEADERS)[number], unknown> = {
      symbol: trade.symbol,
      instrument_type: trade.instrument_type,
      side: trade.side,
      status: tradeStatus(trade, exits),
      entry_date: trade.entry_date,
      entry_time: trade.entry_time ?? "",
      entry_price: trade.entry_price,
      quantity: trade.quantity,
      exit_quantity: totalExitQty(exits),
      avg_exit_price: weightedAvgExit(exits) ?? "",
      last_exit_date: lastExit,
      brokerage: trade.brokerage ?? 0,
      taxes: trade.taxes ?? 0,
      other_fees: trade.other_fees ?? 0,
      total_fees: totalFees(trade, exits),
      gross_pnl: grossPnl(trade, exits),
      net_pnl: netPnl(trade, exits),
      planned_entry: trade.planned_entry ?? "",
      planned_stop_loss: trade.planned_stop_loss ?? "",
      planned_target: trade.planned_target ?? "",
      stop_loss: trade.stop_loss ?? "",
      confidence: trade.confidence ?? "",
      emotion_level: trade.emotion_level ?? "",
      recovery_urge: trade.recovery_urge ?? "",
      discipline_feel: trade.discipline_feel ?? "",
      setup_match: trade.setup_match ?? "",
      tags,
      source: trade.source ?? "",
      notes: trade.notes ?? "",
    };
    lines.push(HEADERS.map((h) => esc(record[h])).join(","));
  }
  return lines.join("\n");
}

export function downloadTradesCsv(rows: TradeWithRelations[], filename?: string) {
  const csv = tradesToCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const name =
    filename ?? `trades-${new Date().toISOString().slice(0, 10)}.csv`;
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
