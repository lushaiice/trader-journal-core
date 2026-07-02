import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import type { ReconstructedTrade } from "./index";

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
        brokerage: 0,
        taxes: 0,
        other_fees: 0,
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
