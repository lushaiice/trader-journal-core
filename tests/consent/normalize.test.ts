import { describe, expect, it } from "vitest";
import { normalizeIndianMobile } from "@/lib/consent/api";

describe("normalizeIndianMobile", () => {
  it("accepts 10-digit mobile starting with 6-9", () => {
    expect(normalizeIndianMobile("9876543210")).toBe("+919876543210");
    expect(normalizeIndianMobile("6012345678")).toBe("+916012345678");
  });
  it("accepts +91 and 91 prefixes", () => {
    expect(normalizeIndianMobile("+91 98765 43210")).toBe("+919876543210");
    expect(normalizeIndianMobile("919876543210")).toBe("+919876543210");
  });
  it("rejects invalid numbers", () => {
    expect(normalizeIndianMobile("")).toBeNull();
    expect(normalizeIndianMobile("12345")).toBeNull();
    expect(normalizeIndianMobile("1234567890")).toBeNull(); // starts with 1
    expect(normalizeIndianMobile("+1 415 555 0100")).toBeNull();
  });
});
