import { describe, it, expect, beforeEach, vi } from "vitest";
import { observability } from "../../src/lib/observability";

describe("observability — categorization", () => {
  beforeEach(() => {
    observability.clear();
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("infers auth category from scope", () => {
    observability.error("auth", "session expired");
    expect(observability.recent()[0].category).toBe("auth");
  });

  it("infers network category from message", () => {
    observability.warn("api", "fetch timeout exceeded");
    expect(observability.recent()[0].category).toBe("network");
  });

  it("infers storage category", () => {
    observability.error("upload", "storage bucket rejected file");
    expect(observability.recent()[0].category).toBe("storage");
  });

  it("respects explicit category override", () => {
    observability.warn("misc", "something", { category: "validation" });
    expect(observability.recent()[0].category).toBe("validation");
  });

  it("falls back to unknown", () => {
    observability.info("misc", "hello world");
    expect(observability.recent()[0].category).toBe("unknown");
  });

  it("includes env tag on every event", () => {
    observability.info("misc", "hello");
    expect(observability.recent()[0].env).toBeTruthy();
  });
});
