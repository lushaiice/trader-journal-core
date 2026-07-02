
# Zerodha Tradebook Import

Reconstruct fills from a Zerodha Console Tradebook CSV (EQ or F&O) into journal trades with FIFO round-trip matching, preview them, and persist idempotently via the existing trades service. Pure logic lives in `src/lib/import/` with Vitest coverage; UI reuses shadcn primitives; persistence reuses `trades` + `trade_exits` with a small dedupe side-table.

## Implementation Steps

### 1. Reconstruction library (`src/lib/import/`, pure, unit-tested)

Framework-independent, no Supabase/React imports. Layered so each stage is testable in isolation.

1. **`parse-csv.ts`** — Thin wrapper around `papaparse` (`bun add papaparse @types/papaparse`) that returns `{ headers, rows }` with trimmed cell values. No domain logic.
2. **`tradebook-schema.ts`** — Zod schemas for `EquityFillRow` (13 cols) and `FoFillRow` (14 cols, adds `expiry_date`). Detects variant by presence of `expiry_date` header. Rejects unknown headers with a friendly message listing what was found vs expected. Coerces `quantity`/`price` to numbers, `trade_date`/`order_execution_time` to ISO strings, `trade_type` to `"buy" | "sell"`.
3. **`symbol.ts`** — `classifyInstrument(symbol, hasExpiryColumn)` returns `{ instrument_type: "equity" | "futures" | "options", right?: "CE" | "PE" }`. Rules: no `expiry_date` column → equity; ends in `FUT` → futures; ends in `CE`/`PE` → options; else futures fallback for FO variant. Symbol string is stored verbatim (strike/expiry parsing is future work; noted in code comment).
4. **`group-orders.ts`** — `groupFillsIntoOrders(fills)`: groups by `order_id`, computes quantity-weighted avg price, summed qty, earliest `order_execution_time`, side from `trade_type` (asserts all fills in an order share a side), retains the set of source `trade_id`s.
5. **`reconstruct.ts`** — Core FIFO engine.
   - Group orders by position key: `symbol` for equity; `symbol + expiry_date` for FO.
   - Sort orders within a position by execution time.
   - Walk orders maintaining an open-lot queue. First order in an empty queue sets the position side (buy → long, sell → short). Same-side orders push a new lot; opposite-side orders consume lots FIFO, emitting a `RoundTrip` per fully-closed lot and a `PartialClose` when a closing order spans multiple lots.
   - Emits three record types: `ClosedTrade` (opening lot fully matched, one or more closing legs), `OpenTrade` (residual opening qty), `Orphan` (closing order with no opening lot — pre-window holding).
   - Re-entries on the same symbol after a flat state produce a fresh trade.
   - Each emitted record carries the source `trade_id[]` (union of opening + closing fills) for dedupe.
6. **`to-trade-payload.ts`** — Maps `ClosedTrade`/`OpenTrade` to the shape `persistTrade` expects: `symbol`, `instrument_type`, `side`, `entry_date` (ISO from opening order time), `entry_price` (opening order avg), `quantity` (opening qty), `exits: [{exit_price, quantity, exit_date}]` per closing order, fees = 0, emotion sliders = null, tags/notes empty, plus `status` inferred from residual. Attaches `sourceTradeIds` and `source: "zerodha_import"`.
7. **`gross-pnl.ts`** — Reuses `netPnl` shape from `calculations.ts` but explicitly returns gross (fees are 0 anyway). Used by the preview summary.

### 2. Persistence layer (`src/lib/trades/api.ts` extension)

- New `useImportTrades()` mutation that accepts the reconstructed payloads.
- For each payload:
  1. Query `imported_trade_fills` for any of the `sourceTradeIds` → skip if any already exist (idempotent).
  2. Insert `trades` row with `source: "zerodha_import"`, then `trade_exits` rows (mirrors `persistTrade`).
  3. Insert one `imported_trade_fills` row per source `trade_id` linking to the new trade.
- All writes RLS-scoped via `auth.uid()` (policies on the new table).
- Returns `{ imported, skipped }` counts so the UI can toast accurately.
- Invalidates `["trades"]` on success.

### 3. UI (`src/components/trades/import-dialog.tsx` + entry point)

- **Entry point**: new "Import from broker" button in `src/routes/_app.trades.tsx` header (next to "Add trade") and a secondary link on `_app.add-trade.tsx`.
- **Dialog** (shadcn `Dialog`) with three states:
  1. **Upload** — drag/drop CSV zone mirroring `screenshot-field.tsx` affordance; accepts `.csv`.
  2. **Preview** — summary card: date range, counts (closed / open / skipped-orphan / already-imported), total gross P&L, per-position breakdown table (`Table`) with reconstructed trades and an expandable `Accordion` for orphans with a plain-language "why skipped" line. Includes a calm disclosure block: gross-only P&L (no charges in tradebook), orphan sells skipped, recommend a wider export window.
  3. **Result** — success toast + counts; auto-close.
- Parsing/reconstruction runs client-side (no server round trip until confirm).
- Errors (bad headers, empty file) surface inline with the same tone as existing forms.

### 4. Migration (minimal, non-destructive)

One new side table for fill-level dedupe. No schema changes to `trades` (reuses existing `source` column with new value `"zerodha_import"`).

```sql
CREATE TABLE public.imported_trade_fills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trade_id uuid NOT NULL REFERENCES public.trades(id) ON DELETE CASCADE,
  source text NOT NULL,                    -- 'zerodha_import'
  source_fill_id text NOT NULL,            -- Zerodha trade_id from CSV
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, source, source_fill_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imported_trade_fills TO authenticated;
GRANT ALL ON public.imported_trade_fills TO service_role;
ALTER TABLE public.imported_trade_fills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own rows" ON public.imported_trade_fills
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX ON public.imported_trade_fills (user_id, source, source_fill_id);
```

The `UNIQUE (user_id, source, source_fill_id)` gives us a cheap idempotency check on re-import.

### 5. Tests (`tests/import/`)

Vitest, no network. Small hand-crafted CSV fixtures inline as strings.

- `parse.test.ts` — header detection (EQ vs FO), rejects malformed.
- `group-orders.test.ts` — 10 fills → 1 order, VWAP correctness, earliest time wins.
- `reconstruct.test.ts` — happy path: 1 buy + 1 sell → closed long; short entry: sell then buy → closed short (options case); partial close (2 buys 100 each, 1 sell 150) → 1 closed + 1 open; orphan sell only → Orphan; re-entry (buy/sell/buy/sell) → 2 trades.
- `to-trade-payload.test.ts` — gross P&L signs for long/short.

## Files to add / change

**New**
- `src/lib/import/parse-csv.ts` — papaparse wrapper.
- `src/lib/import/tradebook-schema.ts` — Zod row schemas + variant detection.
- `src/lib/import/symbol.ts` — instrument classification from tradingsymbol.
- `src/lib/import/group-orders.ts` — fills → orders (VWAP).
- `src/lib/import/reconstruct.ts` — FIFO position walker; emits closed/open/orphan.
- `src/lib/import/to-trade-payload.ts` — reconstruction → trades service shape.
- `src/lib/import/gross-pnl.ts` — preview summary math.
- `src/lib/import/types.ts` — shared types (`Fill`, `Order`, `Position`, `ReconstructedTrade`).
- `src/lib/import/index.ts` — barrel.
- `src/components/trades/import-dialog.tsx` — 3-state upload/preview/confirm dialog.
- `src/components/trades/import-preview-table.tsx` — preview breakdown.
- `tests/import/parse.test.ts`
- `tests/import/group-orders.test.ts`
- `tests/import/reconstruct.test.ts`
- `tests/import/to-trade-payload.test.ts`
- `supabase/migrations/<ts>_imported_trade_fills.sql` — dedupe side table + RLS.

**Changed**
- `src/lib/trades/api.ts` — add `useImportTrades` mutation; extract shared insert helper.
- `src/routes/_app.trades.tsx` — "Import from broker" button in `PageHeader.action`.
- `src/routes/_app.add-trade.tsx` — small secondary link.
- `package.json` / `bun.lock` — `papaparse` + `@types/papaparse`.

## Risks / assumptions to confirm

1. **`trade_id` uniqueness across variants** — assuming Zerodha's `trade_id` is globally unique per user (across EQ + FO). If it's only unique within a segment, the dedupe key should be `(segment, trade_id)`. Please confirm — otherwise I'll widen `source_fill_id` to include segment.
2. **`entry_date` type in `trades`** — column is `string` (looks like `timestamptz` or `date`). Reconstruction will pass full ISO from `order_execution_time`; existing hand-logged trades use datetime strings too, so this should be fine. Flag if you'd rather store trade-date only.
3. **Currency assumption** — Zerodha CSVs are INR; gross P&L displayed via existing `formatINR`. No FX handling.
4. **Options short-to-open** — explicitly handled: opening leg's `trade_type` determines side (`sell` → short). Confirm this matches how you'd want short options represented (side=`short`, entry=premium received, exit=premium paid).
5. **Duplicate-of-existing-hand-logged trades** — an imported trade could overlap a manually journalled one. We do NOT try to merge — imports come in as separate `source="zerodha_import"` rows. The user can delete manual duplicates. Confirm this is acceptable for v1.
6. **File size** — Zerodha exports can be tens of thousands of rows. Parsing + reconstruction is O(n) and stays client-side; no pagination needed for realistic personal-trader volumes (~<50k fills). Flag if you want a hard cap.
