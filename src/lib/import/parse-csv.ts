import Papa from "papaparse";

export interface ParsedCsv {
  headers: string[];
  rows: Array<Record<string, string>>;
}

/** Thin, framework-independent CSV parse. Trims cells; no domain logic. */
export function parseCsv(text: string): ParsedCsv {
  const result = Papa.parse<Record<string, string>>(text.trim(), {
    header: true,
    skipEmptyLines: true,
    transform: (v) => (typeof v === "string" ? v.trim() : v),
  });
  if (result.errors.length) {
    const first = result.errors[0];
    throw new Error(`CSV parse error: ${first.message} (row ${first.row ?? "?"})`);
  }
  const headers = (result.meta.fields ?? []).map((h) => h.trim());
  return { headers, rows: result.data };
}
