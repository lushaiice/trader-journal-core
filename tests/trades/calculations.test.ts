import { describe, it, expect } from "vitest";
import {
  totalExitQty,
  remainingQty,
  weightedAvgExit,
  tradeStatus,
  grossPnl,
  netPnl,
  totalFees,
  riskPerUnit,
  riskAmount,
  rMultiple,
} from "@/lib/trades/calculations";

const baseTrade = {
  id: "t1",
  user_id: "u1",
  symbol: "RELIANCE",
  side: "long" as const,
  entry_price: 100,
  quantity: 10,
  stop_loss: 90,
  brokerage: 5,
  taxes: 2,
  other_fees: 1,
  // unrelated fields filled to satisfy types loosely
} as any;

const exit = (price: number, qty: number, fees = 0) =>
  ({ id: crypto.randomUUID(), trade_id: "t1", user_id: "u1", exit_price: price, quantity: qty, fees }) as any;

describe("trade calculations", () => {
  it("computes exit quantities and status", () => {
    const exits = [exit(110, 4), exit(120, 6)];
    expect(totalExitQty(exits)).toBe(10);
    expect(remainingQty(10, exits)).toBe(0);
    expect(tradeStatus(baseTrade, exits)).toBe("closed");
    expect(tradeStatus(baseTrade, [exit(105, 4)])).toBe("partial");
    expect(tradeStatus(baseTrade, [])).toBe("open");
  });

  it("weights exits by quantity", () => {
    const exits = [exit(100, 4), exit(120, 6)];
    expect(weightedAvgExit(exits)).toBeCloseTo((400 + 720) / 10);
    expect(weightedAvgExit([])).toBeNull();
  });

  it("computes gross and net P&L for long", () => {
    const exits = [exit(110, 4, 1), exit(120, 6, 2)];
    // gross = (110-100)*4 + (120-100)*6 = 40 + 120 = 160
    expect(grossPnl(baseTrade, exits)).toBe(160);
    // fees = entry(8) + exits(3) = 11; net = 149
    expect(totalFees(baseTrade, exits)).toBe(11);
    expect(netPnl(baseTrade, exits)).toBe(149);
  });

  it("inverts P&L for shorts", () => {
    const t = { ...baseTrade, side: "short" as const };
    const exits = [exit(90, 10)];
    expect(grossPnl(t, exits)).toBe(100); // (90-100)*10*-1 = 100
  });

  it("computes risk and R-multiple", () => {
    expect(riskPerUnit(baseTrade)).toBe(10);
    expect(riskAmount(baseTrade)).toBe(100);
    const exits = [exit(120, 10)]; // +20 / 10 R = 2R
    expect(rMultiple(baseTrade, exits)).toBe(2);
  });

  it("returns null R when no stop or no exits", () => {
    const noStop = { ...baseTrade, stop_loss: null, planned_stop_loss: null };
    expect(rMultiple(noStop, [exit(120, 10)])).toBeNull();
    expect(rMultiple(baseTrade, [])).toBeNull();
  });

  it("falls back to planned stop when actual missing", () => {
    const t = { ...baseTrade, stop_loss: null, planned_stop_loss: 95 };
    expect(riskPerUnit(t)).toBe(5);
  });

  it("handles partial exits incrementally", () => {
    const partial = [exit(105, 5)];
    expect(remainingQty(10, partial)).toBe(5);
    expect(grossPnl(baseTrade, partial)).toBe(25);
  });
});
