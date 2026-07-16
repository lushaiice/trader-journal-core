import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format } from "date-fns";
import { BENCHMARK_INDICES, useIndexSeries, useSymbolPriceHistory } from "@/lib/market/api";
import { buildDailyTotalPnl } from "@/lib/portfolio/mtm-curve";
import {
  buildEquitySeries,
  computeRollingRisk,
  dailyReturns,
  drawdownSeries,
  indexDailyReturns,
  type RollingRiskPoint,
} from "@/lib/portfolio/risk-series";
import { useUserSettings, DEFAULT_USER_SETTINGS } from "@/lib/settings/api";
import type { NormalizedTrade } from "@/types/analytics";
import { cn } from "@/lib/utils";

interface Props {
  trades: NormalizedTrade[];
  capitalBase: number;
  inceptionDate: string | null;
}

const MIN_OBS = 20;

function fmtPct(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${(v * 100).toFixed(2)}%`;
}
function fmtNum(v: number | null, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(digits);
}

export function RiskCharts({ trades, capitalBase, inceptionDate }: Props) {
  const [indexCode, setIndexCode] = useState("NIFTY50");
  const settings = useUserSettings();
  const rf = settings.data?.risk_free_rate ?? DEFAULT_USER_SETTINGS.risk_free_rate;

  const equitySymbols = useMemo(() => {
    const s = new Set<string>();
    for (const t of trades) {
      if (String(t.raw.trade.instrument_type ?? "equity") === "equity") s.add(t.symbol);
    }
    return Array.from(s);
  }, [trades]);

  const historyQuery = useSymbolPriceHistory(equitySymbols, inceptionDate ?? undefined);
  const indexQuery = useIndexSeries(indexCode, inceptionDate ?? undefined);

  const equity = useMemo(() => {
    const pnl = buildDailyTotalPnl({
      trades,
      priceHistoryBySymbol: historyQuery.data ?? {},
      fromDate: inceptionDate,
      toDate: null,
    });
    return buildEquitySeries(pnl, capitalBase);
  }, [trades, historyQuery.data, inceptionDate, capitalBase]);

  const portReturns = useMemo(() => dailyReturns(equity), [equity]);
  const benchReturns = useMemo(() => indexDailyReturns(indexQuery.data ?? []), [indexQuery.data]);

  const rolling = useMemo(
    () => computeRollingRisk(portReturns, benchReturns, rf, MIN_OBS),
    [portReturns, benchReturns, rf],
  );

  const dd = useMemo(() => drawdownSeries(equity), [equity]);

  if (capitalBase <= 0) {
    return (
      <section className="mb-8">
        <SectionHeader />
        <div className="surface-card p-8 text-center text-sm text-muted-foreground">
          Set an initial capital event to compute portfolio risk.
        </div>
      </section>
    );
  }

  const observations = portReturns.length;
  const insufficient = observations < MIN_OBS;

  return (
    <section className="mb-8">
      <SectionHeader />

      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 text-[11px] text-muted-foreground">
        <span>
          Rolling since inception · rf {rf.toFixed(1)}% · edit in{" "}
          <a href="/settings" className="underline underline-offset-2 hover:text-foreground">
            Settings
          </a>
        </span>
        <span>Market data from Yahoo Finance — end-of-day, delayed.</span>
      </div>

      {insufficient ? (
        <div className="surface-card p-8 text-center text-sm text-muted-foreground">
          Needs ~{MIN_OBS} trading days since inception to compute risk metrics.
          {observations > 0 ? ` Currently ${observations}.` : ""}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          <RiskChartCard
            title="Sharpe"
            latest={latestOf(rolling, "sharpe")}
            format="num"
            explain="Excess return per unit of total volatility. (Annual return − rf) ÷ annualized stdev of daily returns."
            data={rolling.map((p) => ({ ts: new Date(p.date).getTime(), v: p.sharpe }))}
            stroke="var(--color-primary)"
          />
          <RiskChartCard
            title="Sortino"
            latest={latestOf(rolling, "sortino")}
            format="num"
            explain="Excess return per unit of downside volatility. Only penalises negative daily returns."
            data={rolling.map((p) => ({ ts: new Date(p.date).getTime(), v: p.sortino }))}
            stroke="var(--color-primary)"
          />
          <RiskChartCard
            title="Volatility"
            latest={latestOf(rolling, "volatility")}
            format="pct"
            explain="Annualised standard deviation of daily portfolio returns."
            data={rolling.map((p) => ({ ts: new Date(p.date).getTime(), v: p.volatility }))}
            stroke="var(--color-accent)"
            valueSuffix="%"
            yAsPct
          />
          <RiskChartCard
            title="Beta"
            latest={latestOf(rolling, "beta")}
            format="num"
            explain="Sensitivity of daily portfolio return to the selected index. 1.0 = moves with the market."
            data={rolling.map((p) => ({ ts: new Date(p.date).getTime(), v: p.beta }))}
            stroke="var(--color-primary)"
            headerRight={
              <select
                value={indexCode}
                onChange={(e) => setIndexCode(e.target.value)}
                className="text-[10px] rounded-md border border-border bg-card/50 px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary"
                aria-label="Beta benchmark index"
              >
                {BENCHMARK_INDICES.map((i) => (
                  <option key={i.code} value={i.code}>
                    {i.displayName}
                  </option>
                ))}
              </select>
            }
          />
          <RiskChartCard
            title="Drawdown"
            latest={dd.series.length ? dd.series[dd.series.length - 1].drawdown : null}
            format="pct"
            explain="Percentage decline from the equity curve's running peak. Underwater = below zero."
            data={dd.series.map((p) => ({ ts: new Date(p.date).getTime(), v: p.drawdown }))}
            stroke="var(--color-destructive)"
            area
            yAsPct
            valueSuffix="%"
            footer={`Max drawdown ${fmtPct(dd.maxDrawdown)}`}
          />
        </div>
      )}
    </section>
  );
}

function SectionHeader() {
  return (
    <div className="mb-3">
      <h2 className="eyebrow mb-1">Risk</h2>
      <p className="text-xs text-muted-foreground">
        Rolling since-inception metrics from your daily equity curve (capital + realized +
        unrealized).
      </p>
    </div>
  );
}

function latestOf(rows: RollingRiskPoint[], key: keyof RollingRiskPoint): number | null {
  for (let i = rows.length - 1; i >= 0; i--) {
    const v = rows[i][key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return null;
}

interface RiskChartCardProps {
  title: string;
  latest: number | null;
  format: "num" | "pct";
  explain: string;
  data: { ts: number; v: number | null }[];
  stroke: string;
  area?: boolean;
  yAsPct?: boolean;
  valueSuffix?: string;
  headerRight?: React.ReactNode;
  footer?: string;
}

function RiskChartCard({
  title,
  latest,
  format: fmt,
  explain,
  data,
  stroke,
  area,
  yAsPct,
  headerRight,
  footer,
}: RiskChartCardProps) {
  const headline = fmt === "pct" ? fmtPct(latest) : fmtNum(latest, 2);
  const tone =
    title === "Drawdown"
      ? "text-destructive"
      : latest == null
        ? "text-muted-foreground"
        : latest > 0
          ? "text-foreground"
          : latest < 0
            ? "text-destructive"
            : "text-foreground";

  return (
    <div className="surface-card p-4 flex flex-col">
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="eyebrow text-muted-foreground">{title}</span>
        {headerRight}
      </div>
      <p className={cn("font-display text-2xl font-semibold tabular-nums tracking-tight", tone)}>
        {headline}
      </p>
      <p className="text-[11px] text-muted-foreground mt-1 mb-2 leading-snug">{explain}</p>
      <div style={{ width: "100%", height: 140 }}>
        <ResponsiveContainer>
          {area ? (
            <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--color-border)" strokeOpacity={0.25} vertical={false} />
              <XAxis
                dataKey="ts"
                type="number"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(v) => format(new Date(v), "MMM ''yy")}
                stroke="var(--color-muted-foreground)"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                minTickGap={40}
              />
              <YAxis
                stroke="var(--color-muted-foreground)"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                width={40}
                tickFormatter={(v) =>
                  yAsPct ? `${((v as number) * 100).toFixed(0)}%` : `${(v as number).toFixed(2)}`
                }
              />
              <Tooltip
                contentStyle={{
                  background: "var(--color-popover)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  fontSize: 11,
                }}
                labelFormatter={(v) => format(new Date(v as number), "dd MMM yyyy")}
                formatter={(value) => [
                  value == null || typeof value !== "number"
                    ? "—"
                    : yAsPct
                      ? `${(value * 100).toFixed(2)}%`
                      : value.toFixed(4),
                  title,
                ]}
              />
              <Area
                type="monotone"
                dataKey="v"
                stroke={stroke}
                fill={stroke}
                fillOpacity={0.15}
                strokeWidth={1.5}
                isAnimationActive={false}
                connectNulls
              />
            </AreaChart>
          ) : (
            <LineChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--color-border)" strokeOpacity={0.25} vertical={false} />
              <XAxis
                dataKey="ts"
                type="number"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(v) => format(new Date(v), "MMM ''yy")}
                stroke="var(--color-muted-foreground)"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                minTickGap={40}
              />
              <YAxis
                stroke="var(--color-muted-foreground)"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                width={40}
                tickFormatter={(v) =>
                  yAsPct ? `${((v as number) * 100).toFixed(0)}%` : `${(v as number).toFixed(2)}`
                }
              />
              <Tooltip
                contentStyle={{
                  background: "var(--color-popover)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  fontSize: 11,
                }}
                labelFormatter={(v) => format(new Date(v as number), "dd MMM yyyy")}
                formatter={(value) => [
                  value == null || typeof value !== "number"
                    ? "—"
                    : yAsPct
                      ? `${(value * 100).toFixed(2)}%`
                      : value.toFixed(4),
                  title,
                ]}
              />
              <Line
                type="monotone"
                dataKey="v"
                stroke={stroke}
                strokeWidth={1.75}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
      {footer && (
        <p className="text-[11px] text-muted-foreground mt-2 font-mono tabular-nums">{footer}</p>
      )}
    </div>
  );
}
