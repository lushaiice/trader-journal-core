## Problem

Zerodha tradebooks now ship dates in `DD-MM-YYYY` format (e.g. `26-11-2025`, `order_execution_time = "26-11-2025T15:24:31"`). The parser in `src/lib/trades/import/zerodha.ts` passes these strings through untouched:

- `executedAt = new Date("26-11-2025T15:24:31Z")` → `Invalid Date` on some runtimes, or worse, silently misordered fills.
- `tradeDate` / `entry_date` / `exit_date` are stored verbatim and forwarded to Postgres `date` columns, producing `date/time field value out of range: "26-11-2025"` on insert.

Existing tests only cover the ISO `YYYY-MM-DD` shape, so regression slipped through.

## Fix

Single, contained change in the parser layer — no downstream logic touched.

### 1. `src/lib/trades/import/zerodha.ts`

Add a small helper:

```ts
// Accepts "YYYY-MM-DD" or "DD-MM-YYYY"; returns ISO "YYYY-MM-DD" or null.
function normalizeDate(raw: string): string | null
```

Apply it to:
- `tradeDate` (used as `entry_date` / `exit_date` in aggregate).
- `expiryDate` (when present).
- The date portion of `order_execution_time` before constructing `executedAt`. The time portion (`HH:MM:SS`) is preserved as-is.

If normalization fails, emit a `bad_row` warning and skip the row (same pattern already used for invalid timestamps).

### 2. Tests — `src/lib/trades/import/zerodha.test.ts`

Add cases:
- Parses `DD-MM-YYYY` `trade_date` + `order_execution_time` and stores ISO `YYYY-MM-DD` in `tradeDate`.
- Parses `DD-MM-YYYY` `expiry_date`.
- Mixed file (some rows ISO, some DD-MM-YYYY) round-trips correctly and orders fills chronologically.
- Garbage date (`2025/13/40`) → `bad_row` warning, row skipped.

### 3. No schema, no migration, no UI changes

Aggregator, persistence, and continuation logic all stay the same — they already trust `tradeDate` to be ISO. Once the parser normalizes upstream, the Postgres insert error disappears.

## Out of scope

- Auto-detecting other broker formats.
- Changing how `executedAt` handles timezones (still treated as IST wall clock, parsed as UTC for stable ordering).
