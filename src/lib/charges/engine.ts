/**
 * Compute Indian retail broker charges (Zerodha reference) for a
 * reconstructed trade — brokerage, STT, exchange transaction, SEBI,
 * stamp duty, GST.
 *
 * Charges are estimates: they use the trade's aggregated entry and exit
 * (VWAP × quantity) rather than per-order values, so a trade split across
 * many orders can vary by a rupee or two from the exact broker figure.
 */

import type { ReconstructedTrade } from "@/lib/import/types";
import { pickSchedule } from "./rates";
import { classifyTrade } from "./classify";

export interface TradeCharges {
  brokerage: number;
  stt: number;
  transaction: number;
  sebi: number;
  stamp: number;
  gst: number;
  total: number;
}

const zeroCharges = (): TradeCharges => ({
  brokerage: 0,
  stt: 0,
  transaction: 0,
  sebi: 0,
  stamp: 0,
  gst: 0,
  total: 0,
});

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function sumTotal(c: TradeCharges): TradeCharges {
  c.total = round2(c.brokerage + c.stt + c.transaction + c.sebi + c.stamp + c.gst);
  c.brokerage = round2(c.brokerage);
  c.stt = round2(c.stt);
  c.transaction = round2(c.transaction);
  c.sebi = round2(c.sebi);
  c.stamp = round2(c.stamp);
  c.gst = round2(c.gst);
  return c;
}

function exitQty(t: ReconstructedTrade): number {
  return t.exits.reduce((a, e) => a + e.quantity, 0);
}

function buyValueLegAware(t: ReconstructedTrade): number {
  // Rupees exchanged on the BUY side of the trade (open or exit).
  if (t.side === "long") return t.entry_price * t.quantity;
  // Short: buy-back happens on exit.
  return t.exits.reduce((a, e) => a + e.exit_price * e.quantity, 0);
}

function sellValueLegAware(t: ReconstructedTrade): number {
  // Rupees exchanged on the SELL side of the trade (open or exit).
  if (t.side === "long") return t.exits.reduce((a, e) => a + e.exit_price * e.quantity, 0);
  return t.entry_price * exitQty(t);
}

export function computeTradeCharges(t: ReconstructedTrade): TradeCharges {
  const schedule = pickSchedule(t.entry_date);
  const ctx = classifyTrade(t);
  const buyVal = buyValueLegAware(t);
  const sellVal = sellValueLegAware(t);
  const turnover = buyVal + sellVal;
  if (turnover <= 0) return zeroCharges();

  const c = zeroCharges();

  if (ctx.instrument === "equity") {
    const eq = schedule.equity;
    if (ctx.equity_product === "intraday") {
      // Brokerage: 0.03% per executed order OR ₹20, whichever lower.
      // We approximate 2 orders (entry + exit).
      const perLeg = (v: number) => Math.min(v * eq.intraday.brokerage_bps, eq.intraday.brokerage_cap);
      c.brokerage = perLeg(buyVal) + perLeg(sellVal);
      c.stt = sellVal * eq.intraday.stt_sell;
      c.stamp = buyVal * eq.intraday.stamp_buy;
    } else {
      // Delivery.
      c.brokerage = 0;
      if (ctx.is_etf) {
        c.stt = sellVal * eq.delivery.stt_sell_etf;
      } else {
        c.stt = buyVal * eq.delivery.stt_buy + sellVal * eq.delivery.stt_sell;
      }
      c.stamp = buyVal * eq.delivery.stamp_buy;
    }
    const txnRate = ctx.exchange === "BSE" ? eq.txn.bse : eq.txn.nse;
    c.transaction = turnover * txnRate;
    c.sebi = turnover * eq.sebi;
    c.gst = (c.brokerage + c.transaction + c.sebi) * eq.gst;
    return sumTotal(c);
  }

  const fno = schedule.fno;
  if (ctx.instrument === "futures") {
    const perLeg = (v: number) =>
      Math.min(v * fno.futures.brokerage_bps, fno.futures.brokerage_cap);
    c.brokerage = perLeg(buyVal) + perLeg(sellVal);
    c.stt = sellVal * fno.futures.stt_sell;
    c.transaction = turnover * fno.futures.txn_nse;
    c.stamp = buyVal * fno.futures.stamp_buy;
  } else {
    // Options — flat brokerage per order (2 orders assumed).
    // Cap at the executed side count: an open-only trade has 1 order.
    const orders = t.exits.length > 0 ? 2 : 1;
    c.brokerage = fno.options.brokerage_per_order * orders;
    c.stt = sellVal * fno.options.stt_sell;
    c.transaction = turnover * fno.options.txn_nse;
    c.stamp = buyVal * fno.options.stamp_buy;
  }
  c.sebi = turnover * fno.sebi;
  c.gst = (c.brokerage + c.transaction + c.sebi) * fno.gst;
  return sumTotal(c);
}

export function computeBatchCharges(trades: ReconstructedTrade[]): {
  perTrade: TradeCharges[];
  total: number;
} {
  const perTrade = trades.map(computeTradeCharges);
  const total = round2(perTrade.reduce((a, c) => a + c.total, 0));
  return { perTrade, total };
}
