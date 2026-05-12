import { format } from "date-fns";
import { ArrowDownLeft, ArrowUpRight, Banknote, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/trades/calculations";
import { cn } from "@/lib/utils";
import type { CapitalLedgerPoint } from "@/types/capital";

interface Props {
  ledger: CapitalLedgerPoint[];
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function CapitalTimeline({ ledger, onEdit, onDelete }: Props) {
  if (!ledger.length) {
    return (
      <div className="text-xs text-muted-foreground py-6 text-center">
        No capital events yet. Add your starting capital to anchor analytics.
      </div>
    );
  }

  // Newest first for the visual list.
  const reversed = [...ledger].reverse();

  return (
    <ul className="divide-y divide-border/60">
      {reversed.map(({ event, signedDelta, runningCapital, date }) => {
        const isWithdraw = event.eventType === "withdrawal";
        const isInitial = event.eventType === "initial";
        const Icon = isInitial ? Banknote : isWithdraw ? ArrowUpRight : ArrowDownLeft;
        return (
          <li key={event.id} className="py-3 flex items-center gap-3">
            <div
              className={cn(
                "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                isInitial && "bg-muted text-muted-foreground",
                !isInitial && (isWithdraw ? "bg-destructive/10 text-destructive" : "bg-emerald-500/10 text-emerald-500"),
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-medium truncate">
                  {isInitial
                    ? "Starting capital"
                    : isWithdraw
                      ? "Withdrawal"
                      : "Deposit"}
                </p>
                <p
                  className={cn(
                    "text-sm tabular-nums",
                    signedDelta < 0 ? "text-destructive" : "text-emerald-500",
                  )}
                >
                  {signedDelta >= 0 ? "+" : "−"}
                  {formatINR(Math.abs(signedDelta))}
                </p>
              </div>
              <div className="flex items-center justify-between gap-2 mt-0.5">
                <p className="text-[11px] text-muted-foreground truncate">
                  {format(date, "dd MMM yyyy")}
                  {event.notes ? ` · ${event.notes}` : ""}
                </p>
                <p className="text-[11px] text-muted-foreground tabular-nums">
                  Bal · {formatINR(runningCapital)}
                </p>
              </div>
            </div>
            {(onEdit || onDelete) && (
              <div className="flex items-center gap-0.5 shrink-0">
                {onEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => onEdit(event.id)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
                {onDelete && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => onDelete(event.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
