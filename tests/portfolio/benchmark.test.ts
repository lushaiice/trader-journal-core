import { describe, it, expect } from "vitest";
import { buildBenchmarkComparison } from "@/lib/portfolio/benchmark";

describe("buildBenchmarkComparison", () => {
  it("computes basic returns and relative for aligned dates", () => {
    const r = buildBenchmarkComparison({
      pnlByDate: [
        { date: "2025-01-01", cumulativePnl: 0 },
        { date: "2025-01-02", cumulativePnl: 5000 },
      ],
      indexSeries: [
        { price_date: "2025-01-01", close: 100 },
        { price_date: "2025-01-02", close: 110 },
      ],
      capitalBase: 100000,
    });
    expect(r.benchmarkReturn).toBeCloseTo(0.1, 10);
    expect(r.portfolioReturn).toBeCloseTo(0.05, 10);
    expect(r.relative).toBeCloseTo(-0.05, 10);
    expect(r.series).toHaveLength(2);
  });

  it("forward-fills across the union of dates on both sides", () => {
    const r = buildBenchmarkComparison({
      pnlByDate: [
        { date: "2025-01-01", cumulativePnl: 0 },
        // no pnl point on 01-02 — should carry 0 forward
        { date: "2025-01-03", cumulativePnl: 2000 },
      ],
      indexSeries: [
        { price_date: "2025-01-01", close: 100 },
        { price_date: "2025-01-02", close: 105 },
        // no close on 01-03 — should carry 105 forward
      ],
      capitalBase: 100000,
    });
    expect(r.series.map((p) => p.date)).toEqual(["2025-01-01", "2025-01-02", "2025-01-03"]);
    // 01-02: pnl still 0, close = 105
    expect(r.series[1].portfolioPct).toBeCloseTo(0, 10);
    expect(r.series[1].benchmarkPct).toBeCloseTo(0.05, 10);
    // 01-03: pnl 2000, close still 105
    expect(r.series[2].portfolioPct).toBeCloseTo(0.02, 10);
    expect(r.series[2].benchmarkPct).toBeCloseTo(0.05, 10);
    expect(r.relative).toBeCloseTo(-0.03, 10);
  });

  it("returns null portfolio series when capitalBase <= 0 but keeps benchmark", () => {
    const r = buildBenchmarkComparison({
      pnlByDate: [
        { date: "2025-01-01", cumulativePnl: 0 },
        { date: "2025-01-02", cumulativePnl: 5000 },
      ],
      indexSeries: [
        { price_date: "2025-01-01", close: 100 },
        { price_date: "2025-01-02", close: 110 },
      ],
      capitalBase: 0,
    });
    expect(r.portfolioReturn).toBeNull();
    expect(r.relative).toBeNull();
    expect(r.benchmarkReturn).toBeCloseTo(0.1, 10);
    expect(r.series.every((p) => p.portfolioPct === null)).toBe(true);
  });

  it("returns empty when index has no data in window", () => {
    const r = buildBenchmarkComparison({
      pnlByDate: [{ date: "2025-01-01", cumulativePnl: 0 }],
      indexSeries: [],
      capitalBase: 100000,
    });
    expect(r.series).toEqual([]);
    expect(r.benchmarkReturn).toBeNull();
  });

  it("respects the fromDate window", () => {
    const r = buildBenchmarkComparison({
      pnlByDate: [
        { date: "2024-12-31", cumulativePnl: 999999 },
        { date: "2025-01-01", cumulativePnl: 0 },
        { date: "2025-01-02", cumulativePnl: 1000 },
      ],
      indexSeries: [
        { price_date: "2024-12-31", close: 50 },
        { price_date: "2025-01-01", close: 100 },
        { price_date: "2025-01-02", close: 110 },
      ],
      capitalBase: 100000,
      fromDate: "2025-01-01",
    });
    expect(r.series.map((p) => p.date)).toEqual(["2025-01-01", "2025-01-02"]);
    expect(r.benchmarkReturn).toBeCloseTo(0.1, 10);
    expect(r.portfolioReturn).toBeCloseTo(0.01, 10);
  });
});
