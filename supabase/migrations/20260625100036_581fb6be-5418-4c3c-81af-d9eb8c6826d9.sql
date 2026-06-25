-- Phase 3: pre-import opening positions
CREATE TABLE public.opening_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  side text NOT NULL CHECK (side IN ('long','short')),
  quantity numeric NOT NULL CHECK (quantity > 0),
  avg_cost numeric NOT NULL CHECK (avg_cost >= 0),
  acquisition_date date NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, symbol)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.opening_positions TO authenticated;
GRANT ALL ON public.opening_positions TO service_role;

ALTER TABLE public.opening_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "opening_positions_select_own" ON public.opening_positions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "opening_positions_insert_own" ON public.opening_positions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "opening_positions_update_own" ON public.opening_positions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "opening_positions_delete_own" ON public.opening_positions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER opening_positions_set_updated_at
  BEFORE UPDATE ON public.opening_positions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Phase 4: corporate actions (splits / bonuses / consolidations)
CREATE TABLE public.corporate_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  ex_date date NOT NULL,
  action_type text NOT NULL CHECK (action_type IN ('split','bonus','consolidation')),
  ratio_from numeric NOT NULL CHECK (ratio_from > 0),
  ratio_to numeric NOT NULL CHECK (ratio_to > 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.corporate_actions TO authenticated;
GRANT ALL ON public.corporate_actions TO service_role;

ALTER TABLE public.corporate_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "corporate_actions_select_own" ON public.corporate_actions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "corporate_actions_insert_own" ON public.corporate_actions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "corporate_actions_update_own" ON public.corporate_actions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "corporate_actions_delete_own" ON public.corporate_actions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER corporate_actions_set_updated_at
  BEFORE UPDATE ON public.corporate_actions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX corporate_actions_user_symbol_idx
  ON public.corporate_actions (user_id, symbol, ex_date);