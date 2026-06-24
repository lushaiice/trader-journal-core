import { describe, it, expect } from "vitest";
import { classifyTrades, hashFillIds } from "./persist";
import type { ReconstructedTrade } from "./types";

function mk(symbol: string, fillTradeIds: string[]): ReconstructedTrade {
  return {
    symbol,
    instrument_type: "equity",
    side: "long",
    status: "closed",
    entry_date: "2026-01-02",
    entry_time: "09:30:00",
    entry_price: 100,
    quantity: 10,
    exits: [
      { exit_price: 110, quantity: 10, exit_date: "2026-01-02", exit_time: "10:00:00" },
    ],
    brokerage: 0,
    taxes: 0,
    other_fees: 0,
    source: "csv_import",
    fillTradeIds,
    grossOnly: true,
  };
}

describe("classifyTrades", () => {
  const trades = [
    mk("RELIANCE", ["a", "b"]),
    mk("INFY", ["c"]),
    mk("TCS", ["d", "e"]),
  ];

  it("marks all-new when ledger is empty", () => {
    const c = classifyTrades(trades, []);
    expect(c.map((x) => x.classification)).toEqual(["new", "new", "new"]);
  });

  it("marks fully-duplicate when all fills already ingested", () => {
    const c = classifyTrades(trades, ["a", "b", "c", "d", "e"]);
    expect(c.map((x) => x.classification)).toEqual([
      "duplicate",
      "duplicate",
      "duplicate",
    ]);
  });

  it("marks overlap when only some fills already ingested", () => {
    const c = classifyTrades(trades, ["a"]); // 'a' belongs to RELIANCE only
    expect(c[0].classification).toBe("overlap");
    expect(c[1].classification).toBe("new");
    expect(c[2].classification).toBe("new");
  });

  it("re-importing the same set yields all duplicates (round-trip)", () => {
    const allIds = trades.flatMap((t) => t.fillTradeIds);
    const c = classifyTrades(trades, allIds);
    expect(c.every((x) => x.classification === "duplicate")).toBe(true);
  });
});

describe("hashFillIds", () => {
  it("is deterministic regardless of order", async () => {
    const a = await hashFillIds(["x", "y", "z"]);
    const b = await hashFillIds(["z", "x", "y"]);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("differs for different inputs", async () => {
    const a = await hashFillIds(["x", "y"]);
    const b = await hashFillIds(["x", "y", "z"]);
    expect(a).not.toBe(b);
  });
});
