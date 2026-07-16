import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format } from "date-fns";
import { BENCHMARK_INDICES, useIndexSeries, useSymbolPriceHistory } from "@/lib/market/api";
import { buildBenchmarkComparison, type PnlPoint } from "@/lib/portfolio/benchmark";
import { buildDailyTotalPnl } from "@/lib/portfolio/mtm-curve";
import type { NormalizedTrade } from "@/types/analytics";
import { cn } from "@/lib/utils";

type RangeKey = "1M" | "3M" | "1Y" | "INCEPTION" | "ALL" | "CUSTOM";

interface RangeDef {
  key: RangeKey;
  label: string;
}

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function relativeStart(range: RangeKey): string | null {
  const d = new Date();
  if (range === "1M") d.setMonth(d.getMonth() - 1);
  else if (range === "3M") d.setMonth(d.getMonth() - 3);
  else if (range === "1Y") d.setFullYear(d.getFullYear() - 1);
  else return null;
  return toIsoDate(d);
}

function fmtPct(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const s = (v * 100).toFixed(2);
  return `${v > 0 ? "+" : ""}${s}%`;
}

interface Props {
  trades: NormalizedTrade[];
  capitalBase: number;
  /** ISO 'YYYY-MM-DD' of first capital event, or null if none. */
  inceptionDate: string | null;
}

export function BenchmarkSection({ trades, capitalBase, inceptionDate }: Props) {
  const [indexCode, setIndexCode] = useState<string>("NIFTY50");
  const [range, setRange] = useState<RangeKey>("ALL");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");

  const ranges = useMemo<RangeDef[]>(() => {
    const base: RangeDef[] = [
      { key: "1M", label: "1M" },
      { key: "3M", label: "3M" },
      { key: "1Y", label: "1Y" },
    ];
    if (inceptionDate) base.push({ key: "INCEPTION", label: "Since inception" });
    base.push({ key: "ALL", label: "All" });
    base.push({ key: "CUSTOM", label: "Custom" });
    return base;
  }, [inceptionDate]);

  // If user is on INCEPTION but inceptionDate disappears, fall back to ALL
  useEffect(() => {
    if (range === "INCEPTION" && !inceptionDate) setRange("ALL");
  }, [range, inceptionDate]);

  const fromDate: string | null =
    range === "ALL"
      ? null
      : range === "INCEPTION"
        ? inceptionDate
        : range === "CUSTOM"
          ? customFrom || null
          : relativeStart(range);
  const toDate: string | null = range === "CUSTOM" ? customTo || null : null;

  const indexQuery = useIndexSeries(indexCode, fromDate ?? undefined);

  const equitySymbols = useMemo(() => {
    const s = new Set<string>();
    for (const t of trades) {
      if (String(t.raw.trade.instrument_type ?? "equity") === "equity") s.add(t.symbol);
    }
    return Array.from(s);
  }, [trades]);

  const historyQuery = useSymbolPriceHistory(equitySymbols, fromDate ?? undefined);

  const pnlByDate = useMemo<PnlPoint[]>(() => {
    const series = buildDailyTotalPnl({
      trades,
      priceHistoryBySymbol: historyQuery.data ?? {},
      fromDate,
      toDate,
    });
    return series.map((p) => ({ date: p.date, cumulativePnl: p.totalPnl }));
  }, [trades, historyQuery.data, fromDate, toDate]);

  const comparison = useMemo(
    () =>
      buildBenchmarkComparison({
        pnlByDate,
        indexSeries: indexQuery.data ?? [],
        capitalBase,
        fromDate,
        toDate,
      }),
    [pnlByDate, indexQuery.data, capitalBase, fromDate, toDate],
  );

  const indexMeta = BENCHMARK_INDICES.find((i) => i.code === indexCode);
  const indexName = indexMeta?.displayName ?? indexCode;

  const chartData = useMemo(
    () =>
      comparison.series.map((p) => ({
        ts: new Date(p.date).getTime(),
        portfolio: p.portfolioPct == null ? null : p.portfolioPct * 100,
        benchmark: p.benchmarkPct * 100,
      })),
    [comparison.series],
  );

  const relative = comparison.relative;
  const relTone =
    relative == null
      ? "text-muted-foreground"
      : relative > 0
        ? "text-success"
        : relative < 0
          ? "text-destructive"
          : "text-muted-foreground";

  const hasIndex = (indexQuery.data ?? []).length > 0;
  const noCapital = capitalBase <= 0;

  return (
    <section className="mb-8">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-3">
        <div>
          <h2 className="eyebrow mb-1">Benchmark</h2>
          <p className="text-xs text-muted-foreground">
            Portfolio line is total return — realized + unrealized (mark-to-market) — on capital.
            Benchmark uses EOD closes (Yahoo Finance).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={indexCode}
            onChange={(e) => setIndexCode(e.target.value)}
            className="text-xs rounded-md border border-border bg-card/50 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
            aria-label="Benchmark index"
          >
            {BENCHMARK_INDICES.map((i) => (
              <option key={i.code} value={i.code}>
                {i.displayName}
              </option>
            ))}
          </select>
          <div
            role="tablist"
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-card/50 p-1"
          >
            {ranges.map((r) => {
              const active = r.key === range;
              return (
                <button
                  key={r.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setRange(r.key)}
                  className={cn(
                    "px-2.5 py-1 text-[11px] font-medium rounded-md transition-all tabular-nums",
                    active
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                  )}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
          {range === "CUSTOM" && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <label className="flex items-center gap-1">
                From
                <input
                  type="date"
                  value={customFrom}
                  max={customTo || undefined}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="rounded-md border border-border bg-card/50 px-1.5 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  aria-label="Custom range start date"
                />
              </label>
              <label className="flex items-center gap-1">
                To
                <input
                  type="date"
                  value={customTo}
                  min={customFrom || undefined}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="rounded-md border border-border bg-card/50 px-1.5 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  aria-label="Custom range end date"
                />
              </label>
            </div>
          )}
        </div>
      </div>

      <div className="surface-card p-4 md:p-5">
        {noCapital ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Set an initial capital event to compare against a benchmark.
          </div>
        ) : !hasIndex ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Benchmark data pending — try Refresh.
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm mb-4 tabular-nums">
              <span>
                <span className="text-muted-foreground">Portfolio</span>{" "}
                <span className="font-mono font-medium">{fmtPct(comparison.portfolioReturn)}</span>
              </span>
              <span className="text-muted-foreground">·</span>
              <span>
                <span className="text-muted-foreground">{indexName}</span>{" "}
                <span className="font-mono font-medium">{fmtPct(comparison.benchmarkReturn)}</span>
              </span>
              <span className="text-muted-foreground">·</span>
              <span>
                <span className="text-muted-foreground">relative</span>{" "}
                <span className={cn("font-mono font-semibold", relTone)}>{fmtPct(relative)}</span>
              </span>
            </div>

            <div style={{ width: "100%", height: 280 }}>
              <ResponsiveContainer>
                <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid
                    stroke="var(--color-border)"
                    strokeOpacity={0.3}
                    vertical={false}
                  />
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
                    tickFormatter={(v) => `${(v as number).toFixed(0)}%`}
                    width={48}
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
                    formatter={(value, name) => [
                      value == null || typeof value !== "number" ? "—" : `${value.toFixed(2)}%`,
                      name === "portfolio" ? "Portfolio" : indexName,
                    ]}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11 }}
                    formatter={(v) => (v === "portfolio" ? "Portfolio" : indexName)}
                  />
                  <Line
                    type="monotone"
                    dataKey="portfolio"
                    stroke="var(--color-primary)"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="benchmark"
                    stroke="var(--color-muted-foreground)"
                    strokeWidth={2}
                    strokeDasharray="4 3"
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
