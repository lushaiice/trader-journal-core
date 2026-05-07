/**
 * Trade domain types.
 *
 * Storage-shape rows live in @/lib/trades/calculations (TradeRow, ExitRow,
 * DisciplineRow) and are re-exported here under domain names.
 */
import type { Tables } from "@/integrations/supabase/types";

export type Trade = Tables<"trades">;
export type TradeExit = Tables<"trade_exits">;
export type DisciplineLog = Tables<"discipline_logs">;

export type InstrumentType = "equity" | "futures" | "options";
export type TradeSide = "long" | "short";
export type TradeStatus = "open" | "partial" | "closed";

export type TradeTag = string;

export interface EmotionalMetrics {
  confidence: number;
  emotion_level: number;
  recovery_urge: number;
  discipline_feel: number;
  setup_match: number;
}

export interface TradeWithRelations {
  trade: Trade;
  exits: TradeExit[];
  discipline: DisciplineLog[];
}

export type {
  TradeFormValues as TradeFormData,
  TradeFormParsed,
} from "@/lib/trades/schema";
