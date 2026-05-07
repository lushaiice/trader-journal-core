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
import { LineChart } from "lucide-react";
import { formatINR } from "@/lib/trades/calculations";
import type { EquityPoint } from "@/types/analytics";
import { AnalyticsEmptyState } from "./analytics-empty-state";

interface Props {
  data: EquityPoint[];
  baseCapital?: number;
  height?: number;
}

function shortINR(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_00_00_000) return `${(n / 1_00_00_000).toFixed(1)}Cr`;
  if (abs >= 1_00_000) return `${(n / 1_00_000).toFixed(1)}L`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toFixed(0);
}

export function EquityCurveChart({ data, baseCapital = 0, height = 280 }: Props) {
  const series = useMemo(
    () =>
      data.map((p) => ({
        ts: p.date.getTime(),
        equity: p.equity,
        pnl: p.cumulativePnl,
      })),
    [data],
  );

  if (!series.length) {
    return (
      <AnalyticsEmptyState
        icon={LineChart}
        title="Equity curve will appear once you close trades"
        description="As exits accumulate, your cumulative P&L plots here."
      />
    );
  }

  const useEquity = baseCapital > 0;
  const dataKey = useEquity ? "equity" : "pnl";

  return (
    <div className="surface-card p-4 md:p-5">
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer>
          <AreaChart data={series} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
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
              tickFormatter={shortINR}
              width={56}
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
              formatter={(value: number) => [formatINR(value), useEquity ? "Equity" : "Cum. P&L"]}
            />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke="var(--color-primary)"
              strokeWidth={2}
              fill="url(#equityFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
