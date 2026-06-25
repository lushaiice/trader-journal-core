import type {
  Fill,
  FillSide,
  ImportWarning,
  ReconstructedExit,
  ReconstructedTrade,
  SeedPosition,
  Continuation,
  OpeningPosition,
  CorporateAction,
} from "./types";

/**
 * Phase 4: rewrite fill quantity / price for any fill that occurred BEFORE
 * a corporate action's ex-date. The broker reports post-CA units for sells
 * after ex-date, so we restate pre-CA buys (and synthetic opening fills)
 * into post-CA units to keep FIFO cost basis consistent.
 *
 * Adjustment factor = ratio_to / ratio_from:
 *  - split 1:2          → factor 2 (qty doubles, price halves)
 *  - bonus 1:1 (2-for-1) → factor 2
 *  - consolidation 5:1  → factor 0.2 (qty shrinks, price scales up)
 */
function applyCorporateActions(
  fills: Fill[],
  cas: CorporateAction[],
): Fill[] {
  if (cas.length === 0) return fills;
  const bySymbol = new Map<string, CorporateAction[]>();
  for (const ca of cas) {
    const list = bySymbol.get(ca.symbol) ?? [];
    list.push(ca);
    bySymbol.set(ca.symbol, list);
  }
  return fills.map((f) => {
    const symCas = bySymbol.get(f.symbol);
    if (!symCas) return f;
    let qty = f.quantity;
    let price = f.price;
    for (const ca of symCas) {
      if (f.tradeDate < ca.exDate && ca.ratioFrom > 0) {
        const factor = ca.ratioTo / ca.ratioFrom;
        qty = qty * factor;
        price = price / factor;
      }
    }
    return { ...f, quantity: qty, price };
  });
}

/** Phase 3: turn opening holdings into synthetic BUY fills dated at acquisition. */
function buildOpeningFills(openings: OpeningPosition[]): Fill[] {
  return openings
    .filter((o) => o.quantity > 0 && o.side === "long")
    .map((o) => ({
      symbol: o.symbol,
      instrumentType: "equity" as const,
      side: "buy" as const,
      quantity: o.quantity,
      price: o.avgCost,
      tradeId: `OPEN-${o.symbol}`,
      orderId: `OPEN-${o.symbol}`,
      executedAt: new Date(`${o.acquisitionDate}T00:00:00Z`),
      tradeDate: o.acquisitionDate,
      entryTimeHHMMSS: "00:00:00",
      exchange: "",
      segment: "EQ",
      series: "EQ",
      expiryDate: null,
    }));
}

interface SplitFill extends Fill {
  // logical quantity to apply (may be a split portion of original fill)
}

/** A single open buy/sell lot in the FIFO queue (per-lot cost basis). */
interface OpenLot {
  qty: number; // remaining unmatched
  price: number; // cost basis (entry price for this lot)
}

interface InProgress {
  symbol: string;
  instrument_type: Fill["instrumentType"];
  openingSide: FillSide; // 'buy' for long, 'sell' for short
  entries: SplitFill[];
  exits: ReconstructedExit[];
  fillTradeIds: string[];
  /** FIFO queue of unmatched entry lots (cost basis preserved per slice). */
  openLots: OpenLot[];
  /** Net signed quantity still open (long=+, short=-). */
  position: number;
}

interface SeededState {
  seed: SeedPosition;
  existingEntryQty: number;
  existingEntryPrice: number;
  addedEntries: SplitFill[];
  addedExits: Continuation["newExits"];
  addedFillTradeIds: string[];
  openLots: OpenLot[];
  position: number;
  warnings: string[];
  flipRemainder: ReconstructedTrade | null;
}

function weightedAvg(items: { price: number; quantity: number }[]): number {
  const totalQty = items.reduce((a, b) => a + b.quantity, 0);
  if (totalQty === 0) return 0;
  const sum = items.reduce((a, b) => a + b.price * b.quantity, 0);
  return sum / totalQty;
}

/**
 * Consume `qty` from the FIFO queue of open lots and return an array of
 * (qty, basis) slices in match order. Caller composes ReconstructedExits
 * by attaching exit_price/date/time from the closing fill.
 */
function popFifo(queue: OpenLot[], qty: number): { qty: number; basis: number }[] {
  const out: { qty: number; basis: number }[] = [];
  let remaining = qty;
  while (remaining > 0 && queue.length > 0) {
    const head = queue[0];
    const take = Math.min(head.qty, remaining);
    out.push({ qty: take, basis: head.price });
    head.qty -= take;
    remaining -= take;
    if (head.qty <= 0) queue.shift();
  }
  return out;
}

function finalize(ip: InProgress): ReconstructedTrade {
  const side = ip.openingSide === "buy" ? "long" : "short";
  const status: "open" | "closed" = ip.position === 0 ? "closed" : "open";

  const entryQty = ip.entries.reduce((a, b) => a + b.quantity, 0);
  const entryPrice = weightedAvg(ip.entries);
  const earliestEntry = ip.entries.reduce((a, b) =>
    a.executedAt.getTime() <= b.executedAt.getTime() ? a : b,
  );

  return {
    symbol: ip.symbol,
    instrument_type: ip.instrument_type,
    side,
    status,
    entry_date: earliestEntry.tradeDate,
    entry_time: earliestEntry.entryTimeHHMMSS,
    entry_price: entryPrice,
    quantity: entryQty,
    // Exits are emitted incrementally during processing (per-lot FIFO),
    // including partial exits for open positions.
    exits: ip.exits.slice(),
    brokerage: 0,
    taxes: 0,
    other_fees: 0,
    source: "csv_import",
    fillTradeIds: [...ip.fillTradeIds],
    grossOnly: true,
  };
}

export interface AggregateOutput {
  trades: ReconstructedTrade[];
  warnings: ImportWarning[];
  /** keyed by symbol — only present for symbols that had a seedPosition supplied */
  continuations: Map<string, Continuation>;
}

export interface AggregateOptions {
  seedPositions?: SeedPosition[];
  /** Phase 3 — pre-import holdings injected as synthetic opening buys. */
  openingPositions?: OpeningPosition[];
  /** Phase 4 — splits / bonuses / consolidations applied to pre-CA fills. */
  corporateActions?: CorporateAction[];
}

export function aggregateFills(
  fills: Fill[],
  options: AggregateOptions = {},
): AggregateOutput {
  const warnings: ImportWarning[] = [];
  const trades: ReconstructedTrade[] = [];
  const continuations = new Map<string, Continuation>();

  const seedsBySymbol = new Map<string, SeedPosition>();
  for (const s of options.seedPositions ?? []) {
    seedsBySymbol.set(s.symbol, s);
  }

  // Phase 3 + 4: build the effective fill stream.
  // Skip opening fills for symbols that already have a continuation seed —
  // the seed's openLots already represent the pre-existing basis.
  const openings = (options.openingPositions ?? []).filter(
    (o) => !seedsBySymbol.has(o.symbol),
  );
  const merged = [...buildOpeningFills(openings), ...fills];
  const effective = applyCorporateActions(merged, options.corporateActions ?? []);

  // Group by symbol (Phase 2: parser has already suffixed non-EQ series).
  const bySymbol = new Map<string, Fill[]>();
  for (const f of effective) {
    if (!bySymbol.has(f.symbol)) bySymbol.set(f.symbol, []);
    bySymbol.get(f.symbol)!.push(f);
  }


  const symbols = Array.from(bySymbol.keys()).sort();

  for (const symbol of symbols) {
    const group = bySymbol.get(symbol)!.slice().sort((a, b) => {
      const dt = a.executedAt.getTime() - b.executedAt.getTime();
      if (dt !== 0) return dt;
      return a.tradeId < b.tradeId ? -1 : a.tradeId > b.tradeId ? 1 : 0;
    });

    const seed = seedsBySymbol.get(symbol);

    if (seed) {
      const continuation = processSeeded(symbol, group, seed, warnings);
      continuations.set(symbol, continuation);
      continue;
    }

    // Fresh aggregation with per-lot FIFO.
    let current: InProgress | null = null;

    const openWith = (f: SplitFill): InProgress => ({
      symbol: f.symbol,
      instrument_type: f.instrumentType,
      openingSide: f.side,
      entries: [f],
      exits: [],
      fillTradeIds: [f.tradeId],
      openLots: [{ qty: f.quantity, price: f.price }],
      position: f.side === "buy" ? f.quantity : -f.quantity,
    });

    for (const fill of group) {
      let remaining = fill.quantity;
      let firstSlice = true;
      while (remaining > 0) {
        const slice: SplitFill = { ...fill, quantity: remaining };

        if (current === null) {
          // Equity: only a BUY can open a new lot. Standalone sells most
          // likely close holdings older than the imported window.
          if (slice.instrumentType === "equity" && slice.side === "sell") {
            warnings.push({
              code: "orphan_sell",
              message: `Sell with no open long position; skipped (likely closing a holding outside this import)`,
              symbol,
              rowRef: fill.tradeId,
            });
            remaining = 0;
            break;
          }
          current = openWith(slice);
          remaining = 0;
          break;
        }

        const sameDir =
          (current.openingSide === "buy" && slice.side === "buy") ||
          (current.openingSide === "sell" && slice.side === "sell");

        if (sameDir) {
          current.entries.push(slice);
          if (firstSlice) current.fillTradeIds.push(fill.tradeId);
          current.openLots.push({ qty: slice.quantity, price: slice.price });
          current.position +=
            slice.side === "buy" ? slice.quantity : -slice.quantity;
          remaining = 0;
        } else {
          // Closing direction — consume FIFO open lots.
          const currentAbs = Math.abs(current.position);
          const closeQty = Math.min(slice.quantity, currentAbs);
          const matched = popFifo(current.openLots, closeQty);
          for (const m of matched) {
            current.exits.push({
              exit_price: fill.price,
              quantity: m.qty,
              entry_price: m.basis,
              exit_date: fill.tradeDate,
              exit_time: fill.entryTimeHHMMSS,
            });
          }
          if (firstSlice) current.fillTradeIds.push(fill.tradeId);
          current.position +=
            slice.side === "buy" ? closeQty : -closeQty;

          if (current.position === 0) {
            trades.push(finalize(current));
            current = null;
          }

          const overSell = slice.quantity - closeQty;
          if (overSell > 0) {
            // For equity, never flip into a phantom short; warn and drop.
            if (fill.instrumentType === "equity") {
              warnings.push({
                code: "orphan_sell",
                message: `Sell exceeded open long quantity; remainder skipped (likely against pre-import holding)`,
                symbol,
                rowRef: fill.tradeId,
              });
              remaining = 0;
              break;
            }
            // Futures/options may flip — open new opposite trade with remainder.
            warnings.push({
              code: "position_flip",
              message: `Fill crossed zero; split into close + new opposite trade`,
              symbol,
              rowRef: fill.tradeId,
            });
            remaining = overSell;
            firstSlice = false;
          } else {
            remaining = 0;
          }
        }
      }
    }

    if (current !== null) {
      warnings.push({
        code: "open_position",
        message: `Position did not return to zero for ${symbol}`,
        symbol,
      });
      trades.push(finalize(current));
    }
  }

  return { trades, warnings, continuations };
}

function processSeeded(
  symbol: string,
  group: Fill[],
  seed: SeedPosition,
  warnings: ImportWarning[],
): Continuation {
  const seedSign = seed.side === "long" ? 1 : -1;
  const state: SeededState = {
    seed,
    existingEntryQty: seed.entryQuantity,
    existingEntryPrice: seed.entryPrice,
    addedEntries: [],
    addedExits: [],
    addedFillTradeIds: [],
    // Seed the FIFO queue with the existing open quantity at the existing
    // weighted-avg cost basis. (Per-lot basis for pre-existing lots isn't
    // available from a seed; weighted-avg is the best approximation.)
    openLots:
      seed.openQuantity > 0
        ? [{ qty: seed.openQuantity, price: seed.entryPrice }]
        : [],
    position: seedSign * seed.openQuantity,
    warnings: [],
    flipRemainder: null,
  };

  const usable: Fill[] = [];
  for (const f of group) {
    if (f.executedAt.getTime() < seed.earliestEntryAt.getTime()) {
      state.warnings.push("out_of_order_fill");
      warnings.push({
        code: "out_of_order_fill",
        message: `Fill predates existing open trade; skipped`,
        symbol,
        rowRef: f.tradeId,
      });
      continue;
    }
    usable.push(f);
  }

  let remainderIp: InProgress | null = null;

  const openRemainder = (f: SplitFill): InProgress => ({
    symbol: f.symbol,
    instrument_type: f.instrumentType,
    openingSide: f.side,
    entries: [f],
    exits: [],
    fillTradeIds: [f.tradeId],
    openLots: [{ qty: f.quantity, price: f.price }],
    position: f.side === "buy" ? f.quantity : -f.quantity,
  });

  for (const fill of usable) {
    let remaining = fill.quantity;
    let firstSlice = true;
    while (remaining > 0) {
      const slice: SplitFill = { ...fill, quantity: remaining };

      // Seed-side alive?
      if (state.position !== 0) {
        const sameDir =
          (seed.side === "long" && slice.side === "buy") ||
          (seed.side === "short" && slice.side === "sell");

        if (sameDir) {
          state.addedEntries.push(slice);
          if (firstSlice) state.addedFillTradeIds.push(fill.tradeId);
          state.openLots.push({ qty: slice.quantity, price: slice.price });
          state.position +=
            slice.side === "buy" ? slice.quantity : -slice.quantity;
          remaining = 0;
        } else {
          const openAbs = Math.abs(state.position);
          const closeQty = Math.min(slice.quantity, openAbs);
          const matched = popFifo(state.openLots, closeQty);
          for (const m of matched) {
            state.addedExits.push({
              exitPrice: fill.price,
              quantity: m.qty,
              exitDate: fill.tradeDate,
              exitTime: fill.entryTimeHHMMSS,
              brokerTradeId: fill.tradeId,
              entryPrice: m.basis,
            });
          }
          if (firstSlice) state.addedFillTradeIds.push(fill.tradeId);
          state.position +=
            slice.side === "buy" ? closeQty : -closeQty;

          const over = slice.quantity - closeQty;
          if (over > 0) {
            warnings.push({
              code: "position_flip",
              message: `Fill closed seeded trade and opened opposite direction`,
              symbol,
              rowRef: fill.tradeId,
            });
            remaining = over;
            firstSlice = false;
          } else {
            remaining = 0;
          }
        }
        continue;
      }

      // Seed closed — anything left builds remainderIp
      if (remainderIp === null) {
        if (slice.instrumentType === "equity" && slice.side === "sell") {
          warnings.push({
            code: "orphan_sell",
            message: `Post-close sell with no open long; skipped`,
            symbol,
            rowRef: fill.tradeId,
          });
          remaining = 0;
          break;
        }
        remainderIp = openRemainder(slice);
        remaining = 0;
        continue;
      }

      const sameDirRem =
        (remainderIp.openingSide === "buy" && slice.side === "buy") ||
        (remainderIp.openingSide === "sell" && slice.side === "sell");

      if (sameDirRem) {
        remainderIp.entries.push(slice);
        if (firstSlice) remainderIp.fillTradeIds.push(fill.tradeId);
        remainderIp.openLots.push({ qty: slice.quantity, price: slice.price });
        remainderIp.position +=
          slice.side === "buy" ? slice.quantity : -slice.quantity;
        remaining = 0;
      } else {
        const curAbs = Math.abs(remainderIp.position);
        const closeQty = Math.min(slice.quantity, curAbs);
        const matched = popFifo(remainderIp.openLots, closeQty);
        for (const m of matched) {
          remainderIp.exits.push({
            exit_price: fill.price,
            quantity: m.qty,
            entry_price: m.basis,
            exit_date: fill.tradeDate,
            exit_time: fill.entryTimeHHMMSS,
          });
        }
        if (firstSlice) remainderIp.fillTradeIds.push(fill.tradeId);
        remainderIp.position +=
          slice.side === "buy" ? closeQty : -closeQty;

        const over = slice.quantity - closeQty;
        if (remainderIp.position === 0) {
          state.flipRemainder = finalize(remainderIp);
          remainderIp = null;
          if (over > 0) {
            warnings.push({
              code: "position_flip",
              message: `Second flip within continuation; subsequent fills ignored`,
              symbol,
              rowRef: fill.tradeId,
            });
          }
          remaining = 0;
        } else {
          remaining = 0;
        }
      }
    }
  }

  if (remainderIp !== null) {
    state.flipRemainder = finalize(remainderIp);
  }

  const addedEntryQty = state.addedEntries.reduce((a, b) => a + b.quantity, 0);
  let newEntryPrice = state.existingEntryPrice;
  let newQuantity = state.existingEntryQty;
  if (addedEntryQty > 0) {
    const existingWeight = state.existingEntryPrice * state.existingEntryQty;
    const addedWeight = state.addedEntries.reduce(
      (a, b) => a + b.price * b.quantity,
      0,
    );
    newQuantity = state.existingEntryQty + addedEntryQty;
    newEntryPrice = (existingWeight + addedWeight) / newQuantity;
    state.warnings.push("added_to_position");
    warnings.push({
      code: "added_to_position",
      message: `Same-side fills added to existing open position; entry recomputed`,
      symbol,
    });
  }

  const totalExitedAfter =
    (seed.entryQuantity - seed.openQuantity) +
    state.addedExits.reduce((a, e) => a + e.quantity, 0);

  let newStatus: "open" | "partial" | "closed";
  if (state.position === 0) {
    newStatus = "closed";
  } else if (totalExitedAfter > 0 && totalExitedAfter < newQuantity) {
    newStatus = "partial";
  } else if (totalExitedAfter >= newQuantity) {
    newStatus = "closed";
  } else {
    newStatus = "open";
  }

  return {
    existingTradeId: seed.tradeId,
    symbol,
    addedFillTradeIds: [...state.addedFillTradeIds],
    newEntryPrice,
    newQuantity,
    newExits: state.addedExits,
    newStatus,
    flipRemainder: state.flipRemainder ?? undefined,
    warnings: [...new Set(state.warnings)],
  };
}
