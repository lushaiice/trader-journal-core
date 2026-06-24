-- 1) playbooks table
CREATE TABLE public.playbooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  description text CHECK (description IS NULL OR char_length(description) <= 1000),
  rules jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.playbooks TO authenticated;
GRANT ALL ON public.playbooks TO service_role;

ALTER TABLE public.playbooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own playbooks"
  ON public.playbooks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own playbooks"
  ON public.playbooks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own playbooks"
  ON public.playbooks FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own playbooks"
  ON public.playbooks FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER playbooks_updated_at
  BEFORE UPDATE ON public.playbooks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE UNIQUE INDEX playbooks_user_name_unique
  ON public.playbooks (user_id, lower(name));

-- 2) Deferred FK on trades.playbook_id (ON DELETE SET NULL preserves trade history)
ALTER TABLE public.trades
  ADD CONSTRAINT trades_playbook_id_fkey
  FOREIGN KEY (playbook_id) REFERENCES public.playbooks(id) ON DELETE SET NULL;
