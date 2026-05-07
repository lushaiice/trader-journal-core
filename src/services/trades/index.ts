/** Trade service layer — re-exports persistence + storage helpers. */
export {
  uploadScreenshot as uploadTradeScreenshot,
  removeScreenshot as removeTradeScreenshot,
} from "@/lib/trades/api";

export type { TradeWithRelations } from "@/lib/trades/api";
