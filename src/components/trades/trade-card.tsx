import { format } from "date-fns";
import { ArrowDownRight, ArrowUpRight, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  disciplineScore,
  formatINR,
  netPnl,
  rMultiple,
  type DisciplineRow,
  type ExitRow,
  type TradeRow,
} from "@/lib/trades/calculations";

interface TradeCardProps {
  trade: TradeRow;
  exits: ExitRow[];
  discipline: DisciplineRow[];
  onClick?: () => void;
}

export function TradeCard({ trade, exits, discipline, onClick }: TradeCardProps) {
  const pnl = netPnl(trade, exits);
  const r = rMultiple(trade, exits);
  const ds = disciplineScore(discipline);
  const isProfit = pnl >= 0;
  const long = trade.side === "long";

  return (
    <button
      type="button"
      onClick={onClick}
      className="surface-card text-left w-full p-4 md:p-5 hover:border-primary/40 transition-colors group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display font-semibold tracking-tight text-base md:text-lg">{trade.symbol}</span>
            <Badge variant="secondary" className="eyebrow">
              {trade.instrument_type}
            </Badge>
            <span
              className={cn(
                "inline-flex items-center gap-0.5 text-[11px] font-medium px-1.5 py-0.5 rounded font-mono",
                long ? "text-success bg-success/10" : "text-destructive bg-destructive/10",
              )}
            >
              {long ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {long ? "Long" : "Short"}
            </span>
            <Badge variant="outline" className="eyebrow">
              {trade.status}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1 font-mono">
            {format(new Date(trade.entry_date), "dd MMM yyyy · HH:mm")}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p
            className={cn(
              "font-display text-base md:text-lg font-semibold tabular-nums",
              isProfit ? "text-success" : "text-destructive",
            )}
          >
            {formatINR(pnl)}
          </p>
          {r !== null && (
            <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums font-mono">
              {r >= 0 ? "+" : ""}
              {r.toFixed(2)}R
            </p>
          )}
        </div>

      </div>

      <div className="mt-3 flex items-center gap-3 flex-wrap">
        {ds !== null && (
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3 w-3" />
            Discipline {ds}%
          </span>
        )}
        {(trade.tags ?? []).slice(0, 4).map((t) => (
          <Badge key={t} variant="outline" className="text-[10px]">
            {t}
          </Badge>
        ))}
        {(trade.tags?.length ?? 0) > 4 && (
          <span className="text-[10px] text-muted-foreground">
            +{(trade.tags?.length ?? 0) - 4}
          </span>
        )}
      </div>
    </button>
  );
}
