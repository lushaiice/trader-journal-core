import { describe, it, expect } from "vitest";
import {
  buildDrawdownSeries,
  summarizeDrawdown,
} from "@/lib/analytics/drawdown";

const pt = (date: string, equity: number) => ({ date: new Date(date), equity });

describe("drawdown engine", () => {
  it("returns empty for empty input", () => {
    expect(buildDrawdownSeries([])).toEqual([]);
    const s = summarizeDrawdown([]);
    expect(s.maxDrawdown).toBe(0);
    expect(s.underwater).toEqual([]);
  });

  it("tracks rolling peaks and drawdown", () => {
    const series = buildDrawdownSeries([
      pt("2026-01-01", 100),
      pt("2026-01-02", 120),
      pt("2026-01-03", 90),
      pt("2026-01-04", 130),
    ]);
    expect(series[0].peak).toBe(100);
    expect(series[1].peak).toBe(120);
    expect(series[2].peak).toBe(120);
    expect(series[2].drawdown).toBe(-30);
    expect(series[3].peak).toBe(130);
    expect(series[3].drawdown).toBe(0);
  });

  it("computes max drawdown and recovery", () => {
    const summary = summarizeDrawdown([
      pt("2026-01-01", 100),
      pt("2026-01-02", 80),
      pt("2026-01-03", 60),
      pt("2026-01-04", 110),
    ]);
    expect(summary.maxDrawdown).toBe(-40);
    expect(summary.maxDrawdownPct).toBeCloseTo(-0.4, 5);
    expect(summary.currentDrawdown).toBe(0);
  });

  it("handles negative equity gracefully", () => {
    const summary = summarizeDrawdown([pt("2026-01-01", -50), pt("2026-01-02", -80)]);
    expect(summary.maxDrawdown).toBe(-30);
  });
});
