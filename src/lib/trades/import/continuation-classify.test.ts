import { describe, it, expect } from "vitest";
import {
  classifyWithContinuation,
  summarizeContinuation,
  type OpenTradeRecord,
} from "./continuation";
import { aggregateFills } from "./aggregate";
import type { Fill, ImportWarning } from "./types";

let tid = 0;
const mkFill = (o: Partial<Fill> & Pick<Fill, "side" | "quantity" | "price"> & { time?: string; symbol?: string; orderId?: string }): Fill => {
  tid++;
  const time = o.time ?? `2026-02-01T09:30:${String(tid).padStart(2, "0")}`;
  return {
    symbol: o.symbol ?? "RELIANCE",
    instrumentType: "equity",
    side: o.side,
    quantity: o.quantity,
    price: o.price,
    tradeId: o.tradeId ?? `T${tid}`,
    orderId: o.orderId ?? `O${tid}`,
    executedAt: new Date(time + "Z"),
    tradeDate: time.slice(0, 10),
    entryTimeHHMMSS: time.slice(11, 19),
    exchange: "NSE",
    segment: "EQ",
    series: "EQ",
    expiryDate: null,
  };
};

const openRec = (overrides: Partial<OpenTradeRecord> = {}): OpenTradeRecord => ({
  id: "open-1",
  symbol: "RELIANCE",
  side: "long",
  entry_price: 100,
  quantity: 10,
  entry_date: "2026-01-15T09:30:00Z",
  source: "csv_import",
  exitedQty: 0,
  ...overrides,
});

function reconstruct(fills: Fill[]) {
  return aggregateFills(fills).trades;
}

describe("classifyWithContinuation", () => {
  it("marks continuation when exactly one csv_import open trade matches", () => {
    const fills = [mkFill({ side: "sell", quantity: 10, price: 120 })];
    const fresh = reconstruct(fills);
    const sink: ImportWarning[] = [];
    const { items } = classifyWithContinuation(fills, fresh, new Set(), [openRec()], sink);
    expect(items.length).toBe(1);
    expect(items[0].classification).toBe("continuation");
    expect(items[0].continuation!.newStatus).toBe("closed");
    expect(summarizeContinuation(items[0].continuation!)).toMatch(/CLOSED/);
  });

  it("ambiguous when a MANUAL open trade exists for symbol", () => {
    const fills = [mkFill({ side: "sell", quantity: 10, price: 120 })];
    const fresh = reconstruct(fills);
    const sink: ImportWarning[] = [];
    const { items } = classifyWithContinuation(
      fills,
      fresh,
      new Set(),
      [openRec({ source: "manual" })],
      sink,
    );
    expect(items[0].classification).toBe("ambiguous");
    expect(sink.some((w) => w.code === "ambiguous_continuation")).toBe(true);
  });

  it("ambiguous when TWO open imported trades exist for symbol", () => {
    const fills = [mkFill({ side: "sell", quantity: 10, price: 120 })];
    const fresh = reconstruct(fills);
    const sink: ImportWarning[] = [];
    const { items } = classifyWithContinuation(
      fills,
      fresh,
      new Set(),
      [openRec({ id: "a" }), openRec({ id: "b" })],
      sink,
    );
    expect(items[0].classification).toBe("ambiguous");
  });

  it("falls back to new/overlap when no open trade exists for symbol", () => {
    const fills = [
      mkFill({ side: "buy", quantity: 5, price: 1500, symbol: "INFY" }),
      mkFill({ side: "sell", quantity: 5, price: 1550, symbol: "INFY" }),
    ];
    const fresh = reconstruct(fills);
    const sink: ImportWarning[] = [];
    const { items } = classifyWithContinuation(fills, fresh, new Set(), [], sink);
    expect(items[0].classification).toBe("new");
  });

  it("idempotency: re-import same fills against ledger → no continuation, marked duplicate", () => {
    const fills = [mkFill({ side: "sell", quantity: 10, price: 120 })];
    const fresh = reconstruct(fills);
    const sink: ImportWarning[] = [];
    const existing = new Set(fills.map((f) => f.tradeId));
    const { items } = classifyWithContinuation(fills, fresh, existing, [openRec()], sink);
    expect(items[0].classification).toBe("duplicate");
  });
});
