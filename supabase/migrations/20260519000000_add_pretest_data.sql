ALTER TABLE public.challenge_leads
  ADD COLUMN IF NOT EXISTS pre_test_data JSONB;
