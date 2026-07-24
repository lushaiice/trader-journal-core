import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import type { Fill, ReconstructedTrade } from "./types";
import { reconstructFromFills } from "./index";
import type { CorporateAction, HoldingBaseline } from "./corporate-actions";
import { fetchAllUserFills, fillToInsert, rowToFill, upsertFills } from "./fills-repo";
import { computeTradeCharges } from "@/lib/charges/engine";

// Must match the trades.source CHECK constraint: 'manual' | 'csv_import' | 'kite'.
// 'kite' is reserved for the future live Kite Connect integration.
export const IMPORT_SOURCE = "csv_import";

export interface ImportOutcome {
  imported: number;
  skipped: number; // already-imported (dedupe hit)
}

/**
 * Persist reconstructed trades idempotently.
 * - Skips any trade whose source_fill_ids overlap with rows already in
 *   `imported_trade_fills` for this user + source.
 * - Writes: trades → trade_exits → imported_trade_fills, per trade.
 */
async function persistImportedTrades(
  trades: ReconstructedTrade[],
  userId: string,
): Promise<ImportOutcome> {
  if (trades.length === 0) return { imported: 0, skipped: 0 };

  // 1. Look up existing fills for this user, one query. These are the ONLY
  //    fills that gate idempotency — a fill can legitimately map to two
  //    reconstructed trades within one batch (FIFO-split partial close), so
  //    within-batch collisions are not a "skip" signal.
  const allFillIds = Array.from(new Set(trades.flatMap((t) => t.source_fill_ids)));
  const { data: existing, error: existErr } = await supabase
    .from("imported_trade_fills")
    .select("source_fill_id")
    .eq("source", IMPORT_SOURCE)
    .in("source_fill_id", allFillIds);
  if (existErr) throw existErr;
  const preExisting = new Set((existing ?? []).map((r) => r.source_fill_id));

  let imported = 0;
  let skipped = 0;

  for (const t of trades) {
    // Skip only if fills existed BEFORE this batch — i.e. we've imported
    // this trade (or another using the same fill) on a previous run.
    if (t.source_fill_ids.some((id) => preExisting.has(id))) {
      skipped++;
      continue;
    }

    const exitsTotal = t.exits.reduce((a, e) => a + e.quantity, 0);
    const status =
      exitsTotal <= 0 ? "open" : exitsTotal >= t.quantity - 1e-9 ? "closed" : "partial";

    // Estimated Indian retail charges (Zerodha reference). Split across the
    // three fee columns so downstream calc has meaningful labels — total is
    // what matters for Net P&L.
    const ch = computeTradeCharges(t);

    const { data: inserted, error: tradeErr } = await supabase
      .from("trades")
      .insert({
        user_id: userId,
        symbol: t.symbol,
        instrument_type: t.instrument_type,
        side: t.side,
        entry_date: t.entry_date,
        entry_price: t.entry_price,
        quantity: t.quantity,
        brokerage: ch.brokerage,
        taxes: ch.stt + ch.stamp + ch.sebi + ch.gst,
        other_fees: ch.transaction,
        tags: [],
        notes: null,
        screenshot_url: null,
        status,
        source: IMPORT_SOURCE,
      })
      .select("id")
      .single();
    if (tradeErr) throw tradeErr;
    const tradeId = inserted.id;

    if (t.exits.length) {
      const { error: exitErr } = await supabase.from("trade_exits").insert(
        t.exits.map((e) => ({
          trade_id: tradeId,
          user_id: userId,
          exit_price: e.exit_price,
          quantity: e.quantity,
          exit_date: e.exit_date,
        })),
      );
      if (exitErr) throw exitErr;
    }

    // Upsert with ignoreDuplicates: a shared closing fill across two trades
    // in the same batch is legitimate (FIFO split). The UNIQUE
    // (user_id, source, source_fill_id) constraint still guarantees a fill
    // is only ever recorded once — subsequent trades just don't re-record it.
    const { error: fillErr } = await supabase.from("imported_trade_fills").upsert(
      t.source_fill_ids.map((id) => ({
        user_id: userId,
        trade_id: tradeId,
        source: IMPORT_SOURCE,
        source_fill_id: id,
      })),
      { onConflict: "user_id,source,source_fill_id", ignoreDuplicates: true },
    );
    if (fillErr) throw fillErr;

    imported++;
  }

  return { imported, skipped };
}

export function useImportTrades() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (trades: ReconstructedTrade[]) => {
      if (!user) throw new Error("Not signed in");
      return persistImportedTrades(trades, user.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trades"] });
    },
  });
}

export interface ReplaceImportInput {
  /** Newly-parsed fills from the file the user just uploaded. */
  newFills: Fill[];
  actions?: CorporateAction[];
  baselines?: HoldingBaseline[];
}

export interface ReplaceImportOutcome {
  total: number;
  fillsBefore: number;
  fillsAfter: number;
  newFillsPersisted: number;
}

/**
 * Idempotent, incremental, lossless import:
 *  1. Upsert newly-parsed fills into imported_fills (fills-first for retry safety).
 *  2. Re-fetch ALL of this user's imported_fills.
 *  3. Reconstruct the full broker book (net-position + corporate actions + baselines).
 *  4. REPLACE: delete all csv_import trades and insert the rebuilt book with charges.
 *
 * Manual edits made to imported trades are not preserved across a rebuild —
 * that's by design; reflections/journals are separate and untouched.
 */
async function replaceImport(
  userId: string,
  input: ReplaceImportInput,
): Promise<ReplaceImportOutcome> {
  const { newFills, actions = [], baselines = [] } = input;

  // 1. Persist the newly-parsed fills first (retry-safe on failure downstream).
  const inserts = newFills.map((f) => fillToInsert(f, userId));
  await upsertFills(inserts);

  // 2. Rehydrate the full stored fill set.
  const stored = await fetchAllUserFills(userId);
  const fillsAfter = stored.length;
  const fills = stored.map(rowToFill);

  // 3. Reconstruct.
  const { trades } = reconstructFromFills(fills, { actions, baselines });

  // 4. REPLACE csv_import trades. FK cascades on trades → trade_exits and
  //    trades → imported_trade_fills clean up dependent rows.
  const { error: delErr } = await supabase
    .from("trades")
    .delete()
    .eq("user_id", userId)
    .eq("source", IMPORT_SOURCE);
  if (delErr) throw delErr;

  for (const t of trades) {
    const exitsTotal = t.exits.reduce((a, e) => a + e.quantity, 0);
    const status =
      exitsTotal <= 0 ? "open" : exitsTotal >= t.quantity - 1e-9 ? "closed" : "partial";
    const ch = computeTradeCharges(t);

    const { data: inserted, error: tradeErr } = await supabase
      .from("trades")
      .insert({
        user_id: userId,
        symbol: t.symbol,
        instrument_type: t.instrument_type,
        side: t.side,
        entry_date: t.entry_date,
        entry_price: t.entry_price,
        quantity: t.quantity,
        brokerage: ch.brokerage,
        taxes: ch.stt + ch.stamp + ch.sebi + ch.gst,
        other_fees: ch.transaction,
        tags: [],
        notes: null,
        screenshot_url: null,
        status,
        source: IMPORT_SOURCE,
      })
      .select("id")
      .single();
    if (tradeErr) throw tradeErr;

    if (t.exits.length) {
      const { error: exitErr } = await supabase.from("trade_exits").insert(
        t.exits.map((e) => ({
          trade_id: inserted.id,
          user_id: userId,
          exit_price: e.exit_price,
          quantity: e.quantity,
          exit_date: e.exit_date,
        })),
      );
      if (exitErr) throw exitErr;
    }
  }

  return {
    total: trades.length,
    fillsBefore:
      fillsAfter -
      inserts.filter(
        (r) => !stored.some((s) => s.trade_id === r.trade_id && s.segment === r.segment),
      ).length,
    fillsAfter,
    newFillsPersisted: inserts.length,
  };
}

export function useReplaceImport() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ReplaceImportInput) => {
      if (!user) throw new Error("Not signed in");
      return replaceImport(user.id, input);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trades"] });
    },
  });
}
