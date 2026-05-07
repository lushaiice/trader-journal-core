import { useMemo, useState } from "react";
import { ArrowUpDown, Tag as TagIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatINR } from "@/lib/trades/calculations";
import { formatPercent, formatRMultiple } from "@/lib/analytics/format";
import type { TagAnalytics } from "@/types/analytics";
import { AnalyticsEmptyState } from "./analytics-empty-state";

type SortKey = "netPnl" | "winRate" | "trades" | "avgRMultiple";

interface Props {
  data: TagAnalytics[];
}

export function TagAnalyticsTable({ data }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("netPnl");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const rows = useMemo(() => {
    const copy = [...data];
    copy.sort((a, b) => {
      const av = (a[sortKey] as number | null) ?? -Infinity;
      const bv = (b[sortKey] as number | null) ?? -Infinity;
      return dir === "desc" ? bv - av : av - bv;
    });
    return copy;
  }, [data, sortKey, dir]);

  if (!data.length) {
    return (
      <AnalyticsEmptyState
        icon={TagIcon}
        title="No tag insights yet"
        description="Tag your trades by setup to see which ones are working."
      />
    );
  }

  const sortBtn = (key: SortKey, label: string, align: "left" | "right" = "right") => (
    <button
      type="button"
      onClick={() => {
        if (sortKey === key) setDir(dir === "desc" ? "asc" : "desc");
        else {
          setSortKey(key);
          setDir("desc");
        }
      }}
      className={cn(
        "inline-flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors",
        align === "right" && "justify-end w-full",
      )}
    >
      {label}
      <ArrowUpDown className={cn("h-3 w-3", sortKey === key && "text-primary")} />
    </button>
  );

  return (
    <div className="surface-card overflow-hidden">
      {/* Desktop table */}
      <div className="hidden md:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/30">
            <tr>
              <th className="text-left px-4 py-2.5 font-normal">
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Setup
                </span>
              </th>
              <th className="px-4 py-2.5 text-right">{sortBtn("trades", "Trades")}</th>
              <th className="px-4 py-2.5 text-right">{sortBtn("winRate", "Win rate")}</th>
              <th className="px-4 py-2.5 text-right">{sortBtn("avgRMultiple", "Avg R")}</th>
              <th className="px-4 py-2.5 text-right">{sortBtn("netPnl", "Net P&L")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.tag} className="border-t border-border/60">
                <td className="px-4 py-3 font-medium">{r.tag}</td>
                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                  {r.trades}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{formatPercent(r.winRate)}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatRMultiple(r.avgRMultiple)}
                </td>
                <td
                  className={cn(
                    "px-4 py-3 text-right tabular-nums font-medium",
                    r.netPnl >= 0 ? "text-success" : "text-destructive",
                  )}
                >
                  {formatINR(r.netPnl)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className="md:hidden divide-y divide-border/60">
        {rows.map((r) => (
          <li key={r.tag} className="px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{r.tag}</p>
              <p className="text-[11px] text-muted-foreground tabular-nums">
                {r.trades} trades · {formatPercent(r.winRate)} · {formatRMultiple(r.avgRMultiple)}
              </p>
            </div>
            <p
              className={cn(
                "text-sm font-semibold tabular-nums shrink-0",
                r.netPnl >= 0 ? "text-success" : "text-destructive",
              )}
            >
              {formatINR(r.netPnl)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
