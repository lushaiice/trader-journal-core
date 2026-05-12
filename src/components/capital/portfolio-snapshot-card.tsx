import { ArrowDownLeft, ArrowUpRight, Banknote, TrendingUp } from "lucide-react";
import { formatINR } from "@/lib/trades/calculations";
import { formatPercent } from "@/lib/analytics/format";
import { cn } from "@/lib/utils";
import type { CapitalSummary } from "@/types/capital";

interface Props {
  summary: CapitalSummary;
  endingEquity: number;
  netTradingPnl: number;
  capitalAdjustedReturn: number | null;
}

export function PortfolioSnapshotCard({
  summary,
  endingEquity,
  netTradingPnl,
  capitalAdjustedReturn,
}: Props) {
  const items = [
    {
      label: "Current equity",
      value: formatINR(endingEquity),
      icon: TrendingUp,
      tone: "neutral" as const,
    },
    {
      label: "Net deposited",
      value: formatINR(summary.netDeposited),
      icon: Banknote,
      tone: "neutral" as const,
    },
    {
      label: "Net trading P&L",
      value: formatINR(netTradingPnl),
      icon: TrendingUp,
      tone: netTradingPnl >= 0 ? ("positive" as const) : ("negative" as const),
    },
    {
      label: "Adjusted return",
      value: formatPercent(capitalAdjustedReturn),
      icon: TrendingUp,
      tone:
        capitalAdjustedReturn != null && capitalAdjustedReturn >= 0
          ? ("positive" as const)
          : ("negative" as const),
    },
    {
      label: "Total deposits",
      value: formatINR(summary.initialCapital + summary.totalDeposits),
      icon: ArrowDownLeft,
      tone: "neutral" as const,
    },
    {
      label: "Total withdrawals",
      value: formatINR(summary.totalWithdrawals),
      icon: ArrowUpRight,
      tone: "neutral" as const,
    },
  ];

  return (
    <div className="surface-card p-4 md:p-5">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((it) => (
          <div key={it.label} className="space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <it.icon className="h-3 w-3" />
              {it.label}
            </div>
            <p
              className={cn(
                "text-base md:text-lg font-medium tabular-nums",
                it.tone === "positive" && "text-emerald-500",
                it.tone === "negative" && "text-destructive",
              )}
            >
              {it.value}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[10px] text-muted-foreground">
        Returns are adjusted for external capital flows. Deposits and withdrawals are
        excluded from performance calculations.
      </p>
    </div>
  );
}
