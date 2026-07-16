import { describe, expect, it } from "vitest";
import { computeAllocation, computeConcentration, computeReturnRisk } from "@/lib/portfolio/risk";
import type { Holding } from "@/lib/portfolio/holdings";
import type { NormalizedTrade } from "@/types/analytics";

function makeTrade(o: Partial<NormalizedTrade> & { id: string }): NormalizedTrade {
  return {
    id: o.id,
    symbol: "X",
    side: "long",
    status: "closed",
    entryDate: new Date("2025-01-01"),
    closeDate: new Date("2025-01-02"),
    entryPrice: 100,
    quantity: 10,
    filledQty: 10,
    remainingQty: 0,
    avgExit: 110,
    grossPnl: 0,
    netPnl: 0,
    fees: 0,
    riskPerUnit: null,
    riskAmount: null,
    positionExposure: 1000,
    rMultiple: null,
    holdingDurationMs: null,
    tags: [],
    confidence: null,
    emotionLevel: null,
    recoveryUrge: null,
    disciplineFeel: null,
    setupMatch: null,
    raw: {
      trade: { instrument_type: "equity" } as unknown as NormalizedTrade["raw"]["trade"],
      exits: [],
      discipline: [],
    },
    ...o,
  };
}

function makeHolding(symbol: string, mv: number): Holding {
  return {
    symbol,
    instrumentType: "equity",
    quantity: 1,
    avgCost: mv,
    costValue: mv,
    hasPrice: true,
    lastClose: mv,
    priceDate: "2026-07-15",
    marketValue: mv,
    unrealizedPnl: 0,
    unrealizedPct: 0,
  };
}

describe("computeReturnRisk", () => {
  it("computes volatility, downside deviation, and sortino for [+200, +100, -100]", () => {
    const trades = [
      makeTrade({ id: "1", netPnl: 200, filledQty: 10 }),
      makeTrade({ id: "2", netPnl: 100, filledQty: 10 }),
      makeTrade({ id: "3", netPnl: -100, filledQty: 10 }),
    ];
    const r = computeReturnRisk(trades);
    // mean = 200/3 ≈ 66.67
    expect(r.meanReturn).toBeCloseTo(200 / 3, 4);
    // sample stdev of [200,100,-100]: mean ~66.67, deviations 133.33/33.33/-166.67,
    // variance = (17777.78 + 1111.11 + 27777.78) / 2 = 23333.33 → stdev ≈ 152.75
    expect(r.volatility).toBeCloseTo(Math.sqrt(23333.3333), 2);
    // downside: only -100 contributes → sqrt(10000/3)
    expect(r.downsideDeviation).toBeCloseTo(Math.sqrt(10000 / 3), 4);
    expect(r.sortino).toBeCloseTo(200 / 3 / Math.sqrt(10000 / 3), 4);
  });

  it("returns null volatility/sortino for fewer than 2 realized trades", () => {
    const r = computeReturnRisk([makeTrade({ id: "1", netPnl: 50, filledQty: 10 })]);
    expect(r.volatility).toBeNull();
    expect(r.downsideDeviation).toBeNull();
    expect(r.sortino).toBeNull();
  });

  it("returns null sortino when there is no downside", () => {
    const trades = [
      makeTrade({ id: "1", netPnl: 100, filledQty: 10 }),
      makeTrade({ id: "2", netPnl: 200, filledQty: 10 }),
    ];
    const r = computeReturnRisk(trades);
    expect(r.downsideDeviation).toBe(0);
    expect(r.sortino).toBeNull();
  });
});

describe("computeConcentration", () => {
  it("computes weights, herfindahl, and top weights for [6000, 3000, 1000]", () => {
    const c = computeConcentration([
      makeHolding("A", 6000),
      makeHolding("B", 3000),
      makeHolding("C", 1000),
    ]);
    expect(c.weights.map((w) => w.weight)).toEqual([0.6, 0.3, 0.1]);
    expect(c.herfindahl).toBeCloseTo(0.46, 6);
    expect(c.topWeight).toBe(0.6);
    expect(c.top3Weight).toBeCloseTo(1, 6);
  });

  it("returns nulls when no priced holdings", () => {
    const c = computeConcentration([]);
    expect(c.herfindahl).toBeNull();
    expect(c.topWeight).toBeNull();
    expect(c.weights).toEqual([]);
  });
});

describe("computeAllocation", () => {
  it("splits by instrument and direction, and computes exposurePct", () => {
    const trades: NormalizedTrade[] = [
      // Equity long — priced at 120 → value 60 * 120 = 7200
      makeTrade({
        id: "e1",
        symbol: "INFY",
        status: "open",
        side: "long",
        entryPrice: 100,
        quantity: 60,
        filledQty: 0,
        remainingQty: 60,
      }),
      // Equity short — priced at 90 → value 10 * 90 = 900
      makeTrade({
        id: "e2",
        symbol: "SHRT",
        status: "open",
        side: "short",
        entryPrice: 100,
        quantity: 10,
        filledQty: 0,
        remainingQty: 10,
      }),
      // Derivative long — cost 50 * 200 = 10000
      makeTrade({
        id: "d1",
        symbol: "NIFTYFUT",
        status: "open",
        side: "long",
        entryPrice: 200,
        quantity: 50,
        filledQty: 0,
        remainingQty: 50,
        raw: {
          trade: { instrument_type: "future" } as unknown as NormalizedTrade["raw"]["trade"],
          exits: [],
          discipline: [],
        },
      }),
    ];
    const a = computeAllocation(trades, { INFY: { close: 120 }, SHRT: { close: 90 } }, 100000);
    // equity = 7200 + 900 = 8100; derivatives = 10000; deployed = 18100
    expect(a.deployedValue).toBe(18100);
    expect(a.byInstrument.equity.value).toBe(8100);
    expect(a.byInstrument.derivatives.value).toBe(10000);
    expect(a.byInstrument.equity.share).toBeCloseTo(8100 / 18100, 6);
    expect(a.byInstrument.derivatives.share).toBeCloseTo(10000 / 18100, 6);
    // long = 7200 + 10000 = 17200; short = 900
    expect(a.byDirection.long.value).toBe(17200);
    expect(a.byDirection.short.value).toBe(900);
    expect(a.exposurePct).toBeCloseTo(18100 / 100000, 6);
  });

  it("exposurePct is null when capitalBase <= 0", () => {
    const a = computeAllocation([], {}, 0);
    expect(a.exposurePct).toBeNull();
    expect(a.deployedValue).toBe(0);
  });
});
