import type {
  Fill,
  FillSide,
  ImportWarning,
  ReconstructedExit,
  ReconstructedTrade,
  SeedPosition,
  Continuation,
} from "./types";

interface SplitFill extends Fill {
  // logical quantity to apply (may be a split portion of original fill)
}

interface InProgress {
  symbol: string;
  instrument_type: Fill["instrumentType"];
  openingSide: FillSide; // 'buy' for long, 'sell' for short
  entries: SplitFill[];
  exits: SplitFill[];
  fillTradeIds: string[];
  position: number; // signed running quantity
}

interface SeededState {
  seed: SeedPosition;
  // Synthetic entry row representing the EXISTING weighted-avg entry already in the DB.
  existingEntryQty: number;
  existingEntryPrice: number;
  addedEntries: SplitFill[]; // new same-side fills appended to entry
  addedExits: SplitFill[]; // new opposite-side fills (closing/reducing)
  addedFillTradeIds: string[];
  position: number; // signed net open quantity (long=+ short=-)
  warnings: string[];
  flipRemainder: ReconstructedTrade | null;
}

function weightedAvg(items: { price: number; quantity: number }[]): number {
  const totalQty = items.reduce((a, b) => a + b.quantity, 0);
  if (totalQty === 0) return 0;
  const sum = items.reduce((a, b) => a + b.price * b.quantity, 0);
  return sum / totalQty;
}

function aggregateExitsByOrder(exits: SplitFill[]): ReconstructedExit[] {
  const map = new Map<string, SplitFill[]>();
  const order: string[] = [];
  for (const f of exits) {
    if (!map.has(f.orderId)) {
      map.set(f.orderId, []);
      order.push(f.orderId);
    }
    map.get(f.orderId)!.push(f);
  }
  return order.map((oid) => {
    const group = map.get(oid)!;
    const qty = group.reduce((a, b) => a + b.quantity, 0);
    const price = weightedAvg(group);
    const earliest = group.reduce((a, b) =>
      a.executedAt.getTime() <= b.executedAt.getTime() ? a : b,
    );
    return {
      exit_price: price,
      quantity: qty,
      exit_date: earliest.tradeDate,
      exit_time: earliest.entryTimeHHMMSS,
    };
  });
}

/** Like aggregateExitsByOrder but preserves a single broker_trade_id per group
 *  (used by the continuation path so each exit row can carry a broker_trade_id
 *  for idempotent re-insert). Groups with multiple fills get the earliest
 *  fill's broker_trade_id as the representative id. */
function aggregateExitsForContinuation(
  exits: SplitFill[],
): Continuation["newExits"] {
  const map = new Map<string, SplitFill[]>();
  const order: string[] = [];
  for (const f of exits) {
    if (!map.has(f.orderId)) {
      map.set(f.orderId, []);
      order.push(f.orderId);
    }
    map.get(f.orderId)!.push(f);
  }
  return order.map((oid) => {
    const group = map.get(oid)!;
    const qty = group.reduce((a, b) => a + b.quantity, 0);
    const price = weightedAvg(group);
    const earliest = group.reduce((a, b) =>
      a.executedAt.getTime() <= b.executedAt.getTime() ? a : b,
    );
    return {
      exitPrice: price,
      quantity: qty,
      exitDate: earliest.tradeDate,
      exitTime: earliest.entryTimeHHMMSS,
      brokerTradeId: earliest.tradeId,
    };
  });
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
    exits: status === "open" ? [] : aggregateExitsByOrder(ip.exits),
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

  // Group by symbol
  const bySymbol = new Map<string, Fill[]>();
  for (const f of fills) {
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
      // flipRemainder is conveyed via the continuation struct so persistence
      // can wire it after the existing trade closes. We do NOT also push it
      // to `trades` — the caller persists it through the new-path.
      continue;
    }

    // Fresh aggregation (C1 behavior)
    let current: InProgress | null = null;

    const openWith = (f: SplitFill): InProgress => ({
      symbol: f.symbol,
      instrument_type: f.instrumentType,
      openingSide: f.side,
      entries: [f],
      exits: [],
      fillTradeIds: [f.tradeId],
      position: f.side === "buy" ? f.quantity : -f.quantity,
    });

    for (const fill of group) {
      let remaining = fill.quantity;
      let firstSlice = true;
      while (remaining > 0) {
        const slice: SplitFill = { ...fill, quantity: remaining };

        if (current === null) {
          current = openWith(slice);
          remaining = 0;
          break;
        }

        const signed = slice.side === "buy" ? slice.quantity : -slice.quantity;
        const newPos = current.position + signed;

        const sameDir =
          (current.openingSide === "buy" && slice.side === "buy") ||
          (current.openingSide === "sell" && slice.side === "sell");

        if (sameDir) {
          current.entries.push(slice);
          if (firstSlice) current.fillTradeIds.push(fill.tradeId);
          current.position = newPos;
          remaining = 0;
        } else {
          const currentAbs = Math.abs(current.position);
          if (slice.quantity <= currentAbs) {
            current.exits.push(slice);
            if (firstSlice) current.fillTradeIds.push(fill.tradeId);
            current.position = newPos;
            remaining = 0;
            if (current.position === 0) {
              trades.push(finalize(current));
              current = null;
            }
          } else {
            const closingQty = currentAbs;
            const closingSlice: SplitFill = { ...fill, quantity: closingQty };
            current.exits.push(closingSlice);
            if (firstSlice) current.fillTradeIds.push(fill.tradeId);
            current.position = 0;
            trades.push(finalize(current));
            current = null;

            warnings.push({
              code: "position_flip",
              message: `Fill crossed zero; split into close + new opposite trade`,
              symbol,
              rowRef: fill.tradeId,
            });

            remaining = remaining - closingQty;
            firstSlice = false;
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
    position: seedSign * seed.openQuantity,
    warnings: [],
    flipRemainder: null,
  };

  // Filter out out-of-order fills first (collect remainder for processing).
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

  // remainderTrade: once the seeded position fully closes or flips, subsequent
  // fills open a NEW reconstructed trade (becomes flipRemainder).
  let remainderIp: InProgress | null = null;

  const openRemainder = (f: SplitFill): InProgress => ({
    symbol: f.symbol,
    instrument_type: f.instrumentType,
    openingSide: f.side,
    entries: [f],
    exits: [],
    fillTradeIds: [f.tradeId],
    position: f.side === "buy" ? f.quantity : -f.quantity,
  });

  for (const fill of usable) {
    let remaining = fill.quantity;
    let firstSlice = true;
    while (remaining > 0) {
      const slice: SplitFill = { ...fill, quantity: remaining };

      // If seeded position still alive, feed it.
      if (state.position !== 0 || (state.addedEntries.length === 0 && state.addedExits.length === 0 && remainderIp === null)) {
        // While seed-side is OPEN
        if (state.position !== 0) {
          const sliceSigned = slice.side === "buy" ? slice.quantity : -slice.quantity;
          const sameDir =
            (seed.side === "long" && slice.side === "buy") ||
            (seed.side === "short" && slice.side === "sell");

          if (sameDir) {
            state.addedEntries.push(slice);
            if (firstSlice) state.addedFillTradeIds.push(fill.tradeId);
            state.position += sliceSigned;
            remaining = 0;
          } else {
            const openAbs = Math.abs(state.position);
            if (slice.quantity <= openAbs) {
              state.addedExits.push(slice);
              if (firstSlice) state.addedFillTradeIds.push(fill.tradeId);
              state.position += sliceSigned;
              remaining = 0;
            } else {
              // Flip: close seeded with openAbs, push remainder into a new trade
              const closingSlice: SplitFill = { ...fill, quantity: openAbs };
              state.addedExits.push(closingSlice);
              if (firstSlice) state.addedFillTradeIds.push(fill.tradeId);
              state.position = 0;
              warnings.push({
                code: "position_flip",
                message: `Fill closed seeded trade and opened opposite direction`,
                symbol,
                rowRef: fill.tradeId,
              });
              remaining = remaining - openAbs;
              firstSlice = false;
              // loop continues; next iteration falls into remainderIp branch
            }
          }
          continue;
        }
      }

      // Position is zero — anything left builds remainderIp
      if (remainderIp === null) {
        remainderIp = openRemainder(slice);
        remaining = 0;
        continue;
      }

      const sameDirRem =
        (remainderIp.openingSide === "buy" && slice.side === "buy") ||
        (remainderIp.openingSide === "sell" && slice.side === "sell");
      const sliceSigned = slice.side === "buy" ? slice.quantity : -slice.quantity;
      const newPos = remainderIp.position + sliceSigned;

      if (sameDirRem) {
        remainderIp.entries.push(slice);
        if (firstSlice) remainderIp.fillTradeIds.push(fill.tradeId);
        remainderIp.position = newPos;
        remaining = 0;
      } else {
        const curAbs = Math.abs(remainderIp.position);
        if (slice.quantity <= curAbs) {
          remainderIp.exits.push(slice);
          if (firstSlice) remainderIp.fillTradeIds.push(fill.tradeId);
          remainderIp.position = newPos;
          remaining = 0;
        } else {
          const closingSlice: SplitFill = { ...fill, quantity: curAbs };
          remainderIp.exits.push(closingSlice);
          if (firstSlice) remainderIp.fillTradeIds.push(fill.tradeId);
          remainderIp.position = 0;
          // finalize remainderIp into flipRemainder candidate slot…but a 2nd flip
          // within a single continuation is exotic: just finalize the first one
          // and ignore further flips here (warn).
          state.flipRemainder = finalize(remainderIp);
          remainderIp = null;
          warnings.push({
            code: "position_flip",
            message: `Second flip within continuation; subsequent fills ignored`,
            symbol,
            rowRef: fill.tradeId,
          });
          remaining = 0;
        }
      }
    }
  }

  if (remainderIp !== null) {
    state.flipRemainder = finalize(remainderIp);
  }

  // Compute newEntryPrice / newQuantity (FACTUAL entry layer).
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

  const newExits = aggregateExitsForContinuation(state.addedExits);
  const totalExitedAfter =
    (seed.entryQuantity - seed.openQuantity) +
    newExits.reduce((a, e) => a + e.quantity, 0);

  let newStatus: "open" | "partial" | "closed";
  if (state.position === 0 && state.flipRemainder !== null) {
    newStatus = "closed";
  } else if (state.position === 0) {
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
    newExits,
    newStatus,
    flipRemainder: state.flipRemainder ?? undefined,
    warnings: [...new Set(state.warnings)],
  };
}
