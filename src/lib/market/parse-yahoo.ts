// Pure parser for the Yahoo Finance chart JSON shape.
// Mirrors the Deno-side parser in supabase/functions/sync-market-data/yahoo-provider.ts
// (kept here so it is unit-testable under Vitest without pulling in Deno).

export interface PricePoint {
  date: string;
  close: number;
}

export interface YahooChartResponse {
  chart: {
    result: Array<{
      timestamp?: number[];
      indicators: { quote: Array<{ close?: Array<number | null> }> };
    }> | null;
    error: unknown;
  };
}

export function parseYahooChart(json: YahooChartResponse): PricePoint[] {
  const result = json?.chart?.result?.[0];
  if (!result) return [];
  const ts = result.timestamp ?? [];
  const closes = result.indicators?.quote?.[0]?.close ?? [];
  const points: PricePoint[] = [];
  for (let i = 0; i < ts.length; i++) {
    const c = closes[i];
    if (c === null || c === undefined || Number.isNaN(c)) continue;
    const d = new Date(ts[i] * 1000);
    const iso = d.toISOString().slice(0, 10);
    points.push({ date: iso, close: Number(c) });
  }
  return points;
}
