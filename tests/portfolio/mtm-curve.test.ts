import { describe, expect, it } from "vitest";
import { buildDailyTotalPnl, type PriceHistoryPoint } from "@/lib/portfolio/mtm-curve";
import type { NormalizedTrade } from "@/types/analytics";

type ExitRow = NormalizedTrade["raw"]["exits"][number];

function makeTrade(opts: {
  id?: string;
  symbol: string;
  side?: "long" | "short";
  entryDate: string;
  entryPrice: number;
  quantity: number;
  instrumentType?: string;
  exits?: { date: string; price: number; quantity: number }[];
}): NormalizedTrade {
  const side = opts.side ?? "long";
  const instrumentType = opts.instrumentType ?? "equity";
  const exits: ExitRow[] = (opts.exits ?? []).map((e, i) => ({
    id: `${opts.symbol}-x${i}`,
    trade_id: opts.id ?? opts.symbol,
    exit_date: e.date,
    exit_price: e.price,
    quantity: e.quantity,
    fees: 0,
  })) as unknown as ExitRow[];
  const totalExited = exits.reduce((s, e) => s + Number(e.quantity), 0);
  const remaining = opts.quantity - totalExited;
  const sideSign = side === "long" ? 1 : -1;
  let gross = 0;
  for (const e of exits) {
    gross += (Number(e.exit_price) - opts.entryPrice) * Number(e.quantity) * sideSign;
  }
  return {
    id: opts.id ?? opts.symbol,
    symbol: opts.symbol,
    side,
    status: remaining <= 0 ? "closed" : totalExited > 0 ? "partial" : "open",
    entryDate: new Date(opts.entryDate),
    closeDate: remaining <= 0 && exits.length ? new Date(exits[exits.length - 1].exit_date) : null,
    entryPrice: opts.entryPrice,
    quantity: opts.quantity,
    filledQty: totalExited,
    remainingQty: remaining,
    avgExit: null,
    grossPnl: gross,
    netPnl: gross,
    fees: 0,
    riskPerUnit: null,
    riskAmount: null,
    positionExposure: opts.entryPrice * opts.quantity,
    rMultiple: null,
    holdingDurationMs: null,
    tags: [],
    confidence: null,
    emotionLevel: null,
    recoveryUrge: null,
    disciplineFeel: null,
    setupMatch: null,
    raw: {
      trade: {
        instrument_type: instrumentType,
        entry_price: opts.entryPrice,
        quantity: opts.quantity,
        side,
        fees: 0,
      } as unknown as NormalizedTrade["raw"]["trade"],
      exits,
      discipline: [],
    },
  };
}

const h = (points: [string, number][]): PriceHistoryPoint[] =>
  points.map(([price_date, close]) => ({ price_date, close }));

describe("buildDailyTotalPnl", () => {
  it("open long trade: unrealized moves with price, no realized", () => {
    const t = makeTrade({
      symbol: "AAA",
      entryDate: "2025-01-01",
      entryPrice: 100,
      quantity: 100,
    });
    const series = buildDailyTotalPnl({
      trades: [t],
      priceHistoryBySymbol: {
        AAA: h([["2025-01-01", 100], ["2025-01-02", 120]]),
      },
    });
    const d1 = series.find((p) => p.date === "2025-01-01")!;
    const d2 = series.find((p) => p.date === "2025-01-02")!;
    expect(d1.unrealized).toBe(0);
    expect(d1.realizedCum).toBe(0);
    expect(d2.unrealized).toBe(2000);
    expect(d2.realizedCum).toBe(0);
    expect(d2.totalPnl).toBe(2000);
  });

  it("partial exit: realized locks in, unrealized tracks remaining qty", () => {
    const t = makeTrade({
      symbol: "BBB",
      entryDate: "2025-01-01",
      entryPrice: 100,
      quantity: 100,
      exits: [{ date: "2025-01-02", price: 150, quantity: 40 }],
    });
    const series = buildDailyTotalPnl({
      trades: [t],
      priceHistoryBySymbol: {
        BBB: h([
          ["2025-01-01", 100],
          ["2025-01-02", 150],
          ["2025-01-03", 160],
        ]),
      },
    });
    const d2 = series.find((p) => p.date === "2025-01-02")!;
    const d3 = series.find((p) => p.date === "2025-01-03")!;
    expect(d2.realizedCum).toBe(2000); // 40 * (150 - 100)
    expect(d2.unrealized).toBe(3000); // 60 * (150 - 100)
    expect(d3.realizedCum).toBe(2000);
    expect(d3.unrealized).toBe(3600); // 60 * (160 - 100)
    expect(d3.totalPnl).toBe(5600);
  });

  it("forward-fills closes on days with no price point", () => {
    const t = makeTrade({
      symbol: "CCC",
      entryDate: "2025-01-01",
      entryPrice: 100,
      quantity: 10,
    });
    // Add another trade date to force D3 into the union without a price point.
    const t2 = makeTrade({
      symbol: "DDD",
      entryDate: "2025-01-03",
      entryPrice: 50,
      quantity: 0, // no effect; but ensures D3 is in union via entryIso
      instrumentType: "equity",
    });
    const series = buildDailyTotalPnl({
      trades: [t, t2],
      priceHistoryBySymbol: {
        CCC: h([["2025-01-01", 100], ["2025-01-02", 110]]),
      },
    });
    const d3 = series.find((p) => p.date === "2025-01-03");
    expect(d3).toBeDefined();
    // On D3 CCC has no new price → forward-filled 110 → unrealized = 10 * 10 = 100
    expect(d3!.unrealized).toBe(100);
  });

  it("fully closed trade contributes only realized (no unrealized after close)", () => {
    const t = makeTrade({
      symbol: "EEE",
      entryDate: "2025-01-01",
      entryPrice: 100,
      quantity: 50,
      exits: [{ date: "2025-01-02", price: 130, quantity: 50 }],
    });
    const series = buildDailyTotalPnl({
      trades: [t],
      priceHistoryBySymbol: {
        EEE: h([
          ["2025-01-01", 100],
          ["2025-01-02", 130],
          ["2025-01-03", 200],
        ]),
      },
    });
    const d3 = series.find((p) => p.date === "2025-01-03")!;
    expect(d3.unrealized).toBe(0);
    expect(d3.realizedCum).toBe(1500);
    expect(d3.totalPnl).toBe(1500);
  });
});
