import { describe, it, expect } from "vitest";
import {
  buildTimeRange,
  filterTradesByRange,
  inRange,
} from "@/lib/analytics/time-range";
import type { NormalizedTrade } from "@/types/analytics";

const NOW = new Date("2026-05-12T12:00:00Z");

function t(closeISO: string | null, entryISO = closeISO ?? "2026-01-01"): NormalizedTrade {
  return {
    id: closeISO ?? entryISO,
    symbol: "X",
    side: "long",
    status: closeISO ? "closed" : "open",
    entryDate: new Date(entryISO),
    closeDate: closeISO ? new Date(closeISO) : null,
    entryPrice: 100,
    quantity: 1,
    filledQty: closeISO ? 1 : 0,
    remainingQty: closeISO ? 0 : 1,
    avgExit: closeISO ? 100 : null,
    grossPnl: 0,
    netPnl: 0,
    fees: 0,
    riskPerUnit: null,
    riskAmount: null,
    positionExposure: 100,
    rMultiple: null,
    holdingDurationMs: null,
    tags: [],
    confidence: null,
    emotionLevel: null,
    recoveryUrge: null,
    disciplineFeel: null,
    setupMatch: null,
    raw: { trade: {} as never, exits: [], discipline: [] },
  };
}

describe("time-range filtering", () => {
  it("ALL has no lower bound", () => {
    const r = buildTimeRange("ALL", NOW);
    expect(r.start).toBeNull();
    expect(inRange(new Date("2000-01-01"), r)).toBe(true);
  });

  it("YTD starts at Jan 1 of current year", () => {
    const r = buildTimeRange("YTD", NOW);
    expect(r.start?.toISOString().slice(0, 10)).toBe("2026-01-01");
    expect(inRange(new Date("2025-12-31"), r)).toBe(false);
    expect(inRange(new Date("2026-02-01"), r)).toBe(true);
  });

  it("7D, 1M, 1Y, 3Y windows respect lower bound", () => {
    const r7 = buildTimeRange("7D", NOW);
    const r1m = buildTimeRange("1M", NOW);
    const r1y = buildTimeRange("1Y", NOW);
    const r3y = buildTimeRange("3Y", NOW);
    expect(r7.start!.getTime()).toBeLessThan(NOW.getTime());
    expect(inRange(new Date("2026-05-10T00:00:00Z"), r7)).toBe(true);
    expect(inRange(new Date("2026-04-01"), r7)).toBe(false);
    expect(inRange(new Date("2026-04-01"), r1m)).toBe(true);
    expect(inRange(new Date("2025-06-01"), r1y)).toBe(true);
    expect(inRange(new Date("2024-01-01"), r1y)).toBe(false);
    expect(inRange(new Date("2024-01-01"), r3y)).toBe(true);
    expect(inRange(new Date("2022-01-01"), r3y)).toBe(false);
  });

  it("filters trades by closeDate (or entryDate if open)", () => {
    const trades = [
      t("2026-05-10T00:00:00Z"),
      t("2026-01-01T00:00:00Z"),
      t(null, "2026-05-11T00:00:00Z"),
    ];
    const r = buildTimeRange("7D", NOW);
    const out = filterTradesByRange(trades, r);
    expect(out).toHaveLength(2);
  });

  it("is deterministic given the same `now`", () => {
    const a = buildTimeRange("1M", NOW);
    const b = buildTimeRange("1M", NOW);
    expect(a.start?.getTime()).toBe(b.start?.getTime());
    expect(a.end.getTime()).toBe(b.end.getTime());
  });
});
