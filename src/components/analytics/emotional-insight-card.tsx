import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Sparkles } from "lucide-react";
import type { EmotionalAnalyticsBucket } from "@/types/analytics";
import { formatPercent } from "@/lib/analytics/format";
import { formatINR } from "@/lib/trades/calculations";
import { AnalyticsEmptyState } from "./analytics-empty-state";

interface Props {
  title: string;
  description?: string;
  /** What does score 1..5 mean to the user (low/high)? */
  scaleLow?: string;
  scaleHigh?: string;
  buckets: EmotionalAnalyticsBucket[];
}

export function EmotionalInsightCard({
  title,
  description,
  scaleLow,
  scaleHigh,
  buckets,
}: Props) {
  const data = buckets.map((b) => ({
    score: b.score,
    avg: b.avgNetPnl,
    trades: b.trades,
    winRate: b.winRate,
  }));

  return (
    <div className="surface-card p-4 md:p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="text-sm font-medium">{title}</h3>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
        <Sparkles className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      </div>

      {data.length === 0 ? (
        <AnalyticsEmptyState
          icon={Sparkles}
          title="No emotional data yet"
          description="Use the sliders when logging trades to surface this."
          compact
        />
      ) : (
        <>
          <div style={{ width: "100%", height: 140 }}>
            <ResponsiveContainer>
              <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <XAxis
                  dataKey="score"
                  stroke="var(--color-muted-foreground)"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis hide />
                <Tooltip
                  cursor={{ fill: "var(--color-muted)", opacity: 0.4 }}
                  contentStyle={{
                    background: "var(--color-popover)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(_v, _n, item: { payload?: typeof data[number] }) => [
                    `${formatINR(item.payload?.avg ?? 0)} · ${item.payload?.trades ?? 0} trades · ${formatPercent(item.payload?.winRate ?? null)}`,
                    `Score ${item.payload?.score}`,
                  ]}
                  labelFormatter={() => ""}
                />
                <Bar dataKey="avg" radius={[4, 4, 0, 0]}>
                  {data.map((d) => (
                    <Cell
                      key={d.score}
                      fill={d.avg >= 0 ? "var(--color-success)" : "var(--color-destructive)"}
                      fillOpacity={0.85}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {(scaleLow || scaleHigh) && (
            <div className="flex justify-between text-[10px] text-muted-foreground mt-2 px-1">
              <span>{scaleLow}</span>
              <span>{scaleHigh}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
