CREATE TABLE public.imported_fills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'zerodha',
  segment text NOT NULL,
  symbol text NOT NULL,
  isin text,
  exchange text,
  side text NOT NULL CHECK (side IN ('buy','sell')),
  quantity numeric NOT NULL,
  price numeric NOT NULL,
  trade_id text NOT NULL,
  order_id text,
  trade_date date,
  order_execution_time text,
  expiry_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, source, segment, trade_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.imported_fills TO authenticated;
GRANT ALL ON public.imported_fills TO service_role;

ALTER TABLE public.imported_fills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own imported fills select" ON public.imported_fills
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own imported fills insert" ON public.imported_fills
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own imported fills update" ON public.imported_fills
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own imported fills delete" ON public.imported_fills
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX imported_fills_user_id_idx ON public.imported_fills (user_id);