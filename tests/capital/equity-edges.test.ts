import { describe, it, expect } from "vitest";
import {
  buildCapitalLedger,
  capitalAt,
  signedAmount,
  summarizeCapital,
} from "@/lib/capital/events";
import {
  buildCapitalAdjustedEquityCurve,
  computeCapitalAdjustedReturn,
} from "@/lib/capital/equity";
import type { CapitalEvent } from "@/types/capital";

const ev = (
  id: string,
  type: "initial" | "deposit" | "withdrawal",
  amount: number,
  date: string,
): CapitalEvent => ({
  id,
  userId: "u1",
  eventType: type,
  amount,
  eventDate: date,
  notes: null,
  createdAt: `${date}T10:00:00Z`,
});

describe("capital edge cases", () => {
  it("handles multiple same-day events deterministically", () => {
    const events = [
      ev("a", "initial", 100000, "2026-01-01"),
      ev("b", "deposit", 5000, "2026-02-01"),
      ev("c", "deposit", 3000, "2026-02-01"),
      ev("d", "withdrawal", 2000, "2026-02-01"),
    ];
    const ledger = buildCapitalLedger(events);
    expect(ledger[ledger.length - 1].runningCapital).toBe(106000);
  });

  it("supports zero-equity boundary after full withdrawal", () => {
    const events = [
      ev("a", "initial", 50000, "2026-01-01"),
      ev("b", "withdrawal", 50000, "2026-03-01"),
    ];
    expect(capitalAt(events, new Date("2026-04-01"))).toBe(0);
  });

  it("withdrawal during drawdown does not inflate trading P&L", () => {
    const flows = [
      ev("a", "initial", 100000, "2026-01-01"),
      ev("b", "withdrawal", 10000, "2026-01-15"),
    ];
    const pnl = [
      { date: new Date("2026-01-05T00:00:00Z"), netPnl: -3000, tradesClosed: 1 },
      { date: new Date("2026-01-20T00:00:00Z"), netPnl: -2000, tradesClosed: 1 },
    ];
    const curve = buildCapitalAdjustedEquityCurve(pnl, flows);
    const ret = computeCapitalAdjustedReturn(curve);
    expect(ret.netTradingPnl).toBe(-5000);
    expect(ret.netCashflow).toBe(90000);
    expect(ret.endingEquity).toBe(85000);
  });

  it("running balance is monotonically chronological", () => {
    const flows = [
      ev("a", "initial", 100000, "2026-01-01"),
      ev("b", "deposit", 25000, "2026-02-15"),
      ev("c", "deposit", 10000, "2026-03-10"),
    ];
    const ledger = buildCapitalLedger(flows);
    for (let i = 1; i < ledger.length; i++) {
      expect(ledger[i].date.getTime()).toBeGreaterThanOrEqual(
        ledger[i - 1].date.getTime(),
      );
    }
  });

  it("signed amounts invert withdrawals", () => {
    expect(signedAmount({ eventType: "withdrawal", amount: 500 })).toBe(-500);
    expect(signedAmount({ eventType: "deposit", amount: 500 })).toBe(500);
  });

  it("summary handles empty input safely", () => {
    const s = summarizeCapital([]);
    expect(s.initialCapital).toBe(0);
    expect(s.totalDeposits).toBe(0);
    expect(s.netDeposited).toBe(0);
  });

  it("negative-only return scenario produces negative adjusted return", () => {
    const flows = [ev("a", "initial", 100000, "2026-01-01")];
    const pnl = [{ date: new Date("2026-02-01T00:00:00Z"), netPnl: -8000, tradesClosed: 1 }];
    const curve = buildCapitalAdjustedEquityCurve(pnl, flows);
    const ret = computeCapitalAdjustedReturn(curve);
    expect(ret.capitalAdjustedReturn).toBeLessThan(0);
  });
});
