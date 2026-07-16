import { describe, it, expect } from "vitest";
import { parseYahooChart } from "@/lib/market/parse-yahoo";
import { symbolToYahooTicker, SYMBOL_YAHOO_OVERRIDES } from "@/lib/market/indices";

describe("parseYahooChart", () => {
  it("returns date/close pairs and drops null closes", () => {
    // 2024-01-02 UTC = 1704153600, +1d = 1704240000, +2d = 1704326400
    const json = {
      chart: {
        result: [
          {
            timestamp: [1704153600, 1704240000, 1704326400],
            indicators: { quote: [{ close: [100.5, null, 101.25] }] },
          },
        ],
        error: null,
      },
    };
    const out = parseYahooChart(json);
    expect(out).toEqual([
      { date: "2024-01-02", close: 100.5 },
      { date: "2024-01-04", close: 101.25 },
    ]);
  });

  it("returns [] when result is missing", () => {
    expect(parseYahooChart({ chart: { result: null, error: "x" } })).toEqual([]);
  });
});

describe("symbolToYahooTicker", () => {
  it("appends .NS by default", () => {
    expect(symbolToYahooTicker("RELIANCE")).toBe("RELIANCE.NS");
    expect(symbolToYahooTicker("infy")).toBe("INFY.NS");
  });

  it("respects overrides", () => {
    SYMBOL_YAHOO_OVERRIDES["WEIRD"] = "WEIRD.BO";
    try {
      expect(symbolToYahooTicker("WEIRD")).toBe("WEIRD.BO");
    } finally {
      delete SYMBOL_YAHOO_OVERRIDES["WEIRD"];
    }
  });
});
