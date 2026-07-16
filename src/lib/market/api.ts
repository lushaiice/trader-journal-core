import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export { BENCHMARK_INDICES, symbolToYahooTicker } from "./indices";
export type { BenchmarkIndex } from "./indices";

export interface LatestPrice {
  symbol: string;
  close: number;
  price_date: string;
  source: string;
}

export interface IndexPoint {
  price_date: string;
  close: number;
}

/**
 * Latest close per requested symbol from market_prices.
 * Returns at most one row per symbol (the most recent price_date).
 */
export function useLatestPrices(symbols: string[]) {
  const { user } = useAuth();
  const key = [...symbols].map((s) => s.toUpperCase()).sort();
  return useQuery({
    queryKey: ["market", "latest-prices", key],
    enabled: !!user && symbols.length > 0,
    queryFn: async (): Promise<LatestPrice[]> => {
      const { data, error } = await supabase
        .from("market_prices")
        .select("symbol, close, price_date, source")
        .in("symbol", symbols)
        .order("price_date", { ascending: false });
      if (error) throw error;
      const latest = new Map<string, LatestPrice>();
      for (const row of data ?? []) {
        if (!latest.has(row.symbol)) {
          latest.set(row.symbol, {
            symbol: row.symbol,
            close: Number(row.close),
            price_date: row.price_date,
            source: row.source,
          });
        }
      }
      return Array.from(latest.values());
    },
  });
}

export function useIndexSeries(indexCode: string, fromDate?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["market", "index-series", indexCode, fromDate ?? null],
    enabled: !!user && !!indexCode,
    queryFn: async (): Promise<IndexPoint[]> => {
      let q = supabase
        .from("index_history")
        .select("price_date, close")
        .eq("index_code", indexCode)
        .order("price_date", { ascending: true });
      if (fromDate) q = q.gte("price_date", fromDate);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map((r) => ({
        price_date: r.price_date,
        close: Number(r.close),
      }));
    },
  });
}

export interface MarketFreshness {
  fetchedAt: string | null;
  source: string | null;
}

export function useMarketDataFreshness() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["market", "freshness"],
    enabled: !!user,
    queryFn: async (): Promise<MarketFreshness> => {
      const { data, error } = await supabase
        .from("market_prices")
        .select("fetched_at, source")
        .order("fetched_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      const row = data?.[0];
      return {
        fetchedAt: row?.fetched_at ?? null,
        source: row?.source ?? null,
      };
    },
  });
}
