/**
 * Parser for Zerodha Console P&L / Tax-P&L / Charges exports.
 *
 * Header detection is flexible — different Console reports use different column
 * names. We extract per-symbol:
 *   - realized_pnl  (net of charges, as the broker reports it)
 *   - charges       (sum of brokerage + STT/CTT + exchange + SEBI + stamp + GST + IPFT)
 *
 * If the file lacks an explicit charges column but has both gross/net P&L
 * (e.g. "Profit" + "Net Profit"), we infer charges = gross - net.
 */
import { parseCsv } from "./zerodha";

export interface BrokerSymbolRow {
  symbol: string;
  realizedPnl: number | null;
  charges: number | null;
}

export interface BrokerPnlReport {
  rows: BrokerSymbolRow[];
  bySymbol: Map<string, BrokerSymbolRow>;
  totals: {
    realizedPnl: number;
    charges: number;
    symbols: number;
  };
  warnings: string[];
  columnsDetected: string[];
}

const SYMBOL_KEYS = ["symbol", "scrip", "instrument", "tradingsymbol", "scrip_name"];
const REALIZED_PNL_KEYS = [
  "net profit",
  "net_profit",
  "net p&l",
  "net pnl",
  "realized p&l",
  "realised p&l",
  "realized pnl",
  "realised pnl",
  "realized profit",
  "realised profit",
  "p&l",
  "pnl",
  "profit",
];
const GROSS_PNL_KEYS = ["gross profit", "gross p&l", "gross pnl"];

// any of these columns sum into "charges"
const CHARGE_COLUMN_PATTERNS: RegExp[] = [
  /^brokerage$/i,
  /^stt(\/ctt)?$/i,
  /^ctt$/i,
  /^exchange( transaction)? charges?$/i,
  /^exch(ange)?[_ ]?(txn|trans|transaction)?[_ ]?charges?$/i,
  /^sebi( charges)?$/i,
  /^sebi[_ ]?charges?$/i,
  /^stamp( duty| charges)?$/i,
  /^stamp[_ ]?(duty|charges)?$/i,
  /^gst$/i,
  /^ipft$/i,
  /^total[_ ]?charges?$/i,
  /^charges?$/i,
];

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

function parseNumber(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const s = raw.replace(/[,₹\s]/g, "").trim();
  if (!s || s === "-" || s === "—") return null;
  // accept "(123.45)" as negative
  const neg = /^\(.*\)$/.test(s);
  const cleaned = neg ? s.slice(1, -1) : s;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return neg ? -n : n;
}

function findIndex(header: string[], keys: string[]): number {
  for (const k of keys) {
    const i = header.indexOf(k);
    if (i >= 0) return i;
  }
  return -1;
}

export function parseBrokerPnlReport(csvText: string): BrokerPnlReport {
  const warnings: string[] = [];
  const rows = parseCsv(csvText);
  const empty: BrokerPnlReport = {
    rows: [],
    bySymbol: new Map(),
    totals: { realizedPnl: 0, charges: 0, symbols: 0 },
    warnings: ["empty file"],
    columnsDetected: [],
  };
  if (!rows.length) return empty;

  // Find the header row — Zerodha exports often have a few metadata rows on top.
  // Heuristic: first row containing both a symbol-ish column AND a numeric-style column.
  let headerRowIndex = -1;
  let header: string[] = [];
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const cand = rows[i].map(normalizeHeader);
    const hasSymbol = SYMBOL_KEYS.some((k) => cand.includes(k));
    const hasNumeric =
      cand.some((c) => REALIZED_PNL_KEYS.includes(c)) ||
      cand.some((c) => CHARGE_COLUMN_PATTERNS.some((re) => re.test(c)));
    if (hasSymbol && hasNumeric) {
      headerRowIndex = i;
      header = cand;
      break;
    }
  }
  if (headerRowIndex < 0) {
    return {
      ...empty,
      warnings: ["could not detect a symbol + value column header — file format not recognized"],
    };
  }

  const symbolIdx = findIndex(header, SYMBOL_KEYS);
  const realizedIdx = findIndex(header, REALIZED_PNL_KEYS);
  const grossIdx = findIndex(header, GROSS_PNL_KEYS);
  const chargeIdxs: number[] = [];
  for (let i = 0; i < header.length; i++) {
    if (i === symbolIdx) continue;
    if (CHARGE_COLUMN_PATTERNS.some((re) => re.test(header[i]))) chargeIdxs.push(i);
  }

  const columnsDetected: string[] = [];
  if (symbolIdx >= 0) columnsDetected.push(`symbol="${header[symbolIdx]}"`);
  if (realizedIdx >= 0) columnsDetected.push(`realized="${header[realizedIdx]}"`);
  if (grossIdx >= 0) columnsDetected.push(`gross="${header[grossIdx]}"`);
  for (const i of chargeIdxs) columnsDetected.push(`charge="${header[i]}"`);

  if (symbolIdx < 0) {
    return {
      ...empty,
      warnings: ["no symbol column found"],
      columnsDetected,
    };
  }
  if (realizedIdx < 0 && chargeIdxs.length === 0) {
    return {
      ...empty,
      warnings: ["no realized-P&L or charges columns found"],
      columnsDetected,
    };
  }

  // If the only "realized" column we found is a GROSS column AND no separate charges
  // are available, we can't infer net — record the gross only.
  const useGrossAsRealized = realizedIdx < 0 && grossIdx >= 0;

  // Aggregate by symbol (same symbol can appear on multiple rows for F&O legs).
  const bySymbol = new Map<string, BrokerSymbolRow>();
  for (let r = headerRowIndex + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row.length || row.every((c) => c.trim() === "")) continue;
    const symbolRaw = (row[symbolIdx] ?? "").trim();
    if (!symbolRaw) continue;
    // Stop at totals / summary rows that often appear at file end
    if (/^total$|^grand total$|^net$/i.test(symbolRaw)) continue;
    const symbol = symbolRaw.toUpperCase();

    const realized = useGrossAsRealized
      ? parseNumber(row[grossIdx])
      : parseNumber(row[realizedIdx]);

    let charges: number | null = null;
    if (chargeIdxs.length > 0) {
      let sum = 0;
      let any = false;
      for (const i of chargeIdxs) {
        const v = parseNumber(row[i]);
        if (v !== null) {
          sum += v;
          any = true;
        }
      }
      if (any) charges = sum;
    } else if (realizedIdx >= 0 && grossIdx >= 0) {
      // infer: charges = gross - net
      const g = parseNumber(row[grossIdx]);
      const n = parseNumber(row[realizedIdx]);
      if (g !== null && n !== null) charges = g - n;
    }

    const prior = bySymbol.get(symbol);
    if (prior) {
      prior.realizedPnl =
        (prior.realizedPnl ?? 0) + (realized ?? 0);
      prior.charges = (prior.charges ?? 0) + (charges ?? 0);
    } else {
      bySymbol.set(symbol, {
        symbol,
        realizedPnl: realized,
        charges,
      });
    }
  }

  const outRows = Array.from(bySymbol.values()).sort((a, b) =>
    a.symbol.localeCompare(b.symbol),
  );

  const totals = {
    realizedPnl: outRows.reduce((a, r) => a + (r.realizedPnl ?? 0), 0),
    charges: outRows.reduce((a, r) => a + (r.charges ?? 0), 0),
    symbols: outRows.length,
  };

  if (useGrossAsRealized) {
    warnings.push(
      "no explicit net-P&L column found; using gross as a proxy — charges may not be representable",
    );
  }
  if (outRows.length === 0) {
    warnings.push("header row detected but no data rows parsed");
  }

  return { rows: outRows, bySymbol, totals, warnings, columnsDetected };
}
