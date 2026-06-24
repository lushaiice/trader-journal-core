export type InstrumentType = "equity" | "futures" | "options";
export type FillSide = "buy" | "sell";
export type TradeSide = "long" | "short";
export type TradeStatus = "open" | "closed";

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
}

export interface ReconstructedTrade {
  symbol: string;
  instrument_type: InstrumentType;
  side: TradeSide;
  status: TradeStatus;
  entry_date: string;
  entry_time: string;
  entry_price: number;
  quantity: number;
  exits: ReconstructedExit[];
  brokerage: 0;
  taxes: 0;
  other_fees: 0;
  source: "csv_import";
  fillTradeIds: string[];
  grossOnly: true;
}

export interface ImportWarning {
  code:
    | "unknown_segment"
    | "bad_row"
    | "open_position"
    | "position_flip"
    | "symbol_too_long"
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
