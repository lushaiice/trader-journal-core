import type {
  Order,
  Orphan,
  ReconstructedTrade,
  ReconstructionResult,
  Side,
} from "./types";
import { classifyInstrument } from "./symbol";

/** Position key: symbol for EQ, symbol|expiry for FO (variant supplies hasExpiry). */
function positionKey(o: Order): string {
  return o.expiry_date ? `${o.symbol}|${o.expiry_date}` : o.symbol;
}

interface OpenLot {
  side: Side; // opening side ("buy" = long, "sell" = short)
  entry_price: number;
  entry_date: string;
  remaining: number;
  original_qty: number;
  exits: ReconstructedTrade["exits"];
  fills: string[];
}

/**
 * FIFO round-trip matcher.
 *
 * Walks orders per position in chronological order.
 *
 * - For F&O the FIRST order in an empty queue sets the opening side
 *   (buy → long, sell → short). Sell-to-open is a legitimate options play.
 * - For equity, a lone sell with no prior buy is treated as an ORPHAN
 *   (pre-window holding) — retail equity in India can't be shorted for
 *   delivery, so an unmatched sell means the buy was before the export.
 *
 * Same-side orders push a new lot. Opposite-side orders consume lots FIFO.
 * A fully-closed lot emits a `closed` ReconstructedTrade; residual opening
 * qty emits an `open` trade; closing qty with no lot available emits an
 * Orphan.
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

    const instrument = classifyInstrument(posOrders[0].symbol, hasExpiryColumn);
    const symbol = posOrders[0].symbol;
    const segment = posOrders[0].segment;
    const expiry = posOrders[0].expiry_date;

    let queue: OpenLot[] = [];

    const flushClosed = () => {
      // Emit any lot whose remaining hit zero.
      queue = queue.filter((lot) => {
        if (lot.remaining <= 1e-9 && lot.exits.length > 0) {
          trades.push(makeTrade("closed", lot, symbol, segment, instrument));
          return false;
        }
        return true;
      });
    };

    for (const order of posOrders) {
      const openSide = queue[0]?.side;
      // For equity, a lone sell with no open lot is a pre-window holding.
      // For F&O, sell-to-open is legitimate.
      const canOpenHere =
        !openSide && (hasExpiryColumn || order.side === "buy");
      const addingToSameSide = !!openSide && order.side === openSide;

      if (canOpenHere || addingToSameSide) {
        // Opening leg (either first-in-position or add to existing side).
        queue.push({
          side: order.side,
          entry_price: order.avg_price,
          entry_date: order.execution_time,
          remaining: order.quantity,
          original_qty: order.quantity,
          exits: [],
          fills: [...order.source_fill_ids],
        });
        continue;
      }

      // Closing leg — consume lots FIFO.
      let toClose = order.quantity;
      while (toClose > 1e-9 && queue.length > 0) {
        const lot = queue[0];
        const take = Math.min(toClose, lot.remaining);
        lot.exits.push({
          exit_price: order.avg_price,
          quantity: take,
          exit_date: order.execution_time,
        });
        lot.fills.push(...order.source_fill_ids);
        lot.remaining -= take;
        toClose -= take;
        if (lot.remaining <= 1e-9) {
          trades.push(makeTrade("closed", lot, symbol, segment, instrument));
          queue.shift();
        }
      }

      if (toClose > 1e-9) {
        // No lot available — pre-window holding.
        orphans.push({
          symbol,
          segment,
          expiry_date: expiry,
          side: order.side,
          quantity: toClose,
          price: order.avg_price,
          execution_time: order.execution_time,
          reason:
            "Closing fill with no matching opening fill in this file — the opening trade is likely from before the export window.",
          source_fill_ids: order.source_fill_ids,
        });
      }

      flushClosed();
    }

    // Anything left is an open position.
    for (const lot of queue) {
      if (lot.exits.length > 0) {
        // Partial close still open — emit as open with recorded exits.
        trades.push(makeTrade("open", lot, symbol, segment, instrument));
      } else {
        trades.push(makeTrade("open", lot, symbol, segment, instrument));
      }
    }
  }

  return { trades, orphans };
}

function makeTrade(
  kind: "closed" | "open",
  lot: OpenLot,
  symbol: string,
  segment: string,
  instrument: ReconstructedTrade["instrument_type"],
): ReconstructedTrade {
  const side: "long" | "short" = lot.side === "buy" ? "long" : "short";
  const sign = side === "long" ? 1 : -1;
  const gross_pnl = lot.exits.reduce(
    (acc, e) => acc + (e.exit_price - lot.entry_price) * e.quantity * sign,
    0,
  );
  // Dedupe fill list defensively.
  const source_fill_ids = Array.from(new Set(lot.fills));
  return {
    kind,
    symbol,
    segment,
    instrument_type: instrument,
    side,
    entry_date: lot.entry_date,
    entry_price: lot.entry_price,
    quantity: lot.original_qty,
    exits: lot.exits,
    gross_pnl,
    source_fill_ids,
  };
}
