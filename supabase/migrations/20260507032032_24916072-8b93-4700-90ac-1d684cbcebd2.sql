
-- Extend trades with planned, costs, emotional scores, tags
ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS planned_entry numeric,
  ADD COLUMN IF NOT EXISTS planned_stop_loss numeric,
  ADD COLUMN IF NOT EXISTS planned_target numeric,
  ADD COLUMN IF NOT EXISTS brokerage numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS taxes numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_fees numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS confidence smallint,
  ADD COLUMN IF NOT EXISTS emotion_level smallint,
  ADD COLUMN IF NOT EXISTS recovery_urge smallint,
  ADD COLUMN IF NOT EXISTS discipline_feel smallint,
  ADD COLUMN IF NOT EXISTS setup_match smallint,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}'::text[];

-- Link discipline logs to a trade (optional)
ALTER TABLE public.discipline_logs
  ADD COLUMN IF NOT EXISTS trade_id uuid REFERENCES public.trades(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_discipline_logs_trade_id ON public.discipline_logs(trade_id);
CREATE INDEX IF NOT EXISTS idx_trades_user_entry_date ON public.trades(user_id, entry_date DESC);

-- Storage bucket for trade screenshots
INSERT INTO storage.buckets (id, name, public)
VALUES ('trade-screenshots', 'trade-screenshots', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: users manage files inside their own user-id folder
DROP POLICY IF EXISTS "trade screenshots are publicly readable" ON storage.objects;
CREATE POLICY "trade screenshots are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'trade-screenshots');

DROP POLICY IF EXISTS "users upload own trade screenshots" ON storage.objects;
CREATE POLICY "users upload own trade screenshots"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'trade-screenshots'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "users update own trade screenshots" ON storage.objects;
CREATE POLICY "users update own trade screenshots"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'trade-screenshots'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "users delete own trade screenshots" ON storage.objects;
CREATE POLICY "users delete own trade screenshots"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'trade-screenshots'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
