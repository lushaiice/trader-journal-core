export type InstrumentType = "equity" | "futures" | "options";
export type FillSide = "buy" | "sell";
export type TradeSide = "long" | "short";
export type TradeStatus = "open" | "partial" | "closed";

export interface Fill {
  symbol: string;
  instrumentType: InstrumentType;
  side: FillSide;
  quantity: number;
  price: number;
  tradeId: string;
  orderId: string;
  executedAt: Date;
  tradeDate: string; // YYYY-MM-DD
  entryTimeHHMMSS: string; // HH:MM:SS
  exchange: string;
  segment: string;
  series: string;
  expiryDate: string | null;
}

export interface ReconstructedExit {
  exit_price: number;
  quantity: number;
  exit_date: string;
  exit_time: string;
  /** Per-lot FIFO matched cost basis. Optional for backward compatibility;
   *  when omitted, downstream code falls back to trade.entry_price. */
  entry_price?: number;
}


export interface ReconstructedTrade {
  symbol: string;
  instrument_type: InstrumentType;
  side: TradeSide;
  status: "open" | "closed";
  entry_date: string;
  entry_time: string;
  entry_price: number;
  quantity: number;
  exits: ReconstructedExit[];
  /** May be populated by charges allocation from a Zerodha P&L CSV. */
  brokerage: number;
  taxes: number;
  other_fees: number;
  source: "csv_import";
  fillTradeIds: string[];
  /** True until charges have been allocated to this trade. */
  grossOnly: boolean;
}

export interface ImportWarning {
  code:
    | "unknown_segment"
    | "unsupported_segment"
    | "bad_row"
    | "open_position"
    | "position_flip"
    | "symbol_too_long"
    | "added_to_position"
    | "out_of_order_fill"
    | "ambiguous_continuation"
    | "orphan_sell"
    | string;
  message: string;
  symbol?: string;
  rowRef?: string;
}

export interface ImportStats {
  rowsParsed: number;
  rowsSkipped: number;
  tradesClosed: number;
  tradesOpen: number;
  symbols: number;
}

export interface ImportResult {
  trades: ReconstructedTrade[];
  warnings: ImportWarning[];
  stats: ImportStats;
}

/** Seed describing an existing OPEN or PARTIAL imported trade for one symbol. */
export interface SeedPosition {
  tradeId: string;
  symbol: string;
  side: TradeSide;
  entryPrice: number; // existing weighted-avg entry
  entryQuantity: number; // existing total entry qty
  openQuantity: number; // net qty still open (entry - exited)
  earliestEntryAt: Date;
}

export interface ContinuationExit {
  exitPrice: number;
  quantity: number;
  exitDate: string;
  exitTime: string;
  brokerTradeId: string;
  /** Per-lot FIFO matched cost basis (Phase 1). */
  entryPrice?: number;
}


export interface Continuation {
  existingTradeId: string;
  symbol: string;
  addedFillTradeIds: string[];
  newEntryPrice: number;
  newQuantity: number;
  newExits: ContinuationExit[];
  newStatus: "open" | "partial" | "closed";
  flipRemainder?: ReconstructedTrade;
  warnings: string[];
}

/** Phase 3 — pre-import opening holding for one symbol. */
export interface OpeningPosition {
  symbol: string;
  side: TradeSide;
  quantity: number;
  avgCost: number;
  acquisitionDate: string; // YYYY-MM-DD
}

/** Phase 4 — corporate action that rewrites units & cost basis at ex-date. */
export interface CorporateAction {
  symbol: string;
  exDate: string; // YYYY-MM-DD
  actionType: "split" | "bonus" | "consolidation";
  ratioFrom: number;
  ratioTo: number;
}

