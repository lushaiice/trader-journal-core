import { describe, it, expect } from "vitest";
import { computeRebalance } from "@/lib/portfolio/rebalance";

describe("computeRebalance", () => {
  const holdings = [
    { symbol: "A", marketValue: 6000, lastClose: 100 },
    { symbol: "B", marketValue: 4000, lastClose: 200 },
  ];

  it("50/50 split rebalances correctly", () => {
    const r = computeRebalance(holdings, { A: 50, B: 50 });
    expect(r.total).toBe(10000);
    expect(r.targetsSumPct).toBe(100);
    expect(r.unallocatedPct).toBe(0);
    expect(r.overAllocated).toBe(false);

    const a = r.rows.find((x) => x.symbol === "A")!;
    expect(a.targetValue).toBe(5000);
    expect(a.deltaValue).toBe(-1000);
    expect(a.deltaShares).toBe(-10);
    expect(a.action).toBe("sell");

    const b = r.rows.find((x) => x.symbol === "B")!;
    expect(b.targetValue).toBe(5000);
    expect(b.deltaValue).toBe(1000);
    expect(b.deltaShares).toBe(5);
    expect(b.action).toBe("buy");
  });

  it("targets summing < 100 imply cash bucket and net sells", () => {
    const r = computeRebalance(holdings, { A: 30, B: 30 });
    expect(r.targetsSumPct).toBe(60);
    expect(r.unallocatedPct).toBe(40);
    expect(r.overAllocated).toBe(false);
    for (const row of r.rows) {
      expect(row.action).toBe("sell");
      expect(row.deltaValue).toBeLessThan(0);
    }
  });

  it("targets summing > 100 flag overAllocated", () => {
    const r = computeRebalance(holdings, { A: 70, B: 60 });
    expect(r.targetsSumPct).toBe(130);
    expect(r.overAllocated).toBe(true);
    expect(r.unallocatedPct).toBe(-30);
  });

  it("lastClose 0 yields null deltaShares", () => {
    const r = computeRebalance(
      [{ symbol: "X", marketValue: 1000, lastClose: 0 }],
      { X: 50 },
    );
    expect(r.rows[0].deltaShares).toBeNull();
  });

  it("holds when target equals current", () => {
    const r = computeRebalance(holdings, { A: 60, B: 40 });
    for (const row of r.rows) {
      expect(row.action).toBe("hold");
      expect(Math.abs(row.deltaValue)).toBeLessThan(1);
    }
  });
});
