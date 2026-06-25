/**
 * Allocate per-symbol broker charges across reconstructed trades for the same
 * symbol. Pure function — no I/O, no React.
 *
 * Allocation method:
 *   1. Prefer pro-rata by |gross P&L| of each trade (trades that moved the
 *      needle absorbed more of the brokerage / STT cost).
 *   2. If every trade has zero gross (rare — e.g. all open positions), fall
 *      back to notional traded value (entry_price * quantity).
 *   3. The charge bucket is split: brokerage → `brokerage`,
 *      taxes (STT/CTT/exch/SEBI/stamp/IPFT) → `taxes`,
 *      GST → `other_fees`. We don't have that breakdown here, so the whole
 *      charges total is placed in `taxes` by default unless explicit
 *      `brokerageRatio` etc. are supplied (future hook).
 */
import type { ReconstructedTrade } from "./types";
import type { BrokerPnlReport } from "./zerodha-pnl";

export interface AllocationResult {
  /** mutated copies of input trades with brokerage/taxes/other_fees populated */
  trades: ReconstructedTrade[];
  /** how much was allocated per symbol */
  appliedBySymbol: Map<string, number>;
  /** symbols present in charges report but with no trades in this import */
  unmatchedChargeSymbols: string[];
  /** symbols in import with no matching charges row */
  symbolsWithoutCharges: string[];
  totalAllocated: number;
}

function grossOf(t: ReconstructedTrade): number {
  const sign = t.side === "long" ? 1 : -1;
  return t.exits.reduce(
    (acc, e) => acc + (e.exit_price - t.entry_price) * e.quantity * sign,
    0,
  );
}

function notionalOf(t: ReconstructedTrade): number {
  return Math.abs(t.entry_price * t.quantity);
}

/** Split a charges total into (brokerage, taxes, other_fees) using sensible defaults. */
function splitCharge(total: number): { brokerage: number; taxes: number; other_fees: number } {
  // Without breakdown, place everything into "taxes" so it shows as "broker costs"
  // distinct from app-side manual brokerage edits. Users can re-split later.
  return { brokerage: 0, taxes: total, other_fees: 0 };
}

export function allocateChargesToTrades(
  trades: ReconstructedTrade[],
  report: BrokerPnlReport,
): AllocationResult {
  const out: ReconstructedTrade[] = [];
  const appliedBySymbol = new Map<string, number>();
  const symbolsWithoutCharges: string[] = [];

  // Group import trades by symbol
  const bySymbol = new Map<string, ReconstructedTrade[]>();
  for (const t of trades) {
    if (!bySymbol.has(t.symbol)) bySymbol.set(t.symbol, []);
    bySymbol.get(t.symbol)!.push(t);
  }

  for (const [symbol, group] of bySymbol) {
    const row = report.bySymbol.get(symbol);
    const charges = row?.charges ?? null;
    if (charges === null || charges <= 0 || group.length === 0) {
      if (charges === null) symbolsWithoutCharges.push(symbol);
      for (const t of group) out.push(t);
      continue;
    }

    // Weight per trade
    const weights = group.map((t) => Math.abs(grossOf(t)));
    let totalWeight = weights.reduce((a, b) => a + b, 0);
    let useNotional = totalWeight === 0;
    if (useNotional) {
      for (let i = 0; i < group.length; i++) weights[i] = notionalOf(group[i]);
      totalWeight = weights.reduce((a, b) => a + b, 0);
    }
    if (totalWeight === 0) {
      // Degenerate — every weight zero, distribute evenly
      for (let i = 0; i < group.length; i++) weights[i] = 1;
      totalWeight = group.length;
    }

    let allocated = 0;
    for (let i = 0; i < group.length; i++) {
      const share =
        i === group.length - 1
          ? charges - allocated // pin last to absorb rounding
          : (charges * weights[i]) / totalWeight;
      allocated += share;
      const t = group[i];
      const split = splitCharge(share);
      out.push({
        ...t,
        brokerage: split.brokerage,
        taxes: split.taxes,
        other_fees: split.other_fees,
      });
    }
    appliedBySymbol.set(symbol, charges);
  }

  // Symbols in the charges report that didn't match any import trade
  const importSymbols = new Set(trades.map((t) => t.symbol));
  const unmatchedChargeSymbols: string[] = [];
  for (const sym of report.bySymbol.keys()) {
    if (!importSymbols.has(sym)) unmatchedChargeSymbols.push(sym);
  }

  return {
    trades: out,
    appliedBySymbol,
    unmatchedChargeSymbols,
    symbolsWithoutCharges,
    totalAllocated: Array.from(appliedBySymbol.values()).reduce((a, b) => a + b, 0),
  };
}
