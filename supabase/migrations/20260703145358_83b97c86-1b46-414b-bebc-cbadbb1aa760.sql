CREATE TABLE public.communication_consent (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  decision text NOT NULL CHECK (decision IN ('accepted','declined')),
  email_opt_in boolean NOT NULL DEFAULT false,
  sms_opt_in boolean NOT NULL DEFAULT false,
  phone_number text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.communication_consent TO authenticated;
GRANT ALL ON public.communication_consent TO service_role;

ALTER TABLE public.communication_consent ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own consent"
  ON public.communication_consent FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own consent"
  ON public.communication_consent FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own consent"
  ON public.communication_consent FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own consent"
  ON public.communication_consent FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER set_communication_consent_updated_at
  BEFORE UPDATE ON public.communication_consent
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();