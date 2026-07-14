import { describe, it, expect } from "vitest";
import { computeTradeCharges } from "@/lib/charges/engine";
import type { ReconstructedTrade } from "@/lib/import/types";

function eq(overrides: Partial<ReconstructedTrade>): ReconstructedTrade {
  return {
    kind: "closed",
    symbol: "TEST",
    segment: "EQ",
    instrument_type: "equity",
    isin: "INE000000001",
    exchange: "NSE",
    side: "long",
    entry_date: "2025-01-02T09:15:00",
    entry_price: 100,
    quantity: 100,
    exits: [{ exit_price: 105, quantity: 100, exit_date: "2025-01-05T14:00:00" }],
    gross_pnl: 500,
    source_fill_ids: [],
    ...overrides,
  };
}

describe("computeTradeCharges", () => {
  it("equity delivery — non-ETF long has zero brokerage and STT on both legs", () => {
    const c = computeTradeCharges(eq({}));
    // Buy 10000, Sell 10500. STT = 10 + 10.50 = 20.50. Stamp = 1.50.
    expect(c.brokerage).toBe(0);
    expect(c.stt).toBeCloseTo(20.5, 2);
    expect(c.stamp).toBeCloseTo(1.5, 2);
    expect(c.total).toBeGreaterThan(20);
  });

  it("equity delivery — ETF (ISIN INF*) uses reduced STT on sell only", () => {
    const c = computeTradeCharges(
      eq({ isin: "INF204KB17I5", entry_price: 200, exits: [{ exit_price: 210, quantity: 100, exit_date: "2025-01-05T14:00:00" }] }),
    );
    // Sell 21000 * 0.001% = 0.21. No buy STT.
    expect(c.stt).toBeCloseTo(0.21, 2);
  });

  it("equity intraday — same-day close applies intraday brokerage & STT-on-sell", () => {
    const c = computeTradeCharges(
      eq({ exits: [{ exit_price: 105, quantity: 100, exit_date: "2025-01-02T14:00:00" }] }),
    );
    // Intraday STT 0.025% on sell 10500 = 2.625. Brokerage capped at 20 per leg.
    expect(c.stt).toBeCloseTo(2.625, 2);
    expect(c.brokerage).toBeGreaterThan(0);
    expect(c.brokerage).toBeLessThanOrEqual(40);
  });

  it("Zerodha-calculator smoke: mid-size delivery basket approximates published total", () => {
    // NSE delivery, non-ETF, buy 1L → sell 1.02L.
    const c = computeTradeCharges(eq({ entry_price: 1000, exits: [{ exit_price: 1020, quantity: 100, exit_date: "2025-01-05T14:00:00" }] }));
    // Buy 100000, Sell 102000, turnover 202000.
    // STT = 100 + 102 = 202. Stamp = 15. Txn = 202000 * 0.0000297 ≈ 6.00. SEBI ≈ 0.20. GST ≈ 1.12.
    // Expected ~224.
    expect(c.total).toBeGreaterThan(215);
    expect(c.total).toBeLessThan(235);
  });

  it("open trade with no exits has minimal charges (entry side only)", () => {
    const c = computeTradeCharges(eq({ kind: "open", exits: [] }));
    // Buy 10000. STT on buy only for delivery. Stamp 1.50.
    expect(c.stt).toBeCloseTo(10, 2);
    expect(c.stamp).toBeCloseTo(1.5, 2);
  });

  it("options round-trip charges flat brokerage per order", () => {
    const c = computeTradeCharges(
      eq({
        instrument_type: "options",
        segment: "FO",
        isin: null,
        symbol: "NIFTY25JAN25000CE",
        entry_price: 100,
        quantity: 50,
        exits: [{ exit_price: 120, quantity: 50, exit_date: "2025-01-02T14:00:00" }],
      }),
    );
    expect(c.brokerage).toBe(40); // 20 * 2 orders
  });
});
