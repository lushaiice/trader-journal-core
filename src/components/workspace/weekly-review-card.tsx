import { format } from "date-fns";
import { cn } from "@/lib/utils";

export interface WeeklySummary {
  weekStart: Date;
  weekEnd: Date;
  trades: number;
  netPnl: number;
  winRate: number | null;
  avgDiscipline: number | null;
  avgEmotional: number | null;
  avgProcess: number | null;
  bestSetups: { tag: string; netPnl: number }[];
  worstSetups: { tag: string; netPnl: number }[];
  brokenRules: { rule: string; count: number }[];
}

export function WeeklyReviewCard({ summary }: { summary: WeeklySummary }) {
  return (
    <div className="surface-card p-6 md:p-8 space-y-6">
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wider">Week of</p>
        <h2 className="text-xl font-semibold mt-1">
          {format(summary.weekStart, "MMM d")} – {format(summary.weekEnd, "MMM d, yyyy")}
        </h2>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Trades" value={summary.trades.toString()} />
        <Stat
          label="Net P&L"
          value={`${summary.netPnl > 0 ? "+" : ""}${Math.round(summary.netPnl).toLocaleString("en-IN")}`}
          tone={summary.netPnl > 0 ? "good" : summary.netPnl < 0 ? "bad" : undefined}
        />
        <Stat
          label="Win rate"
          value={summary.winRate != null ? `${Math.round(summary.winRate * 100)}%` : "—"}
        />
        <Stat
          label="Process"
          value={summary.avgProcess != null ? `${summary.avgProcess}` : "—"}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ListBlock title="Best setups" items={summary.bestSetups.map((s) => ({
          label: s.tag,
          value: `${s.netPnl > 0 ? "+" : ""}${Math.round(s.netPnl).toLocaleString("en-IN")}`,
          tone: s.netPnl > 0 ? "good" : "bad",
        }))} />
        <ListBlock title="Worst setups" items={summary.worstSetups.map((s) => ({
          label: s.tag,
          value: `${Math.round(s.netPnl).toLocaleString("en-IN")}`,
          tone: "bad",
        }))} />
      </div>

      {summary.brokenRules.length > 0 && (
        <ListBlock
          title="Most broken rules"
          items={summary.brokenRules.map((r) => ({
            label: r.rule,
            value: `${r.count}×`,
            tone: "bad",
          }))}
        />
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
}) {
  return (
    <div className="rounded-md border border-border bg-muted/20 p-3">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p
        className={cn(
          "text-lg font-semibold tabular-nums mt-1",
          tone === "good" && "text-success",
          tone === "bad" && "text-destructive",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function ListBlock({
  title,
  items,
}: {
  title: string;
  items: { label: string; value: string; tone?: "good" | "bad" }[];
}) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">{title}</p>
      <ul className="space-y-1">
        {items.length === 0 && (
          <li className="text-xs text-muted-foreground">Not enough data yet.</li>
        )}
        {items.map((it) => (
          <li
            key={it.label}
            className="flex items-center justify-between rounded-md border border-border bg-muted/20 px-3 py-2 text-sm"
          >
            <span className="truncate">{it.label}</span>
            <span
              className={cn(
                "tabular-nums font-medium",
                it.tone === "good" && "text-success",
                it.tone === "bad" && "text-destructive",
              )}
            >
              {it.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
