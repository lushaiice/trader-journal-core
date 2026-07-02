import { z } from "zod";
import type { Fill } from "./types";
import type { ParsedCsv } from "./parse-csv";

const EQUITY_HEADERS = [
  "symbol",
  "isin",
  "trade_date",
  "exchange",
  "segment",
  "series",
  "trade_type",
  "auction",
  "quantity",
  "price",
  "trade_id",
  "order_id",
  "order_execution_time",
] as const;

const FO_HEADERS = [
  "symbol",
  "trade_date",
  "exchange",
  "segment",
  "series",
  "trade_type",
  "auction",
  "quantity",
  "price",
  "trade_id",
  "order_id",
  "order_execution_time",
  "expiry_date",
] as const;

export type TradebookVariant = "equity" | "fo";

const num = z.coerce.number().finite();
const posNum = z.coerce.number().finite().positive();
const side = z
  .string()
  .transform((s) => s.trim().toLowerCase())
  .pipe(z.enum(["buy", "sell"]));

const rowSchema = z.object({
  symbol: z.string().min(1),
  segment: z.string().min(1),
  trade_date: z.string().min(1),
  trade_type: side,
  quantity: posNum,
  price: num,
  trade_id: z.string().min(1),
  order_id: z.string().min(1),
  order_execution_time: z.string().min(1),
  expiry_date: z.string().optional().nullable(),
});

/** Detect variant by presence of expiry_date. Missing required headers throw. */
export function detectVariant(headers: string[]): TradebookVariant {
  const set = new Set(headers.map((h) => h.toLowerCase()));
  const hasExpiry = set.has("expiry_date");
  const required = hasExpiry ? FO_HEADERS : EQUITY_HEADERS;
  const missing = required.filter((h) => !set.has(h));
  if (missing.length) {
    throw new Error(
      `Unrecognised Zerodha tradebook. Missing columns: ${missing.join(", ")}. ` +
        `Found: ${headers.join(", ") || "(none)"}`,
    );
  }
  return hasExpiry ? "fo" : "equity";
}

/** Validate & normalise CSV rows into typed Fills. */
export function rowsToFills(parsed: ParsedCsv): {
  variant: TradebookVariant;
  fills: Fill[];
} {
  const variant = detectVariant(parsed.headers);
  const fills: Fill[] = [];
  parsed.rows.forEach((raw, i) => {
    const r = rowSchema.safeParse(raw);
    if (!r.success) {
      throw new Error(
        `Row ${i + 2}: ${r.error.issues
          .map((x) => `${x.path.join(".") || "row"}: ${x.message}`)
          .join("; ")}`,
      );
    }
    const v = r.data;
    fills.push({
      symbol: v.symbol.toUpperCase(),
      segment: v.segment.toUpperCase(),
      expiry_date: variant === "fo" ? v.expiry_date || null : null,
      trade_date: v.trade_date,
      trade_type: v.trade_type,
      quantity: v.quantity,
      price: v.price,
      trade_id: v.trade_id,
      order_id: v.order_id,
      order_execution_time: v.order_execution_time,
    });
  });
  return { variant, fills };
}
