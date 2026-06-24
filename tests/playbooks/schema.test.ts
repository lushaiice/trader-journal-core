import { describe, it, expect } from "vitest";
import { playbookFormSchema } from "@/lib/playbooks/schema";

describe("playbookFormSchema", () => {
  it("requires a non-empty name", () => {
    const r = playbookFormSchema.safeParse({ name: "", description: "" });
    expect(r.success).toBe(false);
  });

  it("trims and accepts a basic playbook", () => {
    const r = playbookFormSchema.safeParse({ name: "  ORB  ", description: "" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.name).toBe("ORB");
      expect(r.data.description).toBeNull();
    }
  });

  it("rejects names longer than 80 characters", () => {
    const r = playbookFormSchema.safeParse({ name: "x".repeat(81), description: "" });
    expect(r.success).toBe(false);
  });

  it("rejects descriptions longer than 1000 characters", () => {
    const r = playbookFormSchema.safeParse({
      name: "ORB",
      description: "x".repeat(1001),
    });
    expect(r.success).toBe(false);
  });

  it("normalizes empty description to null", () => {
    const r = playbookFormSchema.safeParse({ name: "VWAP Reclaim", description: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.description).toBeNull();
  });

  it("preserves a real description", () => {
    const r = playbookFormSchema.safeParse({
      name: "VWAP Reclaim",
      description: "Take when price reclaims VWAP after a flush.",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.description).toBe(
        "Take when price reclaims VWAP after a flush.",
      );
    }
  });
});
