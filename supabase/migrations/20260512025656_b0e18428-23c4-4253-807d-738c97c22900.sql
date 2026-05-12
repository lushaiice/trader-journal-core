-- Capital Events: source of truth for portfolio capital
CREATE TABLE public.capital_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('initial','deposit','withdrawal')),
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  event_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_capital_events_user_date ON public.capital_events (user_id, event_date);

ALTER TABLE public.capital_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own capital_events select" ON public.capital_events
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own capital_events insert" ON public.capital_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own capital_events update" ON public.capital_events
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own capital_events delete" ON public.capital_events
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_capital_events_updated_at
  BEFORE UPDATE ON public.capital_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();