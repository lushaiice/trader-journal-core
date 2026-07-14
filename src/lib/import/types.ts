/** Shared types for the Zerodha tradebook import pipeline. */

export type Side = "buy" | "sell";
export type InstrumentType = "equity" | "futures" | "options";

/** One fill row from the tradebook CSV (post-parse/validate). */
export interface Fill {
  symbol: string;
  segment: string; // used in dedupe key so EQ + FO trade_ids can't collide
  expiry_date: string | null; // null for equity
  isin: string | null; // null for F&O
  exchange: string; // NSE / BSE
  trade_date: string;
  trade_type: Side;
  quantity: number;
  price: number;
  trade_id: string;
  order_id: string;
  order_execution_time: string; // ISO datetime
}

/** Fills coalesced by order_id. */
export interface Order {
  order_id: string;
  symbol: string;
  segment: string;
  expiry_date: string | null;
  side: Side;
  quantity: number;
  avg_price: number; // quantity-weighted
  execution_time: string; // earliest fill time in order
  source_fill_ids: string[]; // "segment:trade_id"
}

export interface ReconstructedTrade {
  kind: "closed" | "open";
  symbol: string;
  segment: string;
  instrument_type: InstrumentType;
  side: "long" | "short";
  entry_date: string;
  entry_price: number;
  quantity: number; // opening quantity
  exits: Array<{
    exit_price: number;
    quantity: number;
    exit_date: string;
  }>;
  gross_pnl: number; // signed by side; only exits contribute
  source_fill_ids: string[];
}

export interface Orphan {
  symbol: string;
  segment: string;
  expiry_date: string | null;
  side: Side; // side of unmatched closing order
  quantity: number;
  price: number;
  execution_time: string;
  reason: string;
  source_fill_ids: string[];
}

export interface ReconstructionResult {
  trades: ReconstructedTrade[];
  orphans: Orphan[];
}
