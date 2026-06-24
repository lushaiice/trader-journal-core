## Schema groundwork for trades table

Single migration + minimal code wiring. No UI, no importer, no playbook screens.

### 1. Migration

Add four columns to `public.trades` and one partial unique index:

```sql
ALTER TABLE public.trades
  ADD COLUMN source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual','csv_import','kite')),
  ADD COLUMN external_ref text,
  ADD COLUMN entry_time time without time zone,
  ADD COLUMN playbook_id uuid;

CREATE UNIQUE INDEX trades_user_external_ref_unique
  ON public.trades (user_id, external_ref)
  WHERE external_ref IS NOT NULL;
```

Existing rows backfill to `source='manual'` automatically via the column default. No RLS changes — existing owner-scoped policies cover the new columns. No FK on `playbook_id` (playbooks table doesn't exist yet).

### 2. Generated types

`src/integrations/supabase/types.ts` regenerates after migration apply, exposing `source`, `external_ref`, `entry_time`, `playbook_id` on `trades` Row/Insert/Update.

### 3. Form schema (`src/lib/trades/schema.ts`)

Add only `playbook_id` to `tradeFormSchema`:

```ts
playbook_id: z.string().uuid().optional().nullable(),
```

`source`, `external_ref`, `entry_time` are server/importer-owned — not in the form.

### 4. API wiring (`src/lib/trades/api.ts`)

In `persistTrade`, include `playbook_id: values.playbook_id ?? null` in `tradePayload`. Do not set `source` — let the DB default to `'manual'`.

### Out of scope (later tasks)

Playbooks table + FK, CSV/Kite importer, entry_time population, any UI surfacing the new fields.
