import { describe, expect, it } from "vitest";
import {
  buildEquitySeries,
  computeRollingRisk,
  dailyReturns,
  drawdownSeries,
  indexDailyReturns,
  TRADING_DAYS,
} from "@/lib/portfolio/risk-series";

describe("buildEquitySeries + dailyReturns", () => {
  it("builds equity = capital + pnl and computes daily returns skipping day 0", () => {
    const eq = buildEquitySeries(
      [
        { date: "2025-01-01", totalPnl: 0 },
        { date: "2025-01-02", totalPnl: 1000 }, // 101_000
        { date: "2025-01-03", totalPnl: 500 }, // 100_500
      ],
      100_000,
    );
    expect(eq).toEqual([
      { date: "2025-01-01", equity: 100_000 },
      { date: "2025-01-02", equity: 101_000 },
      { date: "2025-01-03", equity: 100_500 },
    ]);
    const rs = dailyReturns(eq);
    expect(rs).toHaveLength(2);
    expect(rs[0].date).toBe("2025-01-02");
    expect(rs[0].r).toBeCloseTo(1000 / 100_000, 10);
    expect(rs[1].r).toBeCloseTo(100_500 / 101_000 - 1, 10);
  });
});

describe("computeRollingRisk", () => {
  it("gates on minObs — returns nulls before enough data", () => {
    const rs = Array.from({ length: 30 }, (_, i) => ({
      date: `2025-01-${String(i + 1).padStart(2, "0")}`,
      r: 0.001,
    }));
    const out = computeRollingRisk(rs, [], 0, 20);
    expect(out.slice(0, 19).every((p) => p.volatility === null)).toBe(true);
    expect(out[19].volatility).not.toBeNull();
  });

  it("annualized volatility and sharpe on a hand-checked series", () => {
    // Alternate +1% / -1%; stdev(sample) = sqrt(sum((r-mean)^2)/(n-1)).
    const n = 40;
    const rs = Array.from({ length: n }, (_, i) => ({
      date: `2025-02-${String(i + 1).padStart(2, "0")}`,
      r: i % 2 === 0 ? 0.01 : -0.01,
    }));
    const out = computeRollingRisk(rs, [], 0, 20);
    const last = out[out.length - 1];
    // mean is ~0, stdev ≈ 0.01 * sqrt(n/(n-1)); volatility ≈ 0.01 * sqrt(252) * sqrt(n/(n-1))
    const expectedVol = 0.01 * Math.sqrt(TRADING_DAYS) * Math.sqrt(n / (n - 1));
    expect(last.volatility!).toBeCloseTo(expectedVol, 4);
    // annual return ~0, rf=0 → sharpe ~0
    expect(Math.abs(last.sharpe!)).toBeLessThan(1e-6);
  });

  it("beta ≈ 2 when portfolio return is 2× benchmark", () => {
    const dates = Array.from(
      { length: 60 },
      (_, i) => `2025-03-${String(i + 1).padStart(2, "0")}`,
    ).slice(0, 30);
    const bench = dates.map((d, i) => ({ date: d, r: (i % 2 === 0 ? 1 : -1) * 0.005 }));
    const port = bench.map((p) => ({ date: p.date, r: p.r * 2 }));
    const out = computeRollingRisk(port, bench, 0, 20);
    const last = out[out.length - 1];
    expect(last.beta!).toBeCloseTo(2, 6);
  });
});

describe("indexDailyReturns", () => {
  it("computes returns from index closes", () => {
    const rs = indexDailyReturns([
      { price_date: "2025-01-01", close: 100 },
      { price_date: "2025-01-02", close: 110 },
      { price_date: "2025-01-03", close: 99 },
    ]);
    expect(rs).toHaveLength(2);
    expect(rs[0].r).toBeCloseTo(0.1, 10);
    expect(rs[1].r).toBeCloseTo(99 / 110 - 1, 10);
  });
});

describe("drawdownSeries", () => {
  it("tracks underwater from running peak on peak-then-trough", () => {
    const eq = [
      { date: "2025-01-01", equity: 100 },
      { date: "2025-01-02", equity: 120 },
      { date: "2025-01-03", equity: 90 },
      { date: "2025-01-04", equity: 110 },
    ];
    const { series, maxDrawdown } = drawdownSeries(eq);
    expect(series.map((p) => p.drawdown)).toEqual([0, 0, 90 / 120 - 1, 110 / 120 - 1]);
    expect(maxDrawdown).toBeCloseTo(90 / 120 - 1, 10);
  });
});
