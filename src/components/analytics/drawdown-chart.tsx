import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format } from "date-fns";
import { TrendingDown } from "lucide-react";
import type { DrawdownPoint } from "@/types/analytics";
import { formatPercent } from "@/lib/analytics/format";
import { AnalyticsEmptyState } from "./analytics-empty-state";

interface Props {
  data: DrawdownPoint[];
  height?: number;
}

export function DrawdownChart({ data, height = 220 }: Props) {
  const series = useMemo(
    () => data.map((p) => ({ ts: p.date.getTime(), dd: p.drawdownPct * 100 })),
    [data],
  );

  if (!series.length) {
    return (
      <AnalyticsEmptyState
        icon={TrendingDown}
        title="Drawdown chart appears as your equity evolves"
        description="We'll visualize underwater periods so you can see how you recover."
      />
    );
  }

  return (
    <div className="surface-card p-4 md:p-5">
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer>
          <AreaChart data={series} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="ddFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-destructive)" stopOpacity={0} />
                <stop offset="100%" stopColor="var(--color-destructive)" stopOpacity={0.35} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--color-border)" strokeOpacity={0.3} vertical={false} />
            <XAxis
              dataKey="ts"
              type="number"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(v) => format(new Date(v), "MMM d")}
              stroke="var(--color-muted-foreground)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              minTickGap={32}
            />
            <YAxis
              stroke="var(--color-muted-foreground)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v.toFixed(0)}%`}
              width={42}
              domain={["dataMin", 0]}
            />
            <Tooltip
              cursor={{ stroke: "var(--color-border)", strokeWidth: 1 }}
              contentStyle={{
                background: "var(--color-popover)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelFormatter={(v) => format(new Date(v as number), "dd MMM yyyy")}
              formatter={(value: number) => [formatPercent(value / 100), "Drawdown"]}
            />
            <Area
              type="monotone"
              dataKey="dd"
              stroke="var(--color-destructive)"
              strokeOpacity={0.8}
              strokeWidth={1.5}
              fill="url(#ddFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
