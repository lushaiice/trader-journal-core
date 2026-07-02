
CREATE TABLE public.imported_trade_fills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trade_id uuid NOT NULL REFERENCES public.trades(id) ON DELETE CASCADE,
  source text NOT NULL,
  source_fill_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, source, source_fill_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.imported_trade_fills TO authenticated;
GRANT ALL ON public.imported_trade_fills TO service_role;

ALTER TABLE public.imported_trade_fills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own imported fills"
  ON public.imported_trade_fills FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own imported fills"
  ON public.imported_trade_fills FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own imported fills"
  ON public.imported_trade_fills FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own imported fills"
  ON public.imported_trade_fills FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX imported_trade_fills_lookup_idx
  ON public.imported_trade_fills (user_id, source, source_fill_id);

CREATE INDEX imported_trade_fills_trade_idx
  ON public.imported_trade_fills (trade_id);
