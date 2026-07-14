
-- corporate_actions: add isin + tighten constraints
ALTER TABLE public.corporate_actions ADD COLUMN IF NOT EXISTS isin text;

DO $$ BEGIN
  ALTER TABLE public.corporate_actions
    ADD CONSTRAINT corporate_actions_action_type_check
    CHECK (action_type IN ('split','bonus','consolidation'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS corporate_actions_user_key_ex_date_key
  ON public.corporate_actions (user_id, coalesce(isin, symbol), ex_date);

-- opening_positions: add isin + unique per user+symbol/isin
ALTER TABLE public.opening_positions ADD COLUMN IF NOT EXISTS isin text;

CREATE UNIQUE INDEX IF NOT EXISTS opening_positions_user_key_key
  ON public.opening_positions (user_id, coalesce(isin, symbol));
