/** Drawdown / underwater curve calculations. */
import type {
  DrawdownPoint,
  DrawdownSummary,
  EquityPoint,
} from "@/types/analytics";

export function buildDrawdownSeries(curve: EquityPoint[]): DrawdownPoint[] {
  if (!curve.length) return [];
  let peak = curve[0].equity;
  return curve.map((p) => {
    if (p.equity > peak) peak = p.equity;
    const drawdown = p.equity - peak;
    const drawdownPct = peak !== 0 ? drawdown / Math.abs(peak) : 0;
    return { date: p.date, equity: p.equity, peak, drawdown, drawdownPct };
  });
}

export function summarizeDrawdown(curve: EquityPoint[]): DrawdownSummary {
  const series = buildDrawdownSeries(curve);
  if (!series.length) {
    return {
      maxDrawdown: 0,
      maxDrawdownPct: 0,
      currentDrawdown: 0,
      currentDrawdownPct: 0,
      underwater: [],
    };
  }
  let max = 0;
  let maxPct = 0;
  for (const p of series) {
    if (p.drawdown < max) max = p.drawdown;
    if (p.drawdownPct < maxPct) maxPct = p.drawdownPct;
  }
  const last = series[series.length - 1];
  return {
    maxDrawdown: max,
    maxDrawdownPct: maxPct,
    currentDrawdown: last.drawdown,
    currentDrawdownPct: last.drawdownPct,
    underwater: series,
  };
}
