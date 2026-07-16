/**
 * Daily total-P&L curve = realized (from exits) + unrealized (mark-to-market
 * of remaining open quantity, using forward-filled daily closes).
 *
 * Pure & framework-free. See tests/portfolio/mtm-curve.test.ts.
 */
import type { NormalizedTrade } from "@/types/analytics";
import { exitEvents } from "@/lib/analytics/normalize";

export interface PriceHistoryPoint {
  price_date: string;
  close: number;
}

export interface DailyTotalPnlPoint {
  date: string;
  realizedCum: number;
  unrealized: number;
  totalPnl: number;
}

export interface BuildDailyTotalPnlArgs {
  trades: NormalizedTrade[];
  priceHistoryBySymbol: Record<string, PriceHistoryPoint[]>;
  fromDate?: string | null;
  toDate?: string | null;
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface TradeCtx {
  trade: NormalizedTrade;
  entryIso: string;
  sideSign: 1 | -1;
  isEquity: boolean;
  /** Per-exit rows, sorted by date. netPnl already includes prorated fees. */
  exits: { date: string; quantity: number; netPnl: number }[];
}

export function buildDailyTotalPnl({
  trades,
  priceHistoryBySymbol,
  fromDate = null,
  toDate = null,
}: BuildDailyTotalPnlArgs): DailyTotalPnlPoint[] {
  const lo = fromDate ?? "";
  const hi = toDate ?? "";
  const inWindow = (d: string) => (lo ? d >= lo : true) && (hi ? d <= hi : true);

  const ctxs: TradeCtx[] = trades.map((t) => {
    const events = exitEvents(t);
    const exits = events
      .map((e, i) => ({
        date: toIso(e.date),
        quantity: Number(t.raw.exits[i]?.quantity ?? 0),
        netPnl: e.netPnl,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
    return {
      trade: t,
      entryIso: toIso(t.entryDate),
      sideSign: t.side === "long" ? 1 : -1,
      isEquity: String(t.raw.trade.instrument_type ?? "equity") === "equity",
      exits,
    };
  });

  const priceMap = new Map<string, PriceHistoryPoint[]>();
  for (const [sym, series] of Object.entries(priceHistoryBySymbol)) {
    const sorted = [...series].sort((a, b) => a.price_date.localeCompare(b.price_date));
    priceMap.set(sym, sorted);
  }

  const dateSet = new Set<string>();
  for (const c of ctxs) {
    if (inWindow(c.entryIso)) dateSet.add(c.entryIso);
    for (const e of c.exits) if (inWindow(e.date)) dateSet.add(e.date);
  }
  for (const series of priceMap.values()) {
    for (const p of series) if (inWindow(p.price_date)) dateSet.add(p.price_date);
  }
  const dates = Array.from(dateSet).sort();
  if (!dates.length) return [];

  const priceIdx = new Map<string, number>();
  for (const s of priceMap.keys()) priceIdx.set(s, 0);
  const lastClose = new Map<string, number>();

  const result: DailyTotalPnlPoint[] = [];

  for (const date of dates) {
    // Forward-fill: advance each symbol's pointer past all closes ≤ date.
    for (const [sym, series] of priceMap) {
      let i = priceIdx.get(sym) ?? 0;
      while (i < series.length && series[i].price_date <= date) {
        lastClose.set(sym, series[i].close);
        i++;
      }
      priceIdx.set(sym, i);
    }

    let realized = 0;
    let unrealized = 0;
    for (const c of ctxs) {
      let exitedQty = 0;
      for (const e of c.exits) {
        if (e.date <= date) {
          realized += e.netPnl;
          exitedQty += e.quantity;
        } else {
          break; // sorted
        }
      }
      if (!c.isEquity) continue;
      if (c.entryIso > date) continue;
      const remaining = c.trade.quantity - exitedQty;
      if (remaining <= 0) continue;
      const close = lastClose.get(c.trade.symbol);
      if (close == null) continue;
      unrealized += (close - c.trade.entryPrice) * remaining * c.sideSign;
    }

    result.push({ date, realizedCum: realized, unrealized, totalPnl: realized + unrealized });
  }

  return result;
}
