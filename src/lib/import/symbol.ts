import type { InstrumentType } from "./types";

/**
 * Classify a Zerodha tradingsymbol.
 *
 * We store the full tradingsymbol verbatim. Parsing strike / expiry / right
 * out of the symbol string (e.g. NIFTY2591624450PE) is future work.
 */
export function classifyInstrument(
  symbol: string,
  hasExpiryColumn: boolean,
): InstrumentType {
  if (!hasExpiryColumn) return "equity";
  const s = symbol.toUpperCase();
  if (s.endsWith("CE") || s.endsWith("PE")) return "options";
  if (s.endsWith("FUT")) return "futures";
  // FO row without CE/PE/FUT suffix — treat as futures (safe default).
  return "futures";
}
