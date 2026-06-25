import { describe, it, expect } from "vitest";
import { allocateChargesToTrades } from "./allocate-charges";
import { parseBrokerPnlReport } from "./zerodha-pnl";
import type { ReconstructedTrade } from "./types";

function mk(
  symbol: string,
  entry: number,
  exit: number,
  qty: number,
  side: "long" | "short" = "long",
): ReconstructedTrade {
  return {
    symbol,
    instrument_type: "equity",
    side,
    status: "closed",
    entry_date: "2026-01-02",
    entry_time: "09:30:00",
    entry_price: entry,
    quantity: qty,
    exits: [
      { exit_price: exit, quantity: qty, exit_date: "2026-01-02", exit_time: "10:00:00" },
    ],
    brokerage: 0,
    taxes: 0,
    other_fees: 0,
    source: "csv_import",
    fillTradeIds: [`${symbol}-${entry}-${exit}`],
    grossOnly: true,
  };
}

describe("allocateChargesToTrades", () => {
  it("matches Zerodha net P&L within ₹0.01 after allocation", () => {
    const trades = [
      mk("RELIANCE", 1000, 1100, 10), // gross +1000
      mk("INFY", 500, 480, 20), // gross -400
    ];
    const csv = [
      "Symbol,Profit,Brokerage,STT,GST",
      "RELIANCE,940,40,15,5", // broker net 940, charges 60
      "INFY,-440,30,7,3", // broker net -440, charges 40
    ].join("\n");
    const report = parseBrokerPnlReport(csv);
    const result = allocateChargesToTrades(trades, report);

    const reliance = result.trades.find((t) => t.symbol === "RELIANCE")!;
    const infy = result.trades.find((t) => t.symbol === "INFY")!;
    const grossR = 1000;
    const grossI = -400;
    const netR = grossR - (reliance.brokerage + reliance.taxes + reliance.other_fees);
    const netI = grossI - (infy.brokerage + infy.taxes + infy.other_fees);
    expect(netR).toBeCloseTo(940, 2);
    expect(netI).toBeCloseTo(-440, 2);
    expect(result.totalAllocated).toBeCloseTo(100, 2);
  });

  it("allocates pro-rata across multiple trades for the same symbol", () => {
    const trades = [
      mk("X", 100, 110, 10), // gross +100
      mk("X", 100, 130, 10), // gross +300
    ];
    const csv = "Symbol,Profit,Brokerage\nX,360,40";
    const report = parseBrokerPnlReport(csv);
    const result = allocateChargesToTrades(trades, report);
    const a = result.trades[0];
    const b = result.trades[1];
    const totalCharges =
      a.brokerage + a.taxes + a.other_fees + b.brokerage + b.taxes + b.other_fees;
    expect(totalCharges).toBeCloseTo(40, 2);
    // pro-rata by gross: 100/400 = 25%, 300/400 = 75%
    const aTotal = a.brokerage + a.taxes + a.other_fees;
    expect(aTotal).toBeCloseTo(10, 1);
  });

  it("flags symbols with no matching charges row", () => {
    const trades = [mk("ALONE", 100, 110, 5)];
    const csv = "Symbol,Profit,Brokerage\nOTHER,100,10";
    const report = parseBrokerPnlReport(csv);
    const result = allocateChargesToTrades(trades, report);
    expect(result.symbolsWithoutCharges).toContain("ALONE");
    expect(result.unmatchedChargeSymbols).toContain("OTHER");
    expect(result.totalAllocated).toBe(0);
  });

  it("falls back to notional weighting when all gross are zero", () => {
    const trades = [
      mk("Y", 100, 100, 10), // gross 0, notional 1000
      mk("Y", 100, 100, 30), // gross 0, notional 3000
    ];
    const csv = "Symbol,Profit,Brokerage\nY,-40,40";
    const report = parseBrokerPnlReport(csv);
    const result = allocateChargesToTrades(trades, report);
    const a = result.trades[0].taxes;
    const b = result.trades[1].taxes;
    expect(a + b).toBeCloseTo(40, 2);
    expect(b).toBeGreaterThan(a); // 3000 > 1000 weight
  });
});
