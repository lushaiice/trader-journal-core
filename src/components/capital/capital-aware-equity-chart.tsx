import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format } from "date-fns";
import { LineChart } from "lucide-react";
import { formatINR } from "@/lib/trades/calculations";
import type { CapitalAdjustedPoint } from "@/lib/capital";
import { AnalyticsEmptyState } from "@/components/analytics/analytics-empty-state";

interface Props {
  data: CapitalAdjustedPoint[];
  height?: number;
}

function shortINR(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_00_00_000) return `${(n / 1_00_00_000).toFixed(1)}Cr`;
  if (abs >= 1_00_000) return `${(n / 1_00_000).toFixed(1)}L`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toFixed(0);
}

export function CapitalAwareEquityChart({ data, height = 300 }: Props) {
  const series = useMemo(
    () =>
      data.map((p) => ({
        ts: p.date.getTime(),
        equity: p.equity,
        pnl: p.cumulativePnl,
        cashflow: p.cumulativeCashflow,
        cashflowDelta: p.cashflowDelta,
        cashflowKind: p.cashflowKind,
        cashflowAmount: p.cashflowAmount,
        cashflowNote: p.cashflowNote,
      })),
    [data],
  );

  if (!series.length) {
    return (
      <AnalyticsEmptyState
        icon={LineChart}
        title="Equity curve will appear once you log capital or close trades"
        description="Set your starting capital and log trades to see your true portfolio progression."
      />
    );
  }

  const cashflowMarkers = series.filter((p) => p.cashflowDelta !== 0);

  return (
    <div className="surface-card p-4 md:p-5">
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <h3 className="text-sm font-medium">Equity (capital-aware)</h3>
          <p className="text-[11px] text-muted-foreground">
            Solid line is total equity. Dots mark deposits and withdrawals.
          </p>
        </div>
      </div>
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer>
          <AreaChart data={series} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="capEquityFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.3} />
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
              formatter={(value: number, name) => {
                if (name === "equity") return [formatINR(value), "Equity"];
                return [formatINR(value), name];
              }}
            />
            <Area
              type="monotone"
              dataKey="equity"
              stroke="var(--color-primary)"
              strokeWidth={2}
              fill="url(#capEquityFill)"
            />
            {cashflowMarkers.map((m) => {
              const isWithdraw = (m.cashflowDelta ?? 0) < 0;
              return (
                <ReferenceDot
                  key={m.ts}
                  x={m.ts}
                  y={m.equity}
                  r={4}
                  fill={isWithdraw ? "hsl(var(--destructive))" : "rgb(16 185 129)"}
                  stroke="var(--color-background)"
                  strokeWidth={2}
                />
              );
            })}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {cashflowMarkers.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
          {cashflowMarkers.slice(-6).map((m) => (
            <span
              key={m.ts}
              className="inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-0.5"
            >
              <span
                className={
                  (m.cashflowDelta ?? 0) < 0 ? "text-destructive" : "text-emerald-500"
                }
              >
                {(m.cashflowDelta ?? 0) >= 0 ? "+" : "−"}
                {formatINR(Math.abs(m.cashflowDelta ?? 0))}
              </span>
              <span>· {format(new Date(m.ts), "dd MMM")}</span>
              {m.cashflowNote && <span className="opacity-70">· {m.cashflowNote}</span>}
            </span>
          ))}
        </div>
      )}
      <p className="mt-3 text-[10px] text-muted-foreground">
        Returns adjusted for external capital flows. Deposits and withdrawals are
        excluded from performance calculations.
      </p>
    </div>
  );
}
