import Papa from "papaparse";

export interface ParsedCsv {
  headers: string[];
  rows: Array<Record<string, string>>;
  /** Row numbers (1-based, matching the CSV incl. header) that papaparse flagged as unreadable. */
  malformedRowNumbers: number[];
}

/**
 * Thin, framework-independent CSV parse. Trims cells; no domain logic.
 *
 * Ragged rows (too few / too many fields) are tolerated — they're reported
 * via `malformedRowNumbers` rather than throwing, so a truncated final row
 * from an interrupted export doesn't kill the whole import.
 */
export function parseCsv(text: string): ParsedCsv {
  const result = Papa.parse<Record<string, string>>(text.trim(), {
    header: true,
    skipEmptyLines: true,
    transform: (v) => (typeof v === "string" ? v.trim() : v),
  });

  const malformedRowNumbers: number[] = [];
  const fatal: typeof result.errors = [];
  for (const err of result.errors) {
    // Papaparse row is 0-based over data rows; +2 → 1-based incl. header row.
    if (err.type === "FieldMismatch") {
      if (typeof err.row === "number") malformedRowNumbers.push(err.row + 2);
    } else {
      fatal.push(err);
    }
  }
  if (fatal.length) {
    const first = fatal[0];
    throw new Error(`CSV parse error: ${first.message} (row ${first.row ?? "?"})`);
  }

  const headers = (result.meta.fields ?? []).map((h) => h.trim());
  return { headers, rows: result.data, malformedRowNumbers };
}
