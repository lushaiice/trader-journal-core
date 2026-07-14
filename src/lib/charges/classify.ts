import type { InstrumentType, ReconstructedTrade } from "@/lib/import/types";

export type EquityProduct = "delivery" | "intraday";

/** ETFs in India get ISIN prefix INF (mutual-fund format). */
export function isEtf(isin: string | null): boolean {
  return !!isin && isin.toUpperCase().startsWith("INF");
}

/** Delivery vs intraday for an equity trade. Intraday = fully closed on
 *  the same calendar date it was opened. Open / partial / multi-day → delivery. */
export function classifyEquityProduct(t: ReconstructedTrade): EquityProduct {
  if (t.kind !== "closed" || t.exits.length === 0) return "delivery";
  const entryDay = t.entry_date.slice(0, 10);
  const allSameDay = t.exits.every((e) => e.exit_date.slice(0, 10) === entryDay);
  return allSameDay ? "intraday" : "delivery";
}

export interface ChargeContext {
  instrument: InstrumentType;
  equity_product: EquityProduct | null; // only for equity
  is_etf: boolean;
  exchange: "NSE" | "BSE";
}

export function classifyTrade(t: ReconstructedTrade): ChargeContext {
  const exchange: "NSE" | "BSE" = t.exchange === "BSE" ? "BSE" : "NSE";
  if (t.instrument_type === "equity") {
    return {
      instrument: "equity",
      equity_product: classifyEquityProduct(t),
      is_etf: isEtf(t.isin),
      exchange,
    };
  }
  return {
    instrument: t.instrument_type,
    equity_product: null,
    is_etf: false,
    exchange,
  };
}
