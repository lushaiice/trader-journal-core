// Yahoo Finance provider. Fetches daily closes from the public chart API.
// Swappable: implement MarketDataProvider to replace with e.g. Kite.

export interface PricePoint {
  date: string; // YYYY-MM-DD (UTC)
  close: number;
}

export interface MarketDataProvider {
  getDailyCloses(
    tickers: string[],
    range: string,
  ): Promise<Record<string, PricePoint[]>>;
  getIndexSeries(ticker: string, range: string): Promise<PricePoint[]>;
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

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

async function fetchTicker(
  ticker: string,
  range: string,
): Promise<PricePoint[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    ticker,
  )}?interval=1d&range=${encodeURIComponent(range)}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Yahoo ${ticker} HTTP ${res.status}`);
  const json = (await res.json()) as YahooChartResponse;
  return parseYahooChart(json);
}

export const yahooProvider: MarketDataProvider = {
  async getDailyCloses(tickers, range) {
    const out: Record<string, PricePoint[]> = {};
    for (const t of tickers) {
      try {
        out[t] = await fetchTicker(t, range);
      } catch {
        out[t] = [];
      }
    }
    return out;
  },
  async getIndexSeries(ticker, range) {
    return fetchTicker(ticker, range);
  },
};
