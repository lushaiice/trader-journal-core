import { describe, it, expect } from "vitest";
import { summarizeAnalytics, EMPTY_ANALYTICS_SUMMARY } from "@/lib/analytics/metrics";
import type { NormalizedTrade } from "@/types/analytics";

function trade(partial: Partial<NormalizedTrade>): NormalizedTrade {
  return {
    id: Math.random().toString(36).slice(2),
    symbol: "TEST",
    side: "long",
    status: "closed",
    entryDate: new Date("2026-01-01"),
    closeDate: new Date("2026-01-02"),
    entryPrice: 100,
    quantity: 10,
    filledQty: 10,
    remainingQty: 0,
    avgExit: 110,
    grossPnl: 100,
    netPnl: 100,
    fees: 0,
    riskPerUnit: null,
    riskAmount: null,
    positionExposure: 1000,
    rMultiple: null,
    holdingDurationMs: 86_400_000,
    tags: [],
    confidence: null,
    emotionLevel: null,
    recoveryUrge: null,
    disciplineFeel: null,
    setupMatch: null,
    raw: { trade: {} as never, exits: [], discipline: [] },
    ...partial,
  };
}

describe("analytics metrics", () => {
  it("returns the empty summary shape for no trades", () => {
    const s = summarizeAnalytics([]);
    expect(s).toEqual(EMPTY_ANALYTICS_SUMMARY);
  });

  it("computes win rate, profit factor, expectancy", () => {
    const trades = [
      trade({ netPnl: 200, grossPnl: 200 }),
      trade({ netPnl: 100, grossPnl: 100 }),
      trade({ netPnl: -100, grossPnl: -100 }),
    ];
    const s = summarizeAnalytics(trades);
    expect(s.wins).toBe(2);
    expect(s.losses).toBe(1);
    expect(s.winRate).toBeCloseTo(2 / 3, 5);
    // grossProfit = 300, grossLoss = 100 => PF = 3
    expect(s.profitFactor).toBe(3);
    // expectancy = 2/3*150 + 1/3*-100 = 100 - 33.33 = 66.66
    expect(s.expectancy).toBeCloseTo(200 / 3, 3);
    expect(s.totalNetPnl).toBe(200);
  });

  it("treats all-wins profit factor as Infinity", () => {
    const s = summarizeAnalytics([trade({ netPnl: 50 }), trade({ netPnl: 75 })]);
    expect(s.profitFactor).toBe(Infinity);
    expect(s.winRate).toBe(1);
    expect(s.largestWin).toBe(75);
  });

  it("excludes open trades from realized stats but counts them in tradeCount", () => {
    const s = summarizeAnalytics([
      trade({ status: "open", filledQty: 0, netPnl: 0 }),
      trade({ netPnl: 100 }),
    ]);
    expect(s.tradeCount).toBe(2);
    expect(s.openCount).toBe(1);
    expect(s.wins).toBe(1);
    expect(s.totalNetPnl).toBe(100);
  });

  it("counts partial trades as open", () => {
    const s = summarizeAnalytics([
      trade({ status: "partial", filledQty: 5, netPnl: 50 }),
      trade({ netPnl: 100 }),
    ]);
    expect(s.tradeCount).toBe(2);
    expect(s.closedCount).toBe(1);
    // partial still carries live exposure → counted as open
    expect(s.openCount).toBe(1);
    expect(s.wins).toBe(2);
  });

  it("computes deterministic Sharpe-like ratio for stable returns", () => {
    const s = summarizeAnalytics([
      trade({ netPnl: 100 }),
      trade({ netPnl: 100 }),
      trade({ netPnl: 100 }),
    ]);
    // stdev=0, ratio undefined → null
    expect(s.sharpeRatio).toBeNull();
  });
});
