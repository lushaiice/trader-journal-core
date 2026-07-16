/**
 * Benchmark overlay — compare cumulative trading return (net P&L / capital)
 * against a market index over a shared date window, both normalized to
 * % from the window start.
 *
 * Pure & framework-free. See tests/portfolio/benchmark.test.ts.
 */

export interface PnlPoint {
  /** ISO date 'YYYY-MM-DD'. */
  date: string;
  /** Running cumulative NET trading P&L up to and including this date. */
  cumulativePnl: number;
}

export interface IndexClose {
  price_date: string;
  close: number;
}

export interface BenchmarkPoint {
  date: string;
  /** Portfolio return since window start, as a fraction (0.05 = +5%). Null if capitalBase <= 0. */
  portfolioPct: number | null;
  /** Benchmark return since window start, as a fraction. */
  benchmarkPct: number;
}

export interface BenchmarkComparison {
  series: BenchmarkPoint[];
  portfolioReturn: number | null;
  benchmarkReturn: number | null;
  relative: number | null;
}

export interface BuildBenchmarkArgs {
  pnlByDate: PnlPoint[];
  indexSeries: IndexClose[];
  capitalBase: number;
  fromDate?: string | null;
  /** Inclusive upper bound (ISO 'YYYY-MM-DD'). null/undefined = open-ended. */
  toDate?: string | null;
}

const EMPTY: BenchmarkComparison = {
  series: [],
  portfolioReturn: null,
  benchmarkReturn: null,
  relative: null,
};

/**
 * Build a benchmark comparison over the union of the two series' dates
 * within the window. Both series are forward-filled between anchor points.
 *
 * portfolioPct(t) = (cumPnl(t) - cumPnl(firstPoint)) / capitalBase
 * benchmarkPct(t) = close(t) / close(firstClose) - 1
 */
export function buildBenchmarkComparison({
  pnlByDate,
  indexSeries,
  capitalBase,
  fromDate = null,
}: BuildBenchmarkArgs): BenchmarkComparison {
  const gate = fromDate ?? "";

  const pnl = [...pnlByDate]
    .filter((p) => (gate ? p.date >= gate : true))
    .sort((a, b) => a.date.localeCompare(b.date));

  const idx = [...indexSeries]
    .filter((p) => (gate ? p.price_date >= gate : true))
    .sort((a, b) => a.price_date.localeCompare(b.price_date));

  if (!idx.length) return EMPTY;

  // Union of dates
  const dateSet = new Set<string>();
  for (const p of pnl) dateSet.add(p.date);
  for (const p of idx) dateSet.add(p.price_date);
  const dates = Array.from(dateSet).sort();
  if (!dates.length) return EMPTY;

  const pnlMap = new Map(pnl.map((p) => [p.date, p.cumulativePnl]));
  const closeMap = new Map(idx.map((p) => [p.price_date, p.close]));

  const hasPortfolio = capitalBase > 0;
  const firstPnl = pnl.length ? pnl[0].cumulativePnl : null;
  const firstClose = idx[0].close;

  let lastPnl = firstPnl;
  let lastClose = firstClose;

  const series: BenchmarkPoint[] = dates.map((date) => {
    if (pnlMap.has(date)) lastPnl = pnlMap.get(date)!;
    if (closeMap.has(date)) lastClose = closeMap.get(date)!;

    const portfolioPct =
      hasPortfolio && lastPnl != null && firstPnl != null
        ? (lastPnl - firstPnl) / capitalBase
        : null;

    const benchmarkPct = lastClose / firstClose - 1;
    return { date, portfolioPct, benchmarkPct };
  });

  const last = series[series.length - 1];
  const portfolioReturn = last.portfolioPct;
  const benchmarkReturn = last.benchmarkPct;
  const relative = portfolioReturn == null ? null : portfolioReturn - benchmarkReturn;

  return { series, portfolioReturn, benchmarkReturn, relative };
}
