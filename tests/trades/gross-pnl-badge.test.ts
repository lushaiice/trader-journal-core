import { describe, it, expect } from "vitest";
import { isGrossOnly } from "@/components/trades/gross-pnl-badge";

describe("isGrossOnly", () => {
  it("true for csv_import with zero charges", () => {
    expect(isGrossOnly("csv_import", { brokerage: 0, taxes: 0, other_fees: 0 })).toBe(true);
  });
  it("false once any charge is added", () => {
    expect(isGrossOnly("csv_import", { brokerage: 5, taxes: 0, other_fees: 0 })).toBe(false);
    expect(isGrossOnly("csv_import", { brokerage: 0, taxes: 1, other_fees: 0 })).toBe(false);
    expect(isGrossOnly("csv_import", { brokerage: 0, taxes: 0, other_fees: 1 })).toBe(false);
  });
  it("false for manual trades regardless of charges", () => {
    expect(isGrossOnly("manual", { brokerage: 0, taxes: 0, other_fees: 0 })).toBe(false);
  });
  it("handles string/null values", () => {
    expect(isGrossOnly("csv_import", { brokerage: "0", taxes: null, other_fees: undefined })).toBe(true);
    expect(isGrossOnly("csv_import", { brokerage: "5", taxes: null, other_fees: undefined })).toBe(false);
  });
});
