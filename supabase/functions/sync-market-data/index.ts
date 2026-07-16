// Edge function: sync-market-data
// Fetches end-of-day market data from a swappable provider (currently Yahoo Finance)
// and upserts index_history + market_prices. Service-role writes only.
// deno-lint-ignore-file no-explicit-any

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { yahooProvider, type MarketDataProvider } from "./yahoo-provider.ts";
import { BENCHMARK_INDICES, symbolToYahooTicker } from "./config.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const provider: MarketDataProvider = yahooProvider;

interface RunResult {
  indicesUpdated: number;
  symbolsUpdated: number;
  failures: Array<{ target: string; error: string }>;
}

async function syncIndices(supabase: any, result: RunResult) {
  for (const idx of BENCHMARK_INDICES) {
    try {
      const series = await provider.getIndexSeries(idx.yahooTicker, "2y");
      if (!series.length) continue;
      const rows = series.map((s) => ({
        index_code: idx.code,
        yahoo_ticker: idx.yahooTicker,
        price_date: s.date,
        close: s.close,
        source: "yahoo",
        fetched_at: new Date().toISOString(),
      }));
      const { error } = await supabase
        .from("index_history")
        .upsert(rows, { onConflict: "index_code,price_date" });
      if (error) throw error;
      result.indicesUpdated += 1;
    } catch (e) {
      result.failures.push({ target: `index:${idx.code}`, error: String(e) });
    }
  }
}

async function syncSymbols(
  supabase: any,
  symbols: Array<{ symbol: string; isin: string | null }>,
  result: RunResult,
) {
  for (const { symbol, isin } of symbols) {
    const ticker = symbolToYahooTicker(symbol);
    try {
      const series = await provider.getDailyCloses([ticker], "5d");
      const points = series[ticker] ?? [];
      if (!points.length) continue;
      const rows = points.map((p) => ({
        isin,
        symbol,
        yahoo_ticker: ticker,
        price_date: p.date,
        close: p.close,
        source: "yahoo",
        fetched_at: new Date().toISOString(),
      }));
      const { error } = await supabase
        .from("market_prices")
        .upsert(rows, { onConflict: "symbol,price_date" });
      if (error) throw error;
      result.symbolsUpdated += 1;
    } catch (e) {
      result.failures.push({ target: `symbol:${symbol}`, error: String(e) });
    }
  }
}

async function getHeldSymbols(
  supabase: any,
): Promise<Array<{ symbol: string; isin: string | null }>> {
  const { data, error } = await supabase
    .from("trades")
    .select("symbol, isin")
    .in("status", ["open", "partial"]);
  if (error) throw error;
  const seen = new Map<string, string | null>();
  for (const row of data ?? []) {
    if (!row.symbol) continue;
    if (!seen.has(row.symbol)) seen.set(row.symbol, row.isin ?? null);
  }
  return Array.from(seen.entries()).map(([symbol, isin]) => ({ symbol, isin }));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const result: RunResult = {
    indicesUpdated: 0,
    symbolsUpdated: 0,
    failures: [],
  };

  let requestedSymbols: string[] | null = null;
  try {
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (Array.isArray(body?.symbols) && body.symbols.length > 0) {
        requestedSymbols = body.symbols.filter(
          (s: unknown) => typeof s === "string" && s.length > 0,
        );
      }
    }
  } catch {
    // ignore
  }

  try {
    await syncIndices(supabase, result);

    let symbols: Array<{ symbol: string; isin: string | null }>;
    if (requestedSymbols && requestedSymbols.length > 0) {
      // On-demand refresh: look up isin for provided symbols where possible.
      const { data } = await supabase
        .from("trades")
        .select("symbol, isin")
        .in("symbol", requestedSymbols);
      const isinBySymbol = new Map<string, string | null>();
      for (const row of data ?? []) {
        if (!isinBySymbol.has(row.symbol)) isinBySymbol.set(row.symbol, row.isin ?? null);
      }
      symbols = requestedSymbols.map((s) => ({
        symbol: s,
        isin: isinBySymbol.get(s) ?? null,
      }));
    } else {
      symbols = await getHeldSymbols(supabase);
    }

    await syncSymbols(supabase, symbols, result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ ...result, error: String(e) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
