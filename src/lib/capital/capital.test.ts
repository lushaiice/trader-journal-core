/**
 * Capital math tests. Pure functions only.
 *
 * These tests are designed to be runnable with any test runner that supports
 * `describe` / `it` / `expect` (vitest, jest). They are also self-documenting.
 *
 * To run with vitest: `bunx vitest run src/lib/capital`
 */
// @ts-nocheck — works with both vitest and jest globals; no runner is bundled.
import { describe, it, expect } from "vitest";
import {
  buildCapitalLedger,
  capitalAt,
  signedAmount,
  summarizeCapital,
} from "./events";
import {
  buildCapitalAdjustedEquityCurve,
  computeCapitalAdjustedReturn,
} from "./equity";
import type { CapitalEvent } from "@/types/capital";

const ev = (
  id: string,
  type: "initial" | "deposit" | "withdrawal",
  amount: number,
  date: string,
  notes: string | null = null,
): CapitalEvent => ({
  id,
  userId: "u1",
  eventType: type,
  amount,
  eventDate: date,
  notes,
  createdAt: `${date}T10:00:00Z`,
});

describe("capital event math", () => {
  it("withdrawals are negative, deposits positive", () => {
    expect(signedAmount({ eventType: "deposit", amount: 100 })).toBe(100);
    expect(signedAmount({ eventType: "initial", amount: 100 })).toBe(100);
    expect(signedAmount({ eventType: "withdrawal", amount: 100 })).toBe(-100);
  });

  it("ledger accumulates running capital chronologically", () => {
    const events = [
      ev("a", "initial", 200000, "2025-01-01"),
      ev("b", "deposit", 50000, "2025-03-01"),
      ev("c", "withdrawal", 20000, "2025-04-01"),
    ];
    const ledger = buildCapitalLedger(events);
    expect(ledger.map((p) => p.runningCapital)).toEqual([200000, 250000, 230000]);
  });

  it("capitalAt is point-in-time", () => {
    const events = [
      ev("a", "initial", 100000, "2025-01-01"),
      ev("b", "deposit", 50000, "2025-03-01"),
      ev("c", "withdrawal", 30000, "2025-06-01"),
    ];
    expect(capitalAt(events, new Date("2025-02-15"))).toBe(100000);
    expect(capitalAt(events, new Date("2025-04-15"))).toBe(150000);
    expect(capitalAt(events, new Date("2025-07-01"))).toBe(120000);
  });

  it("summary aggregates correctly", () => {
    const events = [
      ev("a", "initial", 200000, "2025-01-01"),
      ev("b", "deposit", 50000, "2025-02-01"),
      ev("c", "deposit", 25000, "2025-03-01"),
      ev("d", "withdrawal", 30000, "2025-04-01"),
    ];
    const s = summarizeCapital(events);
    expect(s.initialCapital).toBe(200000);
    expect(s.totalDeposits).toBe(75000);
    expect(s.totalWithdrawals).toBe(30000);
    expect(s.netDeposited).toBe(245000);
  });
});

describe("capital-adjusted equity curve", () => {
  const events = [ev("a", "initial", 100000, "2025-01-01")];

  it("deposits do not show as trading P&L", () => {
    const pnl = [{ date: new Date("2025-01-05T00:00:00Z"), netPnl: 5000, tradesClosed: 1 }];
    const withDeposit = [
      ...events,
      ev("dep", "deposit", 50000, "2025-01-10"),
    ];
    const curve = buildCapitalAdjustedEquityCurve(pnl, withDeposit);
    const ret = computeCapitalAdjustedReturn(curve);
    // Trading P&L should ONLY be the 5,000 — never include the 50,000 deposit.
    expect(ret.netTradingPnl).toBe(5000);
    expect(ret.netCashflow).toBe(150000);
    expect(ret.endingEquity).toBe(155000);
  });

  it("withdrawals during drawdowns do not distort net P&L", () => {
    const pnl = [
      { date: new Date("2025-01-05T00:00:00Z"), netPnl: -8000, tradesClosed: 1 },
      { date: new Date("2025-01-15T00:00:00Z"), netPnl: -4000, tradesClosed: 1 },
    ];
    const withWithdraw = [
      ...events,
      ev("wd", "withdrawal", 20000, "2025-01-10"),
    ];
    const curve = buildCapitalAdjustedEquityCurve(pnl, withWithdraw);
    const ret = computeCapitalAdjustedReturn(curve);
    expect(ret.netTradingPnl).toBe(-12000);
    expect(ret.netCashflow).toBe(80000);
    // Equity = 80,000 + (-12,000) = 68,000
    expect(ret.endingEquity).toBe(68000);
  });

  it("equity reconstruction equals cashflow + cumulative pnl at every point", () => {
    const pnl = [
      { date: new Date("2025-01-05T00:00:00Z"), netPnl: 1000, tradesClosed: 1 },
      { date: new Date("2025-02-05T00:00:00Z"), netPnl: -500, tradesClosed: 1 },
      { date: new Date("2025-03-05T00:00:00Z"), netPnl: 2000, tradesClosed: 1 },
    ];
    const flows = [
      ev("a", "initial", 100000, "2025-01-01"),
      ev("b", "deposit", 25000, "2025-02-15"),
    ];
    const curve = buildCapitalAdjustedEquityCurve(pnl, flows);
    for (const p of curve) {
      expect(p.equity).toBe(p.cumulativeCashflow + p.cumulativePnl);
    }
    const last = curve[curve.length - 1];
    expect(last.cumulativePnl).toBe(2500);
    expect(last.cumulativeCashflow).toBe(125000);
  });

  it("capital-adjusted return uses average deployed capital", () => {
    const pnl = [
      { date: new Date("2025-01-15T00:00:00Z"), netPnl: 10000, tradesClosed: 1 },
    ];
    const flows = [ev("a", "initial", 100000, "2025-01-01")];
    const curve = buildCapitalAdjustedEquityCurve(pnl, flows);
    const ret = computeCapitalAdjustedReturn(curve);
    expect(ret.averageCapital).toBe(100000);
    expect(ret.capitalAdjustedReturn).toBeCloseTo(0.1);
  });

  it("empty curve returns null metrics", () => {
    const ret = computeCapitalAdjustedReturn([]);
    expect(ret.netTradingPnl).toBe(0);
    expect(ret.capitalAdjustedReturn).toBeNull();
    expect(ret.averageCapital).toBeNull();
  });
});
