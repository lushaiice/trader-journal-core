import { describe, it, expect } from "vitest";
import { parseBrokerPnlReport } from "./zerodha-pnl";

describe("parseBrokerPnlReport", () => {
  it("parses a basic per-symbol P&L file with explicit charges columns", () => {
    const csv = [
      "Symbol,Buy Value,Sell Value,Profit,Brokerage,STT,Exchange charges,SEBI,Stamp,GST",
      "RELIANCE,10000,10500,500,40,5,2,0.1,1,8",
      "INFY,5000,4800,-200,40,3,1,0.1,0.5,8",
    ].join("\n");
    const r = parseBrokerPnlReport(csv);
    expect(r.rows).toHaveLength(2);
    const rel = r.bySymbol.get("RELIANCE")!;
    expect(rel.realizedPnl).toBe(500);
    // 40 + 5 + 2 + 0.1 + 1 + 8 = 56.1
    expect(rel.charges).toBeCloseTo(56.1, 2);
  });

  it("aggregates multiple rows per symbol", () => {
    const csv = [
      "Symbol,Profit,Brokerage",
      "RELIANCE,100,10",
      "RELIANCE,200,20",
    ].join("\n");
    const r = parseBrokerPnlReport(csv);
    const rel = r.bySymbol.get("RELIANCE")!;
    expect(rel.realizedPnl).toBe(300);
    expect(rel.charges).toBe(30);
  });

  it("ignores metadata rows above the header", () => {
    const csv = [
      "Tradewise P&L Report",
      "Generated on,2026-01-01",
      "",
      "Symbol,Profit,Brokerage",
      "TCS,150,12",
    ].join("\n");
    const r = parseBrokerPnlReport(csv);
    expect(r.bySymbol.get("TCS")?.realizedPnl).toBe(150);
  });

  it("infers charges from gross - net when only those columns exist", () => {
    const csv = [
      "Symbol,Gross Profit,Net Profit",
      "WIPRO,500,440",
    ].join("\n");
    const r = parseBrokerPnlReport(csv);
    const w = r.bySymbol.get("WIPRO")!;
    expect(w.realizedPnl).toBe(440);
    expect(w.charges).toBeCloseTo(60, 2);
  });

  it("handles ₹ symbols, commas, and parenthesized negatives", () => {
    const csv = [
      "Symbol,P&L,Brokerage",
      'ITC,"₹1,250.50",40',
      'HDFC,"(₹350.25)",20',
    ].join("\n");
    const r = parseBrokerPnlReport(csv);
    expect(r.bySymbol.get("ITC")?.realizedPnl).toBeCloseTo(1250.5, 2);
    expect(r.bySymbol.get("HDFC")?.realizedPnl).toBeCloseTo(-350.25, 2);
  });

  it("skips Total/Grand Total summary rows", () => {
    const csv = [
      "Symbol,Profit",
      "A,100",
      "B,200",
      "Total,300",
    ].join("\n");
    const r = parseBrokerPnlReport(csv);
    expect(r.rows).toHaveLength(2);
    expect(r.totals.realizedPnl).toBe(300);
  });

  it("returns warning when format is unrecognized", () => {
    const csv = "foo,bar,baz\n1,2,3";
    const r = parseBrokerPnlReport(csv);
    expect(r.rows).toHaveLength(0);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});
