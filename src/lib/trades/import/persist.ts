import { supabase } from "@/integrations/supabase/client";
import { applyContinuation, type ClassifiedTradeC3 } from "./continuation";
import type { ReconstructedTrade } from "./types";

export type Classification = "new" | "duplicate" | "overlap";

export interface ClassifiedTrade {
  trade: ReconstructedTrade;
  classification: Classification;
  matchedFillIds: string[];
}

/**
 * Pure classification (C2 surface, kept for back-compat with existing tests):
 * given a set of broker_trade_ids already ingested for this user, decide for
 * each reconstructed trade whether it is NEW, DUPLICATE, or OVERLAP.
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
  continued: number;
  skippedDuplicate: number;
  flaggedOverlap: number;
  failed: number;
  errors: Array<{ symbol: string; message: string }>;
  warnings: Array<{ symbol: string; message: string }>;
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
 * Replace mode: delete prior CSV-imported trades for this user + broker so the
 * incoming file becomes the authoritative history. Manual trades
 * (source IS NULL / not 'csv_import') are NEVER touched.
 *
 * Scope: trades whose id appears in broker_fills for this (user, broker).
 * Returns the number of trades removed.
 */
export async function replaceImportedTrades(
  userId: string,
  broker = "zerodha",
): Promise<number> {
  // Find every trade_id this broker has previously claimed for the user.
  const { data: fillRows, error: fErr } = await supabase
    .from("broker_fills")
    .select("imported_trade_id")
    .eq("user_id", userId)
    .eq("broker", broker)
    .not("imported_trade_id", "is", null);
  if (fErr) throw fErr;

  const tradeIds = Array.from(
    new Set(
      (fillRows ?? [])
        .map((r) => r.imported_trade_id as string | null)
        .filter((id): id is string => !!id),
    ),
  );

  // Always wipe this broker's dedup ledger so a fresh re-import can re-claim
  // the same broker_trade_ids, even if no trades were linked.
  const { error: delFillsErr } = await supabase
    .from("broker_fills")
    .delete()
    .eq("user_id", userId)
    .eq("broker", broker);
  if (delFillsErr) throw delFillsErr;

  if (tradeIds.length === 0) return 0;

  // Safety net: only delete trades that are CSV-imported AND owned by this user.
  // (Defense-in-depth — RLS already enforces ownership.)
  const chunkSize = 100;
  let removed = 0;
  for (let i = 0; i < tradeIds.length; i += chunkSize) {
    const chunk = tradeIds.slice(i, i + chunkSize);
    await supabase.from("trade_exits").delete().in("trade_id", chunk);
    await supabase.from("discipline_logs").delete().in("trade_id", chunk);
    const { data: deleted, error } = await supabase
      .from("trades")
      .delete()
      .in("id", chunk)
      .eq("user_id", userId)
      .eq("source", "csv_import")
      .select("id");
    if (error) throw error;
    removed += deleted?.length ?? 0;
  }
  return removed;
}

/**
 * Persist a C3-classified import:
 *   - "new"          → INSERT a fresh trade (existing C2 path).
 *   - "continuation" → applyContinuation on the existing open trade, then
 *                      persist any flipRemainder as a new trade.
 *   - "duplicate" / "overlap" / "ambiguous" → not inserted (counted).
 *
 * Per-trade try/catch — a single failure never aborts the batch.
 */
export async function persistImportedTrades(
  classified: ClassifiedTradeC3[] | ClassifiedTrade[],
  userId: string,
  broker = "zerodha",
): Promise<PersistSummary> {
  const summary: PersistSummary = {
    imported: 0,
    continued: 0,
    skippedDuplicate: 0,
    flaggedOverlap: 0,
    failed: 0,
    errors: [],
    warnings: [],
  };

  for (const item of classified) {
    if (item.classification === "duplicate") {
      summary.skippedDuplicate++;
      continue;
    }
    if (item.classification === "overlap" || item.classification === "ambiguous") {
      summary.flaggedOverlap++;
      continue;
    }
    if (item.classification === "continuation") {
      const c3 = item as ClassifiedTradeC3;
      if (!c3.continuation) {
        summary.failed++;
        summary.errors.push({
          symbol: item.trade.symbol,
          message: "continuation missing",
        });
        continue;
      }
      try {
        await applyContinuation(c3.continuation, userId, broker);
        summary.continued++;
        if (c3.continuation.flipRemainder) {
          try {
            await persistOne(c3.continuation.flipRemainder, userId, broker);
            summary.imported++;
          } catch (err) {
            summary.warnings.push({
              symbol: item.trade.symbol,
              message: `flip remainder failed: ${(err as Error).message}`,
            });
          }
        }
      } catch (err) {
        summary.failed++;
        summary.errors.push({
          symbol: item.trade.symbol,
          message: `continuation failed: ${(err as Error).message} — delete the trade and re-import to retry`,
        });
      }
      continue;
    }
    // "new"
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
      brokerage: t.brokerage ?? 0,
      taxes: t.taxes ?? 0,
      other_fees: t.other_fees ?? 0,
      tags: ["Imported"],
      notes: "Imported from Zerodha tradebook",
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
        entry_price: e.entry_price ?? null,
      })),
    );
    if (eErr) throw eErr;
  }


  // Dedupe within this trade and upsert with ignoreDuplicates so that a
  // broker_trade_id already claimed (e.g. by a continuation earlier in the
  // same batch, or by a flip remainder sharing the closing fill) doesn't
  // violate broker_fills_user_trade_unique.
  // Drop synthetic OPEN-* ids (Phase 3 opening positions) — they aren't broker fills.
  const uniqueFillIds = Array.from(new Set(t.fillTradeIds)).filter(
    (id) => !id.startsWith("OPEN-"),
  );
  if (uniqueFillIds.length === 0) return;
  const { error: fErr } = await supabase.from("broker_fills").upsert(
    uniqueFillIds.map((bid) => ({
      user_id: userId,
      broker,
      broker_trade_id: bid,
      imported_trade_id: tradeId,
    })),
    { onConflict: "user_id,broker,broker_trade_id", ignoreDuplicates: true },
  );
  if (fErr) throw fErr;
}
