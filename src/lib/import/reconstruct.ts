import type {
  InstrumentType,
  Order,
  Orphan,
  ReconstructedTrade,
  ReconstructionResult,
  Side,
} from "./types";
import { classifyInstrument } from "./symbol";
import {
  adjustOrdersForCorporateActions,
  findBaseline,
  type CorporateAction,
  type HoldingBaseline,
} from "./corporate-actions";

export interface ReconstructOptions {
  actions?: CorporateAction[];
  baselines?: HoldingBaseline[];
}

/** Position key: symbol for EQ, symbol|expiry for FO. */
function positionKey(o: Order): string {
  return o.expiry_date ? `${o.symbol}|${o.expiry_date}` : o.symbol;
}

/**
 * Reconstruct trades using NET RUNNING POSITION (average-cost) accounting per
 * position key (symbol for equity; symbol+expiry for F&O).
 *
 * Rationale: per-lot FIFO does not conserve net position when chronology puts
 * a sell before its offsetting buy (BTST, scaling in/out). That inflates the
 * count of "open" trades because the sell becomes an orphan and the later buy
 * looks like a phantom new position. Net-position accounting reconciles each
 * position to (a) at most one currently-open trade whose quantity equals the
 * net signed exposure, and (b) an orphan bucket that only absorbs equity
 * closing fills with no live long to consume.
 *
 * Equity delivery rule: a sell with pos == 0 cannot open short — the whole
 * order becomes an Orphan (pre-window holding / corporate action). F&O is
 * allowed to sell-to-open.
 */
export function reconstructPositions(
  orders: Order[],
  hasExpiryColumn: boolean,
  options: ReconstructOptions = {},
): ReconstructionResult {
  const actions = options.actions ?? [];
  const baselines = options.baselines ?? [];
  const adjusted = actions.length > 0 ? adjustOrdersForCorporateActions(orders, actions) : orders;

  const byPos = new Map<string, Order[]>();
  for (const o of adjusted) {
    const key = positionKey(o);
    const list = byPos.get(key) ?? [];
    list.push(o);
    byPos.set(key, list);
  }

  const trades: ReconstructedTrade[] = [];
  const orphans: Orphan[] = [];

  for (const [, posOrders] of byPos) {
    posOrders.sort((a, b) => a.execution_time.localeCompare(b.execution_time));
    walkPosition(posOrders, hasExpiryColumn, trades, orphans);
  }

  if (baselines.length > 0 && orphans.length > 0) {
    resolveOrphansWithBaselines(orphans, trades, baselines);
  }

  return { trades, orphans };
}

/**
 * For every orphan (unmatched closing sell) whose isin/symbol has a stored
 * baseline, convert it into a closed long trade at the baseline avg_cost.
 * Removes the orphan from the list.
 */
function resolveOrphansWithBaselines(
  orphans: Orphan[],
  trades: ReconstructedTrade[],
  baselines: HoldingBaseline[],
): void {
  for (let i = orphans.length - 1; i >= 0; i--) {
    const o = orphans[i];
    if (o.side !== "sell") continue;
    const isin: string | null = null;
    const baseline = findBaseline(isin, o.symbol, baselines);
    if (!baseline) continue;

    const entryDate = baseline.as_of_date ?? o.execution_time.slice(0, 10);
    const instrument: InstrumentType = o.expiry_date ? "futures" : "equity";
    trades.push({
      kind: "closed",
      symbol: o.symbol,
      segment: o.segment,
      instrument_type: instrument,
      isin: null,
      exchange: "NSE",
      side: "long",
      entry_date: entryDate,
      entry_price: baseline.avg_cost,
      quantity: o.quantity,
      exits: [
        {
          exit_price: o.price,
          quantity: o.quantity,
          exit_date: o.execution_time,
        },
      ],
      gross_pnl: (o.price - baseline.avg_cost) * o.quantity,
      source_fill_ids: [...o.source_fill_ids],
    });
    orphans.splice(i, 1);
  }
}

interface TradeState {
  pos: number; // signed running position: + long, - short
  avgCost: number;
  openedQty: number;
  entryDate: string;
  entrySide: Side;
  exits: ReconstructedTrade["exits"];
  fills: string[];
}

function emptyState(): TradeState {
  return {
    pos: 0,
    avgCost: 0,
    openedQty: 0,
    entryDate: "",
    entrySide: "buy",
    exits: [],
    fills: [],
  };
}

function walkPosition(
  posOrders: Order[],
  hasExpiryColumn: boolean,
  trades: ReconstructedTrade[],
  orphans: Orphan[],
): void {
  const instrument = classifyInstrument(posOrders[0].symbol, hasExpiryColumn);
  const symbol = posOrders[0].symbol;
  const segment = posOrders[0].segment;
  const expiry = posOrders[0].expiry_date;
  const isin = posOrders[0].isin;
  const exchange = posOrders[0].exchange;
  const isEquity = !hasExpiryColumn;

  let state = emptyState();

  const emit = (kind: "closed" | "open"): void => {
    if (state.openedQty <= 1e-9 && state.exits.length === 0) return;
    trades.push(makeTrade(kind, state, symbol, segment, instrument, isin, exchange));
  };

  for (const order of posOrders) {
    const signedQty = order.side === "buy" ? order.quantity : -order.quantity;

    if (state.pos === 0) {
      if (isEquity && order.side === "sell") {
        // Equity delivery: cannot open short. Whole order is a pre-window
        // holding / corporate-action orphan.
        orphans.push(makeOrphan(order, symbol, segment, expiry, "no-prior-long"));
        continue;
      }
      // Open a new trade.
      state = {
        pos: signedQty,
        avgCost: order.avg_price,
        openedQty: order.quantity,
        entryDate: order.execution_time,
        entrySide: order.side,
        exits: [],
        fills: [...order.source_fill_ids],
      };
      continue;
    }

    const sameDirection =
      (state.pos > 0 && order.side === "buy") || (state.pos < 0 && order.side === "sell");

    if (sameDirection) {
      // Scale in — update volume-weighted average cost.
      const absPos = Math.abs(state.pos);
      state.avgCost =
        (state.avgCost * absPos + order.avg_price * order.quantity) / (absPos + order.quantity);
      state.pos += signedQty;
      state.openedQty += order.quantity;
      state.fills.push(...order.source_fill_ids);
      continue;
    }

    // Opposite direction — reduce, close, or flip.
    const prevAbsPos = Math.abs(state.pos);
    const closeQty = Math.min(prevAbsPos, order.quantity);
    state.exits.push({
      exit_price: order.avg_price,
      quantity: closeQty,
      exit_date: order.execution_time,
    });
    state.fills.push(...order.source_fill_ids);
    state.pos += signedQty;

    if (order.quantity + 1e-9 >= prevAbsPos) {
      // Fully closed (possibly with leftover that would flip).
      emit("closed");
      const leftover = order.quantity - prevAbsPos;
      state = emptyState();

      if (leftover > 1e-9) {
        if (isEquity && order.side === "sell") {
          // Cannot flip short in equity — leftover is orphan.
          orphans.push(makeOrphanQty(order, symbol, segment, expiry, leftover, "flip-excess"));
        } else {
          // F&O flip: open a fresh position in the opposite direction.
          const signedLeftover = order.side === "buy" ? leftover : -leftover;
          state = {
            pos: signedLeftover,
            avgCost: order.avg_price,
            openedQty: leftover,
            entryDate: order.execution_time,
            entrySide: order.side,
            exits: [],
            fills: [...order.source_fill_ids],
          };
        }
      }
    }
    // else: partial reduction — trade stays open with recorded exit.
  }

  // End of stream: emit residual as open (or partial-with-exits).
  if (Math.abs(state.pos) > 1e-9) {
    emit("open");
  }
}

function makeTrade(
  kind: "closed" | "open",
  state: TradeState,
  symbol: string,
  segment: string,
  instrument: InstrumentType,
  isin: string | null,
  exchange: string,
): ReconstructedTrade {
  const side: "long" | "short" = state.entrySide === "buy" ? "long" : "short";
  const sign = side === "long" ? 1 : -1;
  const gross_pnl = state.exits.reduce(
    (acc, e) => acc + (e.exit_price - state.avgCost) * e.quantity * sign,
    0,
  );
  const source_fill_ids = Array.from(new Set(state.fills));
  return {
    kind,
    symbol,
    segment,
    instrument_type: instrument,
    isin,
    exchange,
    side,
    entry_date: state.entryDate,
    entry_price: state.avgCost,
    quantity: state.openedQty,
    exits: state.exits,
    gross_pnl,
    source_fill_ids,
  };
}

function makeOrphan(
  order: Order,
  symbol: string,
  segment: string,
  expiry: string | null,
  _tag: string,
): Orphan {
  return {
    symbol,
    segment,
    expiry_date: expiry,
    side: order.side,
    quantity: order.quantity,
    price: order.avg_price,
    execution_time: order.execution_time,
    reason:
      "Closing fill with no matching opening fill in this file — the opening trade is likely from before the export window.",
    source_fill_ids: order.source_fill_ids,
  };
}

function makeOrphanQty(
  order: Order,
  symbol: string,
  segment: string,
  expiry: string | null,
  quantity: number,
  _tag: string,
): Orphan {
  return {
    symbol,
    segment,
    expiry_date: expiry,
    side: order.side,
    quantity,
    price: order.avg_price,
    execution_time: order.execution_time,
    reason:
      "Closing fill with no matching opening fill in this file — the opening trade is likely from before the export window.",
    source_fill_ids: order.source_fill_ids,
  };
}
