import { describe, it, expect, beforeEach, vi } from "vitest";
import { observability } from "../../src/lib/observability";

describe("observability — redaction & ring buffer", () => {
  beforeEach(() => {
    observability.clear();
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("redacts sensitive financial keys", () => {
    observability.info("trade", "saved", {
      symbol: "RELIANCE",
      amount: 12345,
      entry_price: 2500,
      quantity: 10,
      nested: { pnl: 999, note: "ok" },
    });
    const [event] = observability.recent();
    expect(event.meta?.symbol).toBe("RELIANCE");
    expect(event.meta?.amount).toBe("[redacted]");
    expect(event.meta?.entry_price).toBe("[redacted]");
    expect((event.meta?.nested as Record<string, unknown>).pnl).toBe("[redacted]");
    expect((event.meta?.nested as Record<string, unknown>).note).toBe("ok");
  });

  it("redacts bare numeric values", () => {
    observability.warn("calc", "anomaly", { value: 42 });
    const [event] = observability.recent();
    expect(event.meta?.value).toBe("[redacted:number]");
  });

  it("caps the ring buffer at 50 events", () => {
    for (let i = 0; i < 80; i++) observability.info("loop", `tick-${i}`);
    expect(observability.recent()).toHaveLength(50);
  });

  it("never persists email or token strings", () => {
    observability.error("auth", "fail", {
      email: "x@y.com",
      access_token: "abc",
      refresh_token: "def",
    });
    const [event] = observability.recent();
    expect(event.meta?.email).toBe("[redacted]");
    expect(event.meta?.access_token).toBe("[redacted]");
    expect(event.meta?.refresh_token).toBe("[redacted]");
  });
});
