import { aggregateFills, type AggregateOptions } from "./aggregate";
import { parseZerodhaTradebook } from "./zerodha";
import type { ImportResult } from "./types";

export * from "./types";
export { parseZerodhaTradebook, parseCsv, inferInstrumentType } from "./zerodha";
export { aggregateFills } from "./aggregate";

export function importZerodhaTradebook(
  csvText: string,
  options: AggregateOptions = {},
): ImportResult {
  const parsed = parseZerodhaTradebook(csvText);
  const agg = aggregateFills(parsed.fills, options);

  const symbols = new Set(agg.trades.map((t) => t.symbol));
  let tradesClosed = 0;
  let tradesOpen = 0;
  for (const t of agg.trades) {
    if (t.status === "closed") tradesClosed++;
    else tradesOpen++;
  }

  return {
    trades: agg.trades,
    warnings: [...parsed.warnings, ...agg.warnings],
    stats: {
      rowsParsed: parsed.rowsParsed,
      rowsSkipped: parsed.rowsSkipped,
      tradesClosed,
      tradesOpen,
      symbols: symbols.size,
    },
  };
}
