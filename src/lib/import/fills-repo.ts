import { supabase } from "@/integrations/supabase/client";
import type { Fill } from "./types";

/**
 * Typed access layer for public.imported_fills — the durable per-user store
 * of raw broker fills that drives idempotent, incremental reimports.
 *
 * The table is new; until Supabase types regenerate we access it through a
 * narrow local shim rather than fighting the generated `Database` type.
 */

export interface StoredFillRow {
  id: string;
  user_id: string;
  source: string;
  segment: string;
  symbol: string;
  isin: string | null;
  exchange: string | null;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  trade_id: string;
  order_id: string | null;
  trade_date: string | null;
  order_execution_time: string | null;
  expiry_date: string | null;
  created_at: string;
}

export interface StoredFillInsert {
  user_id: string;
  source: string;
  segment: string;
  symbol: string;
  isin: string | null;
  exchange: string | null;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  trade_id: string;
  order_id: string | null;
  trade_date: string | null;
  order_execution_time: string | null;
  expiry_date: string | null;
}

// Narrow untyped view — the generated Database type doesn't know about
// imported_fills until types regenerate after the migration approval.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = () => (supabase as any).from("imported_fills");

/** Convert an in-memory Fill into a row insert for the current user. */
export function fillToInsert(f: Fill, userId: string, source = "zerodha"): StoredFillInsert {
  return {
    user_id: userId,
    source,
    segment: f.segment.toUpperCase(),
    symbol: f.symbol,
    isin: f.isin,
    exchange: f.exchange ?? null,
    side: f.trade_type,
    quantity: f.quantity,
    price: f.price,
    trade_id: f.trade_id,
    order_id: f.order_id,
    trade_date: f.trade_date || null,
    order_execution_time: f.order_execution_time,
    expiry_date: f.expiry_date,
  };
}

/** Rehydrate a stored row back into an in-memory Fill for reconstruction. */
export function rowToFill(r: StoredFillRow): Fill {
  return {
    symbol: r.symbol,
    segment: r.segment,
    expiry_date: r.expiry_date,
    isin: r.isin,
    exchange: r.exchange ?? "NSE",
    trade_date: r.trade_date ?? "",
    trade_type: r.side,
    quantity: Number(r.quantity),
    price: Number(r.price),
    trade_id: r.trade_id,
    order_id: r.order_id ?? r.trade_id,
    order_execution_time: r.order_execution_time ?? r.trade_date ?? "",
  };
}

export async function fetchAllUserFills(
  userId: string,
  source = "zerodha",
): Promise<StoredFillRow[]> {
  const rows: StoredFillRow[] = [];
  const pageSize = 1000;
  let from = 0;
  // Paginate — a heavy trader can easily exceed the default 1k row cap.
  for (;;) {
    const { data, error } = await table()
      .select(
        "id,user_id,source,segment,symbol,isin,exchange,side,quantity,price,trade_id,order_id,trade_date,order_execution_time,expiry_date,created_at",
      )
      .eq("user_id", userId)
      .eq("source", source)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const chunk = (data ?? []) as StoredFillRow[];
    rows.push(...chunk);
    if (chunk.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

/**
 * Upsert new fills; existing (user_id, source, segment, trade_id) rows are
 * left untouched, so re-importing the same file is a no-op.
 */
export async function upsertFills(rows: StoredFillInsert[]): Promise<void> {
  if (rows.length === 0) return;
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const { error } = await table().upsert(slice, {
      onConflict: "user_id,source,segment,trade_id",
      ignoreDuplicates: true,
    });
    if (error) throw error;
  }
}
