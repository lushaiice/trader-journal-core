## Why there's a gap today

The Zerodha **Tradebook CSV** (the file you import) has no charges column. The Zerodha **P&L report** you're comparing against is *net of all charges* (brokerage, STT/CTT, exchange txn, GST, SEBI, stamp). The app currently inserts every imported trade with `brokerage = 0, taxes = 0, other_fees = 0`. That alone routinely creates 10–40% gaps on F&O and 1–3% gaps on equity.

A second, structural gap: equity **orphan sells** (a sell with no prior buy in the imported window — i.e. you sold a pre-existing holding) are currently **dropped with a warning**. Their realized P&L therefore never enters the app, even though it shows up on the broker P&L.

A third, smaller gap: **open positions** contribute zero to app "Net P&L" (correct — unrealized), but the broker P&L statement *can* include MTM for open F&O lots depending on which tab you read. We won't change this, just document it.

Since you're not sure which direction the gap leans, step 1 is a reconciliation tool that tells us — then we fix the dominant cause first.

## Plan

### 1. Per-symbol reconciliation report (diagnose first)

Add a small in-app page **`/import/reconcile`** that:

- Lets you paste / upload the Zerodha **P&L CSV** (Equity and/or F&O — same Console export you're comparing against).
- Parses it (symbol, realized P&L, charges breakdown if present).
- Joins per-symbol against the app's realized Net P&L for the same date range.
- Renders a table: `symbol | broker_pnl | app_pnl | diff | likely_cause` where `likely_cause` is inferred from:
  - `app = 0 && broker ≠ 0` → orphan-sell skip
  - `|diff| ≈ broker_charges` → charges missing (the fix below)
  - `app sign ≠ broker sign` → side / flip bug worth inspecting
  - otherwise → "investigate"

This gives a deterministic answer to "where is the money?" without guessing.

### 2. Import charges from the Zerodha P&L CSV

The Tradebook does **not** carry charges, but the Zerodha Console **P&L** export does (per-symbol total charges, or per-trade in the detailed export). New flow:

- Extend the import wizard with an **optional second file**: "Charges & taxes (Zerodha P&L export)".
- Parse it and, per symbol + date range, allocate charges to imported trades pro-rata by **gross P&L magnitude** (or by **notional traded value** when gross is 0). Persist into the existing `trades.brokerage / taxes / other_fees` columns (we'll map: brokerage → brokerage; STT/CTT/exchange/SEBI/stamp → taxes; GST → other_fees).
- If charges file is not provided, show a calm banner on `/analytics` that "Net P&L excludes broker charges — import the Zerodha P&L file on /import to include them."

### 3. Stop silently dropping orphan equity sells

Today an equity sell with no prior buy in the window is just a warning. Change behaviour:

- Surface every `orphan_sell` row in the import **preview** with a one-click action: **"Treat as closing pre-existing holding"** → opens a tiny inline editor (entry price + entry date) to seed the position, then the sell is matched against it and a closed trade is created.
- Optional "Skip" stays available for genuinely irrelevant rows.
- No automatic fabrication — the trader supplies the cost basis, which is the only honest source for pre-window holdings.

### 4. Lock down the rest

- Add a unit-test fixture pair (Tradebook + matching P&L CSV) and assert per-symbol Net P&L equals broker Net P&L to within ₹0.01 after the charges allocation.
- Add a dev-only sanity check in `scripts/diagnose-import.ts` that prints app-vs-broker per-symbol diffs when both files are supplied.

### Out of scope (called out so we don't conflate)

- MTM on still-open F&O positions (the app correctly excludes; broker "P&L" tab sometimes includes).
- FIFO matching against a holdings file (we'll use the user-supplied cost basis for orphan sells instead — simpler and equally correct for reconciliation).

## Technical notes

- New parser: `src/lib/trades/import/zerodha-pnl.ts` (CSV header detection + per-symbol charges aggregation).
- New service: `src/lib/trades/import/allocate-charges.ts` (pure: `(trades, chargesBySymbol) → updates`).
- New route: `src/routes/_app.import.reconcile.tsx`.
- Wizard change: `src/routes/_app.import.tsx` adds an optional second dropzone + preview of allocated charges.
- Aggregator change in `aggregate.ts`: orphan sells become a typed `pendingOrphan` item carried into the preview rather than discarded; preview UI lets the user resolve each.
- DB: no schema change — `brokerage/taxes/other_fees` columns already exist on `trades`.

## What you'll see after the change

- A reconciliation page that tells you, per symbol, how big the gap is and why.
- An import flow where uploading the P&L CSV makes app Net P&L match the broker statement to the rupee for closed trades.
- Orphan sells become resolvable instead of silently dropped.
