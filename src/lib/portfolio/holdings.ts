/**
 * Portfolio holdings — mark-to-market aggregation for open/partial trades.
 * Pure functions, framework-independent.
 */
import type { NormalizedTrade } from "@/types/analytics";

export interface PriceRef {
  close: number;
  price_date: string;
}

export interface Holding {
  symbol: string;
  instrumentType: string;
  quantity: number;
  avgCost: number;
  costValue: number;
  hasPrice: boolean;
  lastClose: number | null;
  priceDate: string | null;
  marketValue: number | null;
  unrealizedPnl: number | null;
  unrealizedPct: number | null;
}

export interface HoldingsTotals {
  costValue: number;
  marketValue: number;
  unrealizedPnl: number;
  unrealizedPct: number | null;
  pricedCount: number;
  unpricedCount: number;
}

export interface HoldingsResult {
  /** Priced equity holdings valued at last close. */
  holdings: Holding[];
  /** Equity holdings with no cached price. Included with hasPrice=false. */
  unpricedEquity: Holding[];
  /** F&O open positions — no EOD price available. */
  derivatives: Holding[];
  totals: HoldingsTotals;
}

interface Bucket {
  symbol: string;
  instrumentType: string;
  quantity: number;
  costValue: number;
}

/**
 * Only open/partial trades are eligible. Only equity is mark-to-market'd;
 * derivatives are returned separately.
 */
export function buildHoldings(
  openTrades: NormalizedTrade[],
  priceBySymbol: Record<string, PriceRef | undefined>,
): HoldingsResult {
  const equityBuckets = new Map<string, Bucket>();
  const derivBuckets = new Map<string, Bucket>();

  for (const t of openTrades) {
    if (t.status !== "open" && t.status !== "partial") continue;
    const remaining = t.remainingQty;
    if (remaining <= 0) continue;

    const instrumentType = String(t.raw.trade.instrument_type ?? "equity");
    const isEquity = instrumentType === "equity";
    const map = isEquity ? equityBuckets : derivBuckets;
    const key = t.symbol;
    const existing = map.get(key);
    const cost = remaining * t.entryPrice;
    if (existing) {
      existing.quantity += remaining;
      existing.costValue += cost;
    } else {
      map.set(key, {
        symbol: key,
        instrumentType,
        quantity: remaining,
        costValue: cost,
      });
    }
  }

  const holdings: Holding[] = [];
  const unpricedEquity: Holding[] = [];

  for (const b of equityBuckets.values()) {
    const avgCost = b.quantity > 0 ? b.costValue / b.quantity : 0;
    const price = priceBySymbol[b.symbol];
    if (price && Number.isFinite(price.close)) {
      const marketValue = b.quantity * price.close;
      const pnl = marketValue - b.costValue;
      holdings.push({
        symbol: b.symbol,
        instrumentType: b.instrumentType,
        quantity: b.quantity,
        avgCost,
        costValue: b.costValue,
        hasPrice: true,
        lastClose: price.close,
        priceDate: price.price_date,
        marketValue,
        unrealizedPnl: pnl,
        unrealizedPct: b.costValue > 0 ? pnl / b.costValue : null,
      });
    } else {
      unpricedEquity.push({
        symbol: b.symbol,
        instrumentType: b.instrumentType,
        quantity: b.quantity,
        avgCost,
        costValue: b.costValue,
        hasPrice: false,
        lastClose: null,
        priceDate: null,
        marketValue: null,
        unrealizedPnl: null,
        unrealizedPct: null,
      });
    }
  }

  const derivatives: Holding[] = Array.from(derivBuckets.values()).map((b) => ({
    symbol: b.symbol,
    instrumentType: b.instrumentType,
    quantity: b.quantity,
    avgCost: b.quantity > 0 ? b.costValue / b.quantity : 0,
    costValue: b.costValue,
    hasPrice: false,
    lastClose: null,
    priceDate: null,
    marketValue: null,
    unrealizedPnl: null,
    unrealizedPct: null,
  }));

  holdings.sort((a, b) => (b.marketValue ?? 0) - (a.marketValue ?? 0));
  unpricedEquity.sort((a, b) => a.symbol.localeCompare(b.symbol));
  derivatives.sort((a, b) => a.symbol.localeCompare(b.symbol));

  let costTotal = 0;
  let mvTotal = 0;
  for (const h of holdings) {
    costTotal += h.costValue;
    mvTotal += h.marketValue ?? 0;
  }
  const pnlTotal = mvTotal - costTotal;
  const totals: HoldingsTotals = {
    costValue: costTotal,
    marketValue: mvTotal,
    unrealizedPnl: pnlTotal,
    unrealizedPct: costTotal > 0 ? pnlTotal / costTotal : null,
    pricedCount: holdings.length,
    unpricedCount: unpricedEquity.length,
  };

  return { holdings, unpricedEquity, derivatives, totals };
}
