ALTER TABLE public.trades
  ADD COLUMN source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual','csv_import','kite')),
  ADD COLUMN external_ref text,
  ADD COLUMN entry_time time without time zone,
  ADD COLUMN playbook_id uuid;

CREATE UNIQUE INDEX trades_user_external_ref_unique
  ON public.trades (user_id, external_ref)
  WHERE external_ref IS NOT NULL;