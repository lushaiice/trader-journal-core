CREATE TABLE public.broker_fills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  broker text NOT NULL DEFAULT 'zerodha',
  broker_trade_id text NOT NULL,
  imported_trade_id uuid REFERENCES public.trades(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX broker_fills_user_trade_unique
  ON public.broker_fills (user_id, broker, broker_trade_id);

CREATE INDEX broker_fills_imported_trade_id_idx
  ON public.broker_fills (imported_trade_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.broker_fills TO authenticated;
GRANT ALL ON public.broker_fills TO service_role;

ALTER TABLE public.broker_fills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own broker fills"
  ON public.broker_fills FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own broker fills"
  ON public.broker_fills FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own broker fills"
  ON public.broker_fills FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own broker fills"
  ON public.broker_fills FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);