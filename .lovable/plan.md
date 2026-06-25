
# Make realized P&L match the broker

The Net P&L on the dashboard is **−₹89,399** while Zerodha's statement for the same period shows realized **−₹24,946**. The ₹64.5K gap is not a charges issue — every fee in our CSV is 0. It comes from five concrete bugs in how we reconstruct trades from the Zerodha tradebook.

## The five causes (sized against your actual data)

1. **Per-position closing instead of per-lot FIFO (~₹17K).**
   Our aggregator only books realized P&L when a symbol's net quantity returns to zero. Brokers (and Zerodha's tax statement) book realized P&L on **every sell**, matched FIFO against the oldest unsold buy lots, even while the overall position stays open.
   Effect today: METALIETF (+₹9,808) and PHARMABEES (+₹7,237) show 0 P&L for us because they're still partially open; broker has already realized profit on the portions sold.

2. **MTF / `-BL` series merged into the main symbol (~₹0 net, but distorts every per-symbol view).**
   Zerodha tags margin-funded buys with the `-BL` series and treats `AXISBANK-BL` as a different security from `AXISBANK` for FIFO purposes. We uppercase and merge them, so a buy under `-BL` gets matched against a regular sell (or vice versa), producing wrong cost basis on both sides.
   Visible in: AXISBANK / AXISBANK-BL, HINDUNILVR / HINDUNILVR-BL, SUNPHARMA, ASIANPAINT, LT, TITAN.

3. **Corporate actions not applied (~₹14K).**
   Bonuses, splits, demergers and rights change the broker's cost basis and quantity automatically; the tradebook doesn't carry those adjustments. So a sell of a post-bonus quantity is matched against a pre-bonus higher per-share price on our side.
   Visible in: TATAINVEST (−₹7,479 diff), ADANIPOWER (−₹6,166), PIDILITIND (−₹4,093), BEML (−₹3,675).

4. **Pre-import opening positions missing (~₹26K, MCX alone).**
   Anything bought before the first tradebook in our system has no cost basis. The first sell of such a holding either gets dropped as an `orphan_sell` warning or — if a later buy of the same symbol exists — paired against that newer (higher) buy. MCX is the loudest case: broker +₹2,935, ours −₹23,110.

5. **Open trades excluded from realized totals (cosmetic but confusing).**
   Trades flagged "open" contribute 0 to Net P&L even when they have realized portions (because of #1). After #1 is fixed, "open" trades will correctly show a non-zero realized P&L for their already-sold quantity.

## What I'll build

### Phase 1 — Per-lot FIFO realized P&L (biggest single win)
Rewrite `src/lib/trades/import/aggregate.ts` to keep a FIFO queue of open buy lots per (symbol, series, instrument_type) and crystallize a realized exit on every sell, regardless of whether net position reaches zero. Each crystallized exit becomes a `trade_exits` row tied to the originating buy lot.

Two presentational changes follow:
- A trade's `status` becomes `closed` only when its entire entry quantity is exited (matches today); but `gross_pnl` for an open trade now includes realized P&L on already-sold portions.
- The dashboard's Net P&L sums realized P&L across **all** trades (open + closed), not just closed.

Migration: re-run import on existing `csv_import` trades; manual trades untouched.

### Phase 2 — Series-aware symbol key
Preserve the Zerodha `series` (`EQ`, `BL`, `BE`, `BZ`, `IL`) on the `Fill` and on the trade row, and key the FIFO state on `(symbol, series)` instead of `symbol` alone. Display name stays the bare symbol; FIFO and dedup respect the series.

### Phase 3 — Pre-import opening balances
Add a one-time "starting holdings" CSV importer (symbol, qty, avg cost, acquisition date) that seeds the FIFO queue before the tradebook is applied. Wired into `/import` as an optional first step. Replaces the current `orphan_sell` warning path for those symbols.

### Phase 4 — Corporate-action adjustments
New `corporate_actions` table (`symbol, ex_date, action_type, ratio_from, ratio_to, notes`). The FIFO replay reads it and rewrites lot quantity + cost basis at the ex-date. Seed with a manual entry UI on the trade row — no auto-fetch yet. Covers splits, bonuses, and consolidations; demergers and rights stay manual.

### Phase 5 — Reconciliation report
A `/import/reconcile` view that diffs our per-symbol realized P&L against the uploaded Zerodha P&L XLSX and lists the rows that still disagree, with the suspected cause (corporate action / opening position / series mismatch / charges). Confirms phases 1–4 worked and surfaces the long tail.

## Out of scope for this plan

- Live LTP + unrealized P&L tile (separate work the user already deferred).
- Other Credit & Debit lines (dividends, DP charges, MTF interest, AMC, buyback) — needs the funds ledger, not the tradebook.
- Auto-fetching corporate actions from NSE/BSE (manual seed first; auto-fetch later if useful).
- Currency / commodity segments (still intentionally skipped).

## Suggested order

Build Phase 1 first and re-measure against the Zerodha XLSX — that alone should pull the gap from ~₹64K down to ~₹40K. Then Phase 2 (cheap, removes noise on every per-symbol view). Then Phase 4 + 3 in either order. Phase 5 is the closing verification.

Tell me to start with Phase 1, or to bundle Phases 1 + 2 in one pass.
