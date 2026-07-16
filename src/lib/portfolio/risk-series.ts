/**
 * Daily-return risk metrics for the portfolio equity curve.
 *
 * Framework-free. Consumes the totalPnl series from buildDailyTotalPnl
 * (realized + entry-anchored/split-safe unrealized) and a capital base to
 * produce a daily equity path, then rolling since-inception risk metrics
 * over an expanding window. Annualization uses TRADING_DAYS = 252.
 */

export const TRADING_DAYS = 252;

export interface EquityPoint {
  date: string;
  equity: number;
}
export interface ReturnPoint {
  date: string;
  r: number;
}
export interface IndexClosePoint {
  price_date: string;
  close: number;
}
export interface RollingRiskPoint {
  date: string;
  sharpe: number | null;
  sortino: number | null;
  volatility: number | null;
  beta: number | null;
}
export interface DrawdownPoint {
  date: string;
  drawdown: number;
}

export function buildEquitySeries(
  totalPnlByDate: { date: string; totalPnl: number }[],
  capitalBase: number,
): EquityPoint[] {
  return totalPnlByDate.map((p) => ({ date: p.date, equity: capitalBase + p.totalPnl }));
}

export function dailyReturns(equity: EquityPoint[]): ReturnPoint[] {
  const out: ReturnPoint[] = [];
  for (let i = 1; i < equity.length; i++) {
    const prev = equity[i - 1].equity;
    const cur = equity[i].equity;
    if (!Number.isFinite(prev) || prev === 0 || !Number.isFinite(cur)) continue;
    out.push({ date: equity[i].date, r: cur / prev - 1 });
  }
  return out;
}

export function indexDailyReturns(series: IndexClosePoint[]): ReturnPoint[] {
  const sorted = [...series].sort((a, b) => a.price_date.localeCompare(b.price_date));
  const out: ReturnPoint[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1].close;
    const cur = sorted[i].close;
    if (!Number.isFinite(prev) || prev === 0 || !Number.isFinite(cur)) continue;
    out.push({ date: sorted[i].price_date, r: cur / prev - 1 });
  }
  return out;
}

function mean(xs: number[]): number {
  let s = 0;
  for (const x of xs) s += x;
  return xs.length ? s / xs.length : 0;
}
function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  let v = 0;
  for (const x of xs) v += (x - m) * (x - m);
  return Math.sqrt(v / (xs.length - 1));
}
function downsideDev(xs: number[]): number {
  if (!xs.length) return 0;
  let s = 0;
  for (const x of xs) {
    const d = Math.min(0, x);
    s += d * d;
  }
  return Math.sqrt(s / xs.length);
}

export function computeRollingRisk(
  portfolioReturns: ReturnPoint[],
  benchmarkReturns: ReturnPoint[],
  rfAnnualPct: number,
  minObs = 20,
): RollingRiskPoint[] {
  const rfAnnual = rfAnnualPct / 100;
  const sqrtT = Math.sqrt(TRADING_DAYS);
  const benchByDate = new Map<string, number>();
  for (const b of benchmarkReturns) benchByDate.set(b.date, b.r);

  const out: RollingRiskPoint[] = [];
  const rs: number[] = [];
  // Pairs for beta: aligned on common dates
  const rp: number[] = [];
  const rb: number[] = [];

  for (const p of portfolioReturns) {
    rs.push(p.r);
    const b = benchByDate.get(p.date);
    if (b != null) {
      rp.push(p.r);
      rb.push(b);
    }

    if (rs.length < minObs) {
      out.push({ date: p.date, sharpe: null, sortino: null, volatility: null, beta: null });
      continue;
    }

    const mR = mean(rs);
    const sd = stdev(rs);
    const dd = downsideDev(rs);
    const volAnn = sd * sqrtT;
    const annRet = mR * TRADING_DAYS;
    const sharpe = volAnn > 0 ? (annRet - rfAnnual) / volAnn : null;
    const sortino = dd > 0 ? (annRet - rfAnnual) / (dd * sqrtT) : null;

    let beta: number | null = null;
    if (rb.length >= minObs) {
      const mB = mean(rb);
      const mP = mean(rp);
      let cov = 0;
      let varB = 0;
      for (let i = 0; i < rb.length; i++) {
        cov += (rp[i] - mP) * (rb[i] - mB);
        varB += (rb[i] - mB) * (rb[i] - mB);
      }
      beta = varB > 0 ? cov / varB : null;
    }

    out.push({
      date: p.date,
      sharpe,
      sortino,
      volatility: volAnn,
      beta,
    });
  }
  return out;
}

export interface DrawdownSeriesResult {
  series: DrawdownPoint[];
  maxDrawdown: number;
}

export function drawdownSeries(equity: EquityPoint[]): DrawdownSeriesResult {
  const series: DrawdownPoint[] = [];
  let peak = -Infinity;
  let maxDd = 0;
  for (const p of equity) {
    if (p.equity > peak) peak = p.equity;
    const dd = peak > 0 ? p.equity / peak - 1 : 0;
    if (dd < maxDd) maxDd = dd;
    series.push({ date: p.date, drawdown: dd });
  }
  return { series, maxDrawdown: maxDd };
}
