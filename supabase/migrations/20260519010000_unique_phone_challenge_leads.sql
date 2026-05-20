ALTER TABLE public.challenge_leads
  ADD CONSTRAINT challenge_leads_phone_unique UNIQUE (phone);
