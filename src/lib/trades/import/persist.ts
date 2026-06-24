import { supabase } from "@/integrations/supabase/client";
import type { ReconstructedTrade } from "./types";

export type Classification = "new" | "duplicate" | "overlap";

export interface ClassifiedTrade {
  trade: ReconstructedTrade;
  classification: Classification;
  matchedFillIds: string[];
}

/**
 * Pure classification: given a set of broker_trade_ids already ingested for this user,
 * decide for each reconstructed trade whether it is NEW, DUPLICATE, or OVERLAP.
 */
export function classifyTrades(
  trades: ReconstructedTrade[],
  existingFillIds: Iterable<string>,
): ClassifiedTrade[] {
  const known = new Set(existingFillIds);
  return trades.map((trade) => {
    const matched = trade.fillTradeIds.filter((id) => known.has(id));
    let classification: Classification;
    if (matched.length === 0) classification = "new";
    else if (matched.length === trade.fillTradeIds.length) classification = "duplicate";
    else classification = "overlap";
    return { trade, classification, matchedFillIds: matched };
  });
}

/** Deterministic hex hash of a trade's sorted fillTradeIds. Used as trades.external_ref. */
export async function hashFillIds(ids: string[]): Promise<string> {
  const sorted = [...ids].sort();
  const text = sorted.join("|");
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface PersistSummary {
  imported: number;
  skippedDuplicate: number;
  flaggedOverlap: number;
  failed: number;
  errors: Array<{ symbol: string; message: string }>;
}

/** Load existing broker_trade_ids for the user (single query). */
export async function loadExistingFillIds(
  userId: string,
  broker = "zerodha",
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("broker_fills")
    .select("broker_trade_id")
    .eq("user_id", userId)
    .eq("broker", broker);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.broker_trade_id));
}

/**
 * Persist NEW reconstructed trades. DUPLICATE/OVERLAP are not inserted.
 * Per-trade try/catch — a single failure never aborts the batch.
 */
export async function persistImportedTrades(
  classified: ClassifiedTrade[],
  userId: string,
  broker = "zerodha",
): Promise<PersistSummary> {
  const summary: PersistSummary = {
    imported: 0,
    skippedDuplicate: 0,
    flaggedOverlap: 0,
    failed: 0,
    errors: [],
  };

  for (const item of classified) {
    if (item.classification === "duplicate") {
      summary.skippedDuplicate++;
      continue;
    }
    if (item.classification === "overlap") {
      summary.flaggedOverlap++;
      continue;
    }
    try {
      await persistOne(item.trade, userId, broker);
      summary.imported++;
    } catch (err) {
      summary.failed++;
      summary.errors.push({
        symbol: item.trade.symbol,
        message: (err as Error).message,
      });
    }
  }

  return summary;
}

async function persistOne(
  t: ReconstructedTrade,
  userId: string,
  broker: string,
): Promise<void> {
  const external_ref = await hashFillIds(t.fillTradeIds);
  // status from C1: 'closed' | 'open'. Compute partial here for completeness.
  const exitsQty = t.exits.reduce((a, e) => a + e.quantity, 0);
  let status: "open" | "partial" | "closed";
  if (exitsQty <= 0) status = "open";
  else if (exitsQty >= t.quantity) status = "closed";
  else status = "partial";

  const entryDateTime = `${t.entry_date}T${t.entry_time}`;

  const { data: inserted, error: tErr } = await supabase
    .from("trades")
    .insert({
      user_id: userId,
      symbol: t.symbol,
      instrument_type: t.instrument_type,
      side: t.side,
      entry_date: entryDateTime,
      entry_time: t.entry_time,
      entry_price: t.entry_price,
      quantity: t.quantity,
      brokerage: 0,
      taxes: 0,
      other_fees: 0,
      tags: [],
      source: "csv_import",
      external_ref,
      status,
    })
    .select("id")
    .single();
  if (tErr) throw tErr;
  const tradeId = inserted.id;

  if (t.exits.length) {
    const { error: eErr } = await supabase.from("trade_exits").insert(
      t.exits.map((e) => ({
        trade_id: tradeId,
        user_id: userId,
        exit_price: e.exit_price,
        quantity: e.quantity,
        exit_date: `${e.exit_date}T${e.exit_time}`,
      })),
    );
    if (eErr) throw eErr;
  }

  const { error: fErr } = await supabase.from("broker_fills").insert(
    t.fillTradeIds.map((bid) => ({
      user_id: userId,
      broker,
      broker_trade_id: bid,
      imported_trade_id: tradeId,
    })),
  );
  if (fErr) throw fErr;
}
