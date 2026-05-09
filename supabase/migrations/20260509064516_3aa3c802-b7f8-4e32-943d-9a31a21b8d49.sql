
-- Checklist responses
CREATE TABLE public.checklist_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  log_date date NOT NULL DEFAULT CURRENT_DATE,
  items jsonb NOT NULL DEFAULT '{}'::jsonb,
  readiness_score numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, log_date)
);
ALTER TABLE public.checklist_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own checklist select" ON public.checklist_responses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own checklist insert" ON public.checklist_responses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own checklist update" ON public.checklist_responses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own checklist delete" ON public.checklist_responses FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER checklist_responses_updated_at BEFORE UPDATE ON public.checklist_responses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Session notes
CREATE TABLE public.session_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  note_at timestamptz NOT NULL DEFAULT now(),
  category text NOT NULL DEFAULT 'observation',
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.session_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own session_notes select" ON public.session_notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own session_notes insert" ON public.session_notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own session_notes update" ON public.session_notes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own session_notes delete" ON public.session_notes FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX session_notes_user_date_idx ON public.session_notes (user_id, note_at DESC);
CREATE TRIGGER session_notes_updated_at BEFORE UPDATE ON public.session_notes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Daily reviews
CREATE TABLE public.daily_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  review_date date NOT NULL DEFAULT CURRENT_DATE,
  did_well text,
  mistakes text,
  emotionally_disciplined boolean,
  followed_plan boolean,
  improve_tomorrow text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, review_date)
);
ALTER TABLE public.daily_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own daily_reviews select" ON public.daily_reviews FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own daily_reviews insert" ON public.daily_reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own daily_reviews update" ON public.daily_reviews FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own daily_reviews delete" ON public.daily_reviews FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER daily_reviews_updated_at BEFORE UPDATE ON public.daily_reviews FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Weekly reviews
CREATE TABLE public.weekly_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  week_start date NOT NULL,
  summary text,
  best_setups text,
  worst_setups text,
  most_broken_rules text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start)
);
ALTER TABLE public.weekly_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own weekly_reviews select" ON public.weekly_reviews FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own weekly_reviews insert" ON public.weekly_reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own weekly_reviews update" ON public.weekly_reviews FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own weekly_reviews delete" ON public.weekly_reviews FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER weekly_reviews_updated_at BEFORE UPDATE ON public.weekly_reviews FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Process quality logs
CREATE TABLE public.process_quality_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  log_date date NOT NULL DEFAULT CURRENT_DATE,
  checklist_score numeric DEFAULT 0,
  discipline_score numeric DEFAULT 0,
  emotional_score numeric DEFAULT 0,
  journaling_score numeric DEFAULT 0,
  consistency_score numeric DEFAULT 0,
  total_score numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, log_date)
);
ALTER TABLE public.process_quality_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own pql select" ON public.process_quality_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own pql insert" ON public.process_quality_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own pql update" ON public.process_quality_logs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own pql delete" ON public.process_quality_logs FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER pql_updated_at BEFORE UPDATE ON public.process_quality_logs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trade post-trade review
ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS review_notes text,
  ADD COLUMN IF NOT EXISTS lessons_learned text;
