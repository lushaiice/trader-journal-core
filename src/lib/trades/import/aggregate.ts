import type {
  Fill,
  FillSide,
  ImportWarning,
  ReconstructedExit,
  ReconstructedTrade,
} from "./types";

interface SplitFill extends Fill {
  // logical quantity to apply (may be a split portion of original fill)
}

interface InProgress {
  symbol: string;
  instrument_type: Fill["instrumentType"];
  openingSide: FillSide; // 'buy' for long, 'sell' for short
  entries: SplitFill[];
  exits: SplitFill[];
  fillTradeIds: string[];
  position: number; // signed running quantity
}

function weightedAvg(items: { price: number; quantity: number }[]): number {
  const totalQty = items.reduce((a, b) => a + b.quantity, 0);
  if (totalQty === 0) return 0;
  const sum = items.reduce((a, b) => a + b.price * b.quantity, 0);
  return sum / totalQty;
}

function aggregateExitsByOrder(exits: SplitFill[]): ReconstructedExit[] {
  const map = new Map<string, SplitFill[]>();
  const order: string[] = [];
  for (const f of exits) {
    if (!map.has(f.orderId)) {
      map.set(f.orderId, []);
      order.push(f.orderId);
    }
    map.get(f.orderId)!.push(f);
  }
  return order.map((oid) => {
    const group = map.get(oid)!;
    const qty = group.reduce((a, b) => a + b.quantity, 0);
    const price = weightedAvg(group);
    // Use earliest fill in group for date/time
    const earliest = group.reduce((a, b) =>
      a.executedAt.getTime() <= b.executedAt.getTime() ? a : b,
    );
    return {
      exit_price: price,
      quantity: qty,
      exit_date: earliest.tradeDate,
      exit_time: earliest.entryTimeHHMMSS,
    };
  });
}

function finalize(ip: InProgress): ReconstructedTrade {
  const side = ip.openingSide === "buy" ? "long" : "short";
  const status: "open" | "closed" = ip.position === 0 ? "closed" : "open";

  // entries are same-sign as openingSide
  const entryQty = ip.entries.reduce((a, b) => a + b.quantity, 0);
  const entryPrice = weightedAvg(ip.entries);
  const earliestEntry = ip.entries.reduce((a, b) =>
    a.executedAt.getTime() <= b.executedAt.getTime() ? a : b,
  );

  return {
    symbol: ip.symbol,
    instrument_type: ip.instrument_type,
    side,
    status,
    entry_date: earliestEntry.tradeDate,
    entry_time: earliestEntry.entryTimeHHMMSS,
    entry_price: entryPrice,
    quantity: entryQty,
    exits: status === "open" ? [] : aggregateExitsByOrder(ip.exits),
    brokerage: 0,
    taxes: 0,
    other_fees: 0,
    source: "csv_import",
    fillTradeIds: [...ip.fillTradeIds],
    grossOnly: true,
  };
}

export interface AggregateOutput {
  trades: ReconstructedTrade[];
  warnings: ImportWarning[];
}

export function aggregateFills(fills: Fill[]): AggregateOutput {
  const warnings: ImportWarning[] = [];
  const trades: ReconstructedTrade[] = [];

  // Group by symbol
  const bySymbol = new Map<string, Fill[]>();
  for (const f of fills) {
    if (!bySymbol.has(f.symbol)) bySymbol.set(f.symbol, []);
    bySymbol.get(f.symbol)!.push(f);
  }

  // Deterministic symbol order
  const symbols = Array.from(bySymbol.keys()).sort();

  for (const symbol of symbols) {
    const group = bySymbol.get(symbol)!.slice().sort((a, b) => {
      const dt = a.executedAt.getTime() - b.executedAt.getTime();
      if (dt !== 0) return dt;
      return a.tradeId < b.tradeId ? -1 : a.tradeId > b.tradeId ? 1 : 0;
    });

    let current: InProgress | null = null;

    const openWith = (f: SplitFill): InProgress => ({
      symbol: f.symbol,
      instrument_type: f.instrumentType,
      openingSide: f.side,
      entries: [f],
      exits: [],
      fillTradeIds: [f.tradeId],
      position: f.side === "buy" ? f.quantity : -f.quantity,
    });

    for (const fill of group) {
      let remaining = fill.quantity;
      let firstSlice = true;
      while (remaining > 0) {
        const slice: SplitFill = { ...fill, quantity: remaining };

        if (current === null) {
          current = openWith(slice);
          remaining = 0;
          break;
        }



        const signed = slice.side === "buy" ? slice.quantity : -slice.quantity;
        const newPos = current.position + signed;

        const sameDir =
          (current.openingSide === "buy" && slice.side === "buy") ||
          (current.openingSide === "sell" && slice.side === "sell");

        if (sameDir) {
          // extend entry
          current.entries.push(slice);
          if (firstSlice) current.fillTradeIds.push(fill.tradeId);
          current.position = newPos;
          remaining = 0;
        } else {
          // exit direction
          const currentAbs = Math.abs(current.position);
          if (slice.quantity <= currentAbs) {
            current.exits.push(slice);
            if (firstSlice) current.fillTradeIds.push(fill.tradeId);
            current.position = newPos;
            remaining = 0;
            if (current.position === 0) {
              trades.push(finalize(current));
              current = null;
            }
          } else {
            // flip: close current with currentAbs, then open new with remainder
            const closingQty = currentAbs;
            const closingSlice: SplitFill = { ...fill, quantity: closingQty };
            current.exits.push(closingSlice);
            if (firstSlice) current.fillTradeIds.push(fill.tradeId);
            current.position = 0;
            trades.push(finalize(current));
            current = null;

            warnings.push({
              code: "position_flip",
              message: `Fill crossed zero; split into close + new opposite trade`,
              symbol,
              rowRef: fill.tradeId,
            });

            remaining = remaining - closingQty;
            firstSlice = false;
            // loop continues; next iteration opens fresh trade with remainder
          }
        }
      }
    }

    if (current !== null) {
      warnings.push({
        code: "open_position",
        message: `Position did not return to zero for ${symbol}`,
        symbol,
      });
      trades.push(finalize(current));
    }
  }

  return { trades, warnings };
}
