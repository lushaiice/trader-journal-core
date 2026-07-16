import { describe, expect, it } from "vitest";
import { buildHoldings, type PriceRef } from "@/lib/portfolio/holdings";
import type { NormalizedTrade } from "@/types/analytics";

function makeTrade(
  overrides: Partial<NormalizedTrade> & {
    symbol: string;
    entryPrice: number;
    quantity: number;
    remainingQty: number;
    status?: NormalizedTrade["status"];
    instrumentType?: string;
  },
): NormalizedTrade {
  const {
    symbol,
    entryPrice,
    quantity,
    remainingQty,
    status = "open",
    instrumentType = "equity",
    ...rest
  } = overrides;
  return {
    id: `${symbol}-${Math.random()}`,
    symbol,
    side: "long",
    status,
    entryDate: new Date("2025-01-01"),
    closeDate: null,
    entryPrice,
    quantity,
    filledQty: quantity - remainingQty,
    remainingQty,
    avgExit: null,
    grossPnl: 0,
    netPnl: 0,
    fees: 0,
    riskPerUnit: null,
    riskAmount: null,
    positionExposure: entryPrice * quantity,
    rMultiple: null,
    holdingDurationMs: null,
    tags: [],
    confidence: null,
    emotionLevel: null,
    recoveryUrge: null,
    disciplineFeel: null,
    setupMatch: null,
    raw: {
      // Minimal shape — cast because only instrument_type is inspected.
      trade: { instrument_type: instrumentType } as unknown as NormalizedTrade["raw"]["trade"],
      exits: [],
      discipline: [],
    },
    ...rest,
  };
}

const price = (close: number, date = "2026-07-15"): PriceRef => ({
  close,
  price_date: date,
});

describe("buildHoldings", () => {
  it("aggregates two open trades of the same symbol into one holding", () => {
    const trades = [
      makeTrade({ symbol: "INFY", entryPrice: 100, quantity: 100, remainingQty: 100 }),
      makeTrade({ symbol: "INFY", entryPrice: 120, quantity: 50, remainingQty: 50 }),
    ];
    const res = buildHoldings(trades, { INFY: price(130) });
    expect(res.holdings).toHaveLength(1);
    const h = res.holdings[0];
    expect(h.quantity).toBe(150);
    expect(h.avgCost).toBeCloseTo(16000 / 150, 4);
    expect(h.costValue).toBe(16000);
    expect(h.marketValue).toBe(19500);
    expect(h.unrealizedPnl).toBe(3500);
    expect(res.totals.costValue).toBe(16000);
    expect(res.totals.marketValue).toBe(19500);
    expect(res.totals.unrealizedPnl).toBe(3500);
    expect(res.totals.pricedCount).toBe(1);
    expect(res.totals.unpricedCount).toBe(0);
  });

  it("handles a partial trade — values only the remaining quantity", () => {
    const trades = [
      makeTrade({
        symbol: "TCS",
        entryPrice: 200,
        quantity: 100,
        remainingQty: 60,
        status: "partial",
      }),
    ];
    const res = buildHoldings(trades, { TCS: price(210) });
    expect(res.holdings).toHaveLength(1);
    const h = res.holdings[0];
    expect(h.quantity).toBe(60);
    expect(h.costValue).toBe(12000);
    expect(h.marketValue).toBe(12600);
    expect(h.unrealizedPnl).toBe(600);
  });

  it("excludes unpriced symbols from priced totals but lists them", () => {
    const trades = [
      makeTrade({ symbol: "INFY", entryPrice: 100, quantity: 10, remainingQty: 10 }),
      makeTrade({ symbol: "ACME", entryPrice: 50, quantity: 20, remainingQty: 20 }),
    ];
    const res = buildHoldings(trades, { INFY: price(110) });
    expect(res.holdings).toHaveLength(1);
    expect(res.holdings[0].symbol).toBe("INFY");
    expect(res.unpricedEquity).toHaveLength(1);
    expect(res.unpricedEquity[0].symbol).toBe("ACME");
    expect(res.unpricedEquity[0].hasPrice).toBe(false);
    expect(res.totals.costValue).toBe(1000);
    expect(res.totals.marketValue).toBe(1100);
    expect(res.totals.unrealizedPnl).toBe(100);
    expect(res.totals.pricedCount).toBe(1);
    expect(res.totals.unpricedCount).toBe(1);
  });

  it("totals only sum priced holdings", () => {
    const trades = [
      makeTrade({ symbol: "A", entryPrice: 100, quantity: 10, remainingQty: 10 }),
      makeTrade({ symbol: "B", entryPrice: 200, quantity: 5, remainingQty: 5 }),
      makeTrade({ symbol: "C", entryPrice: 999, quantity: 3, remainingQty: 3 }),
    ];
    const res = buildHoldings(trades, {
      A: price(110),
      B: price(210),
    });
    // Priced: A cost 1000 mv 1100 pnl 100; B cost 1000 mv 1050 pnl 50
    expect(res.totals.costValue).toBe(2000);
    expect(res.totals.marketValue).toBe(2150);
    expect(res.totals.unrealizedPnl).toBe(150);
    expect(res.totals.pricedCount).toBe(2);
    expect(res.totals.unpricedCount).toBe(1);
  });

  it("segregates derivatives from equity mark-to-market", () => {
    const trades = [
      makeTrade({ symbol: "INFY", entryPrice: 100, quantity: 10, remainingQty: 10 }),
      makeTrade({
        symbol: "NIFTY24DECFUT",
        entryPrice: 22000,
        quantity: 50,
        remainingQty: 50,
        instrumentType: "future",
      }),
    ];
    const res = buildHoldings(trades, { INFY: price(110) });
    expect(res.holdings).toHaveLength(1);
    expect(res.derivatives).toHaveLength(1);
    expect(res.derivatives[0].symbol).toBe("NIFTY24DECFUT");
    expect(res.totals.pricedCount).toBe(1);
  });
});
