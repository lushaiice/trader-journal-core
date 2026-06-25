import type { Fill, ImportWarning, InstrumentType } from "./types";

const SYMBOL_MAX = 40;

/**
 * Minimal CSV parser supporting quoted fields, doubled-quote escapes, CRLF.
 * Returns array of rows; each row is array of string cells. Skips empty trailing lines.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      cell += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ",") {
      row.push(cell);
      cell = "";
      i++;
      continue;
    }
    if (c === "\r") {
      i++;
      continue;
    }
    if (c === "\n") {
      row.push(cell);
      cell = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
      i++;
      continue;
    }
    cell += c;
    i++;
  }
  // flush
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    if (row.length > 1 || row[0] !== "") rows.push(row);
  }
  return rows;
}

/** Segments Zerodha emits that this importer intentionally does not support
 *  (currency derivatives, commodities). Reported as a counted skip, not an error. */
const UNSUPPORTED_SEGMENTS = new Set([
  "CDS",
  "CD",
  "BCD",
  "MCX",
  "COM",
  "COMM",
  "NCDEX",
  "NCO",
  "BCO",
]);

export function isUnsupportedSegment(segment: string): boolean {
  return UNSUPPORTED_SEGMENTS.has(segment.toUpperCase());
}

export function inferInstrumentType(
  symbol: string,
  segment: string,
): InstrumentType | null {
  const s = symbol.toUpperCase();
  const seg = segment.toUpperCase();
  if (seg === "EQ") return "equity";
  if (seg === "FO") {
    if (s.endsWith("CE") || s.endsWith("PE")) return "options";
    if (s.endsWith("FUT")) return "futures";
    return null;
  }
  return null;
}

/**
 * Accepts "YYYY-MM-DD" or "DD-MM-YYYY" (Zerodha's newer Console exports).
 * Returns ISO "YYYY-MM-DD" or null if the input is not a valid calendar date.
 */
export function normalizeDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  let y: number, m: number, d: number;
  let iso: string;
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  const dmyMatch = /^(\d{2})-(\d{2})-(\d{4})$/.exec(s);
  if (isoMatch) {
    y = Number(isoMatch[1]);
    m = Number(isoMatch[2]);
    d = Number(isoMatch[3]);
    iso = s;
  } else if (dmyMatch) {
    d = Number(dmyMatch[1]);
    m = Number(dmyMatch[2]);
    y = Number(dmyMatch[3]);
    iso = `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;
  } else {
    return null;
  }
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  // Validate via UTC Date round-trip (catches Feb 30 etc.)
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    return null;
  }
  return iso;
}

export interface ParseOutput {
  fills: Fill[];
  warnings: ImportWarning[];
  rowsParsed: number;
  rowsSkipped: number;
}

/**
 * Parse a Zerodha Console tradebook CSV into Fills.
 */
export function parseZerodhaTradebook(csvText: string): ParseOutput {
  const warnings: ImportWarning[] = [];
  const fills: Fill[] = [];
  let rowsSkipped = 0;

  const rows = parseCsv(csvText);
  if (rows.length === 0) {
    return { fills, warnings, rowsParsed: 0, rowsSkipped: 0 };
  }

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);

  const cols = {
    symbol: idx("symbol"),
    trade_date: idx("trade_date"),
    exchange: idx("exchange"),
    segment: idx("segment"),
    series: idx("series"),
    trade_type: idx("trade_type"),
    quantity: idx("quantity"),
    price: idx("price"),
    trade_id: idx("trade_id"),
    order_id: idx("order_id"),
    order_execution_time: idx("order_execution_time"),
    expiry_date: idx("expiry_date"),
  };

  const required: Array<keyof typeof cols> = [
    "symbol",
    "trade_date",
    "segment",
    "trade_type",
    "quantity",
    "price",
    "trade_id",
    "order_id",
    "order_execution_time",
  ];
  for (const k of required) {
    if (cols[k] < 0) {
      warnings.push({
        code: "bad_row",
        message: `Missing required column: ${k}`,
      });
      return { fills, warnings, rowsParsed: 0, rowsSkipped: rows.length - 1 };
    }
  }

  const dataRows = rows.slice(1);
  for (let r = 0; r < dataRows.length; r++) {
    const row = dataRows[r];
    const rowRef = `row ${r + 2}`;
    if (row.every((c) => c.trim() === "")) {
      continue;
    }
    const rawSymbol = (row[cols.symbol] ?? "").trim();
    const symbol = rawSymbol.toUpperCase();
    const segment = (row[cols.segment] ?? "").trim();
    const exchange = (row[cols.exchange] ?? "").trim();
    const series = cols.series >= 0 ? (row[cols.series] ?? "").trim() : "";
    const tradeType = (row[cols.trade_type] ?? "").trim().toLowerCase();
    const qty = Number(row[cols.quantity]);
    const price = Number(row[cols.price]);
    const tradeId = (row[cols.trade_id] ?? "").trim();
    const orderId = (row[cols.order_id] ?? "").trim();
    const execStr = (row[cols.order_execution_time] ?? "").trim();
    const tradeDate = (row[cols.trade_date] ?? "").trim();
    const expiryDate =
      cols.expiry_date >= 0 && row[cols.expiry_date]
        ? row[cols.expiry_date].trim() || null
        : null;

    if (!symbol || !tradeId || !orderId) {
      warnings.push({
        code: "bad_row",
        message: `Missing identifier fields`,
        rowRef,
      });
      rowsSkipped++;
      continue;
    }
    if (symbol.length > SYMBOL_MAX) {
      warnings.push({
        code: "symbol_too_long",
        message: `Symbol exceeds ${SYMBOL_MAX} chars: ${symbol}`,
        symbol,
        rowRef,
      });
      rowsSkipped++;
      continue;
    }
    if (tradeType !== "buy" && tradeType !== "sell") {
      warnings.push({
        code: "bad_row",
        message: `Invalid trade_type: ${tradeType}`,
        rowRef,
      });
      rowsSkipped++;
      continue;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      warnings.push({
        code: "bad_row",
        message: `Non-positive quantity`,
        rowRef,
      });
      rowsSkipped++;
      continue;
    }
    if (!Number.isFinite(price) || price <= 0) {
      warnings.push({
        code: "bad_row",
        message: `Non-positive price`,
        rowRef,
      });
      rowsSkipped++;
      continue;
    }

    const instrumentType = inferInstrumentType(symbol, segment);
    if (!instrumentType) {
      if (isUnsupportedSegment(segment)) {
        warnings.push({
          code: "unsupported_segment",
          message: `Unsupported segment ${segment} (only equity, futures, and options are imported)`,
          symbol,
          rowRef,
        });
      } else {
        warnings.push({
          code: "unknown_segment",
          message: `Cannot infer instrument type for segment=${segment} symbol=${symbol}`,
          symbol,
          rowRef,
        });
      }
      rowsSkipped++;
      continue;
    }

    // Normalize trade_date (accept ISO or DD-MM-YYYY).
    const normTradeDate = normalizeDate(tradeDate);
    if (!normTradeDate) {
      warnings.push({
        code: "bad_row",
        message: `Invalid trade_date: ${tradeDate}`,
        rowRef,
      });
      rowsSkipped++;
      continue;
    }

    const normExpiryDate = expiryDate ? normalizeDate(expiryDate) : null;
    if (expiryDate && !normExpiryDate) {
      warnings.push({
        code: "bad_row",
        message: `Invalid expiry_date: ${expiryDate}`,
        rowRef,
      });
      rowsSkipped++;
      continue;
    }

    // order_execution_time: "YYYY-MM-DD[T| ]HH:MM:SS" or "DD-MM-YYYY[T| ]HH:MM:SS".
    // Normalize date portion to ISO before constructing the Date for stable ordering.
    const execNormalized = execStr.replace(" ", "T");
    const tIdx = execNormalized.indexOf("T");
    const execDatePart = tIdx >= 0 ? execNormalized.slice(0, tIdx) : execNormalized;
    const execTimePart = tIdx >= 0 ? execNormalized.slice(tIdx + 1) : "";
    const normExecDate = normalizeDate(execDatePart);
    if (!normExecDate || !execTimePart) {
      warnings.push({
        code: "bad_row",
        message: `Invalid order_execution_time: ${execStr}`,
        rowRef,
      });
      rowsSkipped++;
      continue;
    }
    const isoForDate = `${normExecDate}T${execTimePart}`;
    const executedAt = new Date(isoForDate + (/[zZ]|[+-]\d{2}:?\d{2}$/.test(isoForDate) ? "" : "Z"));
    if (isNaN(executedAt.getTime())) {
      warnings.push({
        code: "bad_row",
        message: `Invalid order_execution_time: ${execStr}`,
        rowRef,
      });
      rowsSkipped++;
      continue;
    }

    const entryTimeHHMMSS = execTimePart.slice(0, 8);

    fills.push({
      symbol,
      instrumentType,
      side: tradeType,
      quantity: qty,
      price,
      tradeId,
      orderId,
      executedAt,
      tradeDate: normTradeDate,
      entryTimeHHMMSS,
      exchange,
      segment,
      series,
      expiryDate: normExpiryDate,
    });
  }

  return { fills, warnings, rowsParsed: dataRows.length, rowsSkipped };
}
