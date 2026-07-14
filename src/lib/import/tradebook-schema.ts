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

export interface SkippedRow {
  rowNumber: number; // 1-based, includes header row
  reason: string;
}

const num = z.coerce.number().finite();
const posNum = z.coerce.number().finite().positive();
const side = z
  .string()
  .transform((s) => s.trim().toLowerCase())
  .pipe(z.enum(["buy", "sell"]));

const rowSchema = z.object({
  symbol: z.string().min(1),
  isin: z.string().optional().nullable(),
  exchange: z.string().optional().nullable(),
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

/**
 * Validate & normalise CSV rows into typed Fills.
 * Individual bad rows are collected into `skippedRows` — only unreadable
 * files (bad headers, zero valid rows) throw.
 */
export function rowsToFills(parsed: ParsedCsv): {
  variant: TradebookVariant;
  fills: Fill[];
  skippedRows: SkippedRow[];
} {
  const variant = detectVariant(parsed.headers);
  const fills: Fill[] = [];
  const skippedRows: SkippedRow[] = [];

  // Papaparse-flagged malformed rows first (truncated / ragged rows).
  for (const rowNumber of parsed.malformedRowNumbers) {
    skippedRows.push({ rowNumber, reason: "Row has wrong number of fields (likely truncated)." });
  }

  parsed.rows.forEach((raw, i) => {
    const rowNumber = i + 2; // 1-based including header
    const r = rowSchema.safeParse(raw);
    if (!r.success) {
      skippedRows.push({
        rowNumber,
        reason: r.error.issues.map((x) => `${x.path.join(".") || "row"}: ${x.message}`).join("; "),
      });
      return;
    }
    const v = r.data;
    fills.push({
      symbol: v.symbol.toUpperCase(),
      segment: v.segment.toUpperCase(),
      expiry_date: variant === "fo" ? v.expiry_date || null : null,
      isin: variant === "equity" ? (v.isin || null) : null,
      exchange: (v.exchange || "NSE").toUpperCase(),
      trade_date: v.trade_date,
      trade_type: v.trade_type,
      quantity: v.quantity,
      price: v.price,
      trade_id: v.trade_id,
      order_id: v.order_id,
      order_execution_time: v.order_execution_time,
    });
  });

  if (fills.length === 0) {
    throw new Error(
      "No valid trade rows found in this file. Check that it's an unmodified Zerodha Console tradebook export.",
    );
  }

  return { variant, fills, skippedRows };
}
