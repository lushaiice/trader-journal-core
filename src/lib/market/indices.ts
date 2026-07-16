// Benchmark index config (client mirror of supabase/functions/sync-market-data/config.ts).
// Keep in sync manually — small, changes rarely.

export interface BenchmarkIndex {
  code: string;
  yahooTicker: string;
  displayName: string;
}

export const BENCHMARK_INDICES: BenchmarkIndex[] = [
  { code: "NIFTY50", yahooTicker: "^NSEI", displayName: "Nifty 50" },
  { code: "NIFTY100", yahooTicker: "^CNX100", displayName: "Nifty 100" },
  { code: "NIFTYMIDCAP50", yahooTicker: "^NSEMDCP50", displayName: "Nifty Midcap 50" },
  { code: "NIFTYMIDCAP150", yahooTicker: "NIFTYMIDCAP150.NS", displayName: "Nifty Midcap 150" },
  { code: "NIFTYSMLCAP50", yahooTicker: "NIFTYSMLCAP50.NS", displayName: "Nifty Smallcap 50" },
  { code: "NIFTYSMLCAP250", yahooTicker: "NIFTYSMLCAP250.NS", displayName: "Nifty Smallcap 250" },
  { code: "NIFTY500", yahooTicker: "^CRSLDX", displayName: "Nifty 500" },
];

export const SYMBOL_YAHOO_OVERRIDES: Record<string, string> = {};

export function symbolToYahooTicker(symbol: string): string {
  const override = SYMBOL_YAHOO_OVERRIDES[symbol.toUpperCase()];
  if (override) return override;
  return `${symbol.toUpperCase()}.NS`;
}
