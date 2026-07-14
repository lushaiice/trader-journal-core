export { parseCsv } from "./parse-csv";
export type { ParsedCsv } from "./parse-csv";
export { rowsToFills, detectVariant } from "./tradebook-schema";
export type { TradebookVariant, SkippedRow } from "./tradebook-schema";
export { groupFillsIntoOrders, fillKey } from "./group-orders";
export { reconstructPositions } from "./reconstruct";
export { classifyInstrument } from "./symbol";
export * from "./types";

import { parseCsv } from "./parse-csv";
import { rowsToFills } from "./tradebook-schema";
import { groupFillsIntoOrders } from "./group-orders";
import { reconstructPositions } from "./reconstruct";
import type { ReconstructionResult } from "./types";

import type { SkippedRow } from "./tradebook-schema";
import type { ReconstructOptions } from "./reconstruct";
export type { ReconstructOptions } from "./reconstruct";
export type { CorporateAction, HoldingBaseline } from "./corporate-actions";
export { adjustOrdersForCorporateActions, computeRatioFactor } from "./corporate-actions";

/** Full pipeline: CSV text → reconstructed trades + orphans. */
export function reconstructFromCsv(
  text: string,
  options: ReconstructOptions = {},
): ReconstructionResult & {
  variant: "equity" | "fo";
  fillCount: number;
  skippedRows: SkippedRow[];
} {
  const parsed = parseCsv(text);
  const { variant, fills, skippedRows } = rowsToFills(parsed);
  const orders = groupFillsIntoOrders(fills);
  const result = reconstructPositions(orders, variant === "fo", options);
  return { ...result, variant, fillCount: fills.length, skippedRows };
}
