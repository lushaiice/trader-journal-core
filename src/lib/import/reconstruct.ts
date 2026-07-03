import type {
  InstrumentType,
  Order,
  Orphan,
  ReconstructedTrade,
  ReconstructionResult,
  Side,
} from "./types";
import { classifyInstrument } from "./symbol";

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
): ReconstructionResult {
  const byPos = new Map<string, Order[]>();
  for (const o of orders) {
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

  return { trades, orphans };
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
  const isEquity = !hasExpiryColumn;

  let state = emptyState();

  const emit = (kind: "closed" | "open"): void => {
    if (state.openedQty <= 1e-9 && state.exits.length === 0) return;
    trades.push(makeTrade(kind, state, symbol, segment, instrument));
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
