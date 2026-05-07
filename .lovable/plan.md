## Problem

Opening `/add-trade` throws `TypeError: Cannot destructure property 'control' of 'useFormContext(...)' as it is null` and the route renders the global error page.

Root cause: in `src/components/trades/trade-form.tsx`, `useTradeDraftAutosave(isNew)` is called inside `TradeForm` *before* `<FormProvider>` wraps the tree. The hook calls `useFormContext()` to read `control`, but the provider doesn't exist yet at that level, so the context is `null`.

## Fix

Make the draft autosave run inside the form context.

1. **`src/hooks/trades/use-trade-draft.ts`** — change `useTradeDraftAutosave` to accept the RHF `control` as a parameter (instead of calling `useFormContext` internally). Use the passed `control` with `useWatch({ control })`.

2. **`src/components/trades/trade-form.tsx`** — call the hook with `methods.control`:
   ```tsx
   useTradeDraftAutosave(isNew, methods.control);
   ```
   `methods` is the local `useForm` return value, so `control` is available without needing the provider. No other refactor needed; the hook still autosaves and `loadTradeDraft` / `clearTradeDraft` continue to work as today.

## Verification

- Navigate to `/add-trade` — page should render the full form instead of the error fallback.
- Type into a field, refresh, and confirm the draft restores (toast “Draft restored”).
- Submit a trade and confirm the draft clears.

No schema, DB, or other UI changes are required.