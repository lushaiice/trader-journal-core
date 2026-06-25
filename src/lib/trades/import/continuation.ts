import { supabase } from "@/integrations/supabase/client";
import { aggregateFills } from "./aggregate";
import { parseZerodhaTradebook } from "./zerodha";
import { hashFillIds } from "./persist";
import type {
  Continuation,
  Fill,
  ImportResult,
  ImportWarning,
  ReconstructedTrade,
  SeedPosition,
} from "./types";

export type ClassificationC3 =
  | "new"
  | "duplicate"
  | "overlap"
  | "continuation"
  | "ambiguous";

export interface ClassifiedTradeC3 {
  trade: ReconstructedTrade;
  classification: ClassificationC3;
  matchedFillIds: string[];
  continuation?: Continuation;
  /** Human-readable description of what the continuation will do. */
  continuationSummary?: string;
}

export interface OpenTradeRecord {
  id: string;
  symbol: string;
  side: "long" | "short";
  entry_price: number;
  quantity: number;
  entry_date: string;
  source: string;
  exitedQty: number;
}

/** Load OPEN or PARTIAL trades + their exit totals, partitioned by symbol. */
export async function loadOpenTrades(userId: string): Promise<OpenTradeRecord[]> {
  const { data: trades, error } = await supabase
    .from("trades")
    .select("id,symbol,side,entry_price,quantity,entry_date,source,status")
    .eq("user_id", userId)
    .in("status", ["open", "partial"]);
  if (error) throw error;

  const ids = (trades ?? []).map((t) => t.id);
  if (!ids.length) return [];

  const { data: exits, error: eErr } = await supabase
    .from("trade_exits")
    .select("trade_id,quantity")
    .in("trade_id", ids);
  if (eErr) throw eErr;

  const totals = new Map<string, number>();
  for (const e of exits ?? []) {
    totals.set(e.trade_id, (totals.get(e.trade_id) ?? 0) + Number(e.quantity));
  }

  return (trades ?? []).map((t) => ({
    id: t.id,
    symbol: t.symbol,
    side: t.side as "long" | "short",
    entry_price: Number(t.entry_price),
    quantity: Number(t.quantity),
    entry_date: t.entry_date,
    source: t.source ?? "manual",
    exitedQty: totals.get(t.id) ?? 0,
  }));
}

/**
 * Classify the import in light of (a) the broker_fills ledger and (b) existing
 * open trades.  Continuation candidates are constructed by re-aggregating the
 * new fills against a SeedPosition.
 */
export function classifyWithContinuation(
  parsedFills: Fill[],
  reconstructedFresh: ReconstructedTrade[],
  existingFillIds: Set<string>,
  openTrades: OpenTradeRecord[],
  warningsSink: ImportWarning[],
): { items: ClassifiedTradeC3[]; freshWarnings: ImportWarning[] } {
  // Index open trades by symbol.
  const bySymbol = new Map<string, OpenTradeRecord[]>();
  for (const t of openTrades) {
    if (!bySymbol.has(t.symbol)) bySymbol.set(t.symbol, []);
    bySymbol.get(t.symbol)!.push(t);
  }

  const symbolsInImport = new Set<string>([
    ...reconstructedFresh.map((t) => t.symbol),
    ...parsedFills.map((f) => f.symbol),
  ]);
  const seedBySymbol = new Map<string, SeedPosition>();
  const ambiguousSymbols = new Set<string>();

  for (const symbol of symbolsInImport) {
    const opens = bySymbol.get(symbol) ?? [];
    if (opens.length === 0) continue;
    const manualOpen = opens.find((o) => o.source !== "csv_import");
    if (manualOpen || opens.length > 1) {
      ambiguousSymbols.add(symbol);
      warningsSink.push({
        code: "ambiguous_continuation",
        message:
          opens.length > 1
            ? `Multiple open trades exist for ${symbol}; continuation skipped`
            : `Manual open trade exists for ${symbol}; continuation skipped`,
        symbol,
      });
      continue;
    }
    const o = opens[0];
    const openQty = o.quantity - o.exitedQty;
    if (openQty <= 0) continue;
    seedBySymbol.set(symbol, {
      tradeId: o.id,
      symbol: o.symbol,
      side: o.side,
      entryPrice: o.entry_price,
      entryQuantity: o.quantity,
      openQuantity: openQty,
      earliestEntryAt: new Date(o.entry_date),
    });
  }

  // For continuation-eligible symbols, re-aggregate ONLY their new fills with
  // a seed. Fills that already exist in the ledger are excluded — they're
  // already in the existing trade.
  const continuationsBySymbol = new Map<string, Continuation>();
  const freshWarnings: ImportWarning[] = [];
  if (seedBySymbol.size > 0) {
    const seedSymbols = new Set(seedBySymbol.keys());
    const newFillsForSeeded = parsedFills.filter(
      (f) => seedSymbols.has(f.symbol) && !existingFillIds.has(f.tradeId),
    );
    const seedResult = aggregateFills(newFillsForSeeded, {
      seedPositions: Array.from(seedBySymbol.values()),
    });
    for (const [sym, cont] of seedResult.continuations) {
      continuationsBySymbol.set(sym, cont);
    }
    freshWarnings.push(...seedResult.warnings);
  }

  const items: ClassifiedTradeC3[] = [];
  const seenSymbols = new Set<string>();

  for (const trade of reconstructedFresh) {
    seenSymbols.add(trade.symbol);
    const matched = trade.fillTradeIds.filter((id) => existingFillIds.has(id));
    const allDuplicate =
      matched.length > 0 && matched.length === trade.fillTradeIds.length;

    if (allDuplicate) {
      items.push({ trade, classification: "duplicate", matchedFillIds: matched });
      continue;
    }

    const cont = continuationsBySymbol.get(trade.symbol);
    if (cont && cont.addedFillTradeIds.length > 0) {
      items.push({
        trade,
        classification: "continuation",
        matchedFillIds: matched,
        continuation: cont,
        continuationSummary: summarizeContinuation(cont),
      });
      continue;
    }

    if (ambiguousSymbols.has(trade.symbol)) {
      items.push({ trade, classification: "ambiguous", matchedFillIds: matched });
      continue;
    }

    items.push({
      trade,
      classification: matched.length === 0 ? "new" : "overlap",
      matchedFillIds: matched,
    });
  }

  // Surface symbols that had NO fresh trade (e.g. equity orphan sells skipped
  // by the fresh aggregator) but DO have a continuation against an existing
  // open trade, or are ambiguous, or are pure duplicates. Without this, the
  // preview would silently hide closing fills that legitimately continue a
  // prior open lot.
  for (const symbol of new Set(parsedFills.map((f) => f.symbol))) {
    if (seenSymbols.has(symbol)) continue;
    const symFills = parsedFills.filter((f) => f.symbol === symbol);
    const allKnown =
      symFills.length > 0 && symFills.every((f) => existingFillIds.has(f.tradeId));

    const cont = continuationsBySymbol.get(symbol);
    if (cont && cont.addedFillTradeIds.length > 0) {
      const synthetic = synthesizeFromContinuation(symbol, symFills, cont, seedBySymbol.get(symbol)!);
      items.push({
        trade: synthetic,
        classification: "continuation",
        matchedFillIds: symFills
          .map((f) => f.tradeId)
          .filter((id) => existingFillIds.has(id)),
        continuation: cont,
        continuationSummary: summarizeContinuation(cont),
      });
      continue;
    }

    if (allKnown) {
      const synthetic = synthesizeFromFills(symbol, symFills);
      items.push({
        trade: synthetic,
        classification: "duplicate",
        matchedFillIds: symFills.map((f) => f.tradeId),
      });
      continue;
    }

    if (ambiguousSymbols.has(symbol)) {
      const synthetic = synthesizeFromFills(symbol, symFills);
      items.push({
        trade: synthetic,
        classification: "ambiguous",
        matchedFillIds: symFills
          .map((f) => f.tradeId)
          .filter((id) => existingFillIds.has(id)),
      });
    }
  }

  return { items, freshWarnings };
}

function synthesizeFromFills(
  symbol: string,
  symFills: Fill[],
): ReconstructedTrade {
  const earliest = symFills.reduce((a, b) =>
    a.executedAt.getTime() <= b.executedAt.getTime() ? a : b,
  );
  const qty = symFills.reduce((a, b) => a + b.quantity, 0);
  return {
    symbol,
    instrument_type: earliest.instrumentType,
    side: earliest.side === "buy" ? "long" : "short",
    status: "open",
    entry_date: earliest.tradeDate,
    entry_time: earliest.entryTimeHHMMSS,
    entry_price: earliest.price,
    quantity: qty,
    exits: [],
    brokerage: 0,
    taxes: 0,
    other_fees: 0,
    source: "csv_import",
    fillTradeIds: symFills.map((f) => f.tradeId),
    grossOnly: true,
  };
}

function synthesizeFromContinuation(
  symbol: string,
  symFills: Fill[],
  cont: Continuation,
  seed: SeedPosition,
): ReconstructedTrade {
  return {
    symbol,
    instrument_type: symFills[0]?.instrumentType ?? "equity",
    side: seed.side,
    status: cont.newStatus === "closed" ? "closed" : "open",
    entry_date: seed.earliestEntryAt.toISOString().slice(0, 10),
    entry_time: seed.earliestEntryAt.toISOString().slice(11, 19),
    entry_price: cont.newEntryPrice,
    quantity: cont.newQuantity,
    exits: cont.newExits.map((e) => ({
      exit_price: e.exitPrice,
      quantity: e.quantity,
      exit_date: e.exitDate,
      exit_time: e.exitTime,
    })),
    brokerage: 0,
    taxes: 0,
    other_fees: 0,
    source: "csv_import",
    fillTradeIds: cont.addedFillTradeIds,
    grossOnly: true,
  };
}

export function summarizeContinuation(c: Continuation): string {
  const parts: string[] = [];
  if (c.newExits.length > 0) {
    const qty = c.newExits.reduce((a, e) => a + e.quantity, 0);
    parts.push(`+${c.newExits.length} exit${c.newExits.length === 1 ? "" : "s"} (${qty} qty)`);
  }
  if (c.warnings.includes("added_to_position")) {
    parts.push("entry recomputed");
  }
  parts.push(`now ${c.newStatus.toUpperCase()}`);
  if (c.flipRemainder) parts.push("flip → new opposite trade");
  return parts.join(", ");
}

/* ----------------------------- persistence ----------------------------- */

export interface ApplyContinuationResult {
  applied: boolean;
  appliedExitCount: number;
  appliedFillCount: number;
  flipPersisted: boolean;
  message?: string;
}

/**
 * Apply a Continuation idempotently:
 *   1. CLAIM fills via broker_fills upsert(ignoreDuplicates).
 *   2. Recompute the delta from successfully-claimed fills only.
 *   3. Insert new exits with broker_trade_id (unique idx → idempotent retry).
 *   4. Update trades.entry_price, quantity, status — FACTUAL ONLY.
 *   5. If flipRemainder exists, caller persists via the NEW path.
 *
 * NEVER writes behavioral columns (emotion_*, discipline_*, tags, notes,
 * playbook_id, etc.).
 */
export async function applyContinuation(
  cont: Continuation,
  userId: string,
  broker = "zerodha",
): Promise<ApplyContinuationResult> {
  if (cont.addedFillTradeIds.length === 0) {
    return {
      applied: false,
      appliedExitCount: 0,
      appliedFillCount: 0,
      flipPersisted: false,
      message: "no new fills to apply",
    };
  }

  // 1. Claim fills. onConflict ignoreDuplicates ensures retries don't fail; we
  // then re-query to find which fills are actually OURS for this trade.
  const fillRows = cont.addedFillTradeIds.map((bid) => ({
    user_id: userId,
    broker,
    broker_trade_id: bid,
    imported_trade_id: cont.existingTradeId,
  }));
  const { error: claimErr } = await supabase
    .from("broker_fills")
    .upsert(fillRows, {
      onConflict: "user_id,broker,broker_trade_id",
      ignoreDuplicates: true,
    });
  if (claimErr) throw claimErr;

  // 2. Verify which fills now point at THIS trade (true claim set).
  const { data: ourFills, error: vErr } = await supabase
    .from("broker_fills")
    .select("broker_trade_id,imported_trade_id")
    .eq("user_id", userId)
    .eq("broker", broker)
    .in("broker_trade_id", cont.addedFillTradeIds);
  if (vErr) throw vErr;

  const ownedIds = new Set(
    (ourFills ?? [])
      .filter((r) => r.imported_trade_id === cont.existingTradeId)
      .map((r) => r.broker_trade_id),
  );

  // 3. Insert exits that belong to owned fills — upsert ignoreDuplicates on
  // (user_id, broker_trade_id) means a retry is a no-op.
  const ownedExits = cont.newExits.filter((e) => ownedIds.has(e.brokerTradeId));
  let appliedExitCount = 0;
  if (ownedExits.length > 0) {
    const exitRows = ownedExits.map((e) => ({
      trade_id: cont.existingTradeId,
      user_id: userId,
      exit_price: e.exitPrice,
      quantity: e.quantity,
      exit_date: `${e.exitDate}T${e.exitTime}`,
      broker_trade_id: e.brokerTradeId,
      entry_price: e.entryPrice ?? null,
    }));
    const { error: exErr } = await supabase
      .from("trade_exits")
      .upsert(exitRows, {
        onConflict: "user_id,broker_trade_id",
        ignoreDuplicates: true,
      });
    if (exErr) throw exErr;
    appliedExitCount = ownedExits.length;

  }

  // 4. Update FACTUAL fields on the existing trade. external_ref is also
  // refreshed to reflect the new full fill set.
  // Read the existing trade's external_ref and existing fills to recompute.
  const { data: allFills } = await supabase
    .from("broker_fills")
    .select("broker_trade_id")
    .eq("user_id", userId)
    .eq("broker", broker)
    .eq("imported_trade_id", cont.existingTradeId);
  const allFillIds = (allFills ?? []).map((r) => r.broker_trade_id);
  const external_ref = await hashFillIds(allFillIds);

  const { error: uErr } = await supabase
    .from("trades")
    .update({
      entry_price: cont.newEntryPrice,
      quantity: cont.newQuantity,
      status: cont.newStatus,
      external_ref,
    })
    .eq("id", cont.existingTradeId);
  if (uErr) throw uErr;

  return {
    applied: true,
    appliedExitCount,
    appliedFillCount: ownedIds.size,
    flipPersisted: false,
  };
}

/* ------------------------------ orchestration ------------------------------ */

/** Convenience wrapper: parse → fresh aggregate → classify with continuations. */
export function buildClassifiedImport(
  result: ImportResult,
  parsedFills: Fill[],
  existingFillIds: Set<string>,
  openTrades: OpenTradeRecord[],
): { items: ClassifiedTradeC3[]; warnings: ImportWarning[] } {
  const warnings: ImportWarning[] = [...result.warnings];
  const { items, freshWarnings } = classifyWithContinuation(
    parsedFills,
    result.trades,
    existingFillIds,
    openTrades,
    warnings,
  );
  warnings.push(...freshWarnings);
  return { items, warnings };
}

/** Parse a CSV once and return both reconstructed result and raw fills. */
export function parseForClassification(csvText: string) {
  const parsed = parseZerodhaTradebook(csvText);
  return parsed;
}
