-- Consent columns for privacy-policy compliance (Ayelet, 18.6.2026)
-- Additive + nullable, backward-compatible. Stores explicit consent captured by
-- the new checkboxes on landing / READY / day1.

ALTER TABLE public.challenge_leads
  ADD COLUMN IF NOT EXISTS privacy_consent boolean,
  ADD COLUMN IF NOT EXISTS marketing_consent boolean,
  ADD COLUMN IF NOT EXISTS consent_text_version text,
  ADD COLUMN IF NOT EXISTS consent_at timestamptz;

ALTER TABLE public.challenge_participants
  ADD COLUMN IF NOT EXISTS privacy_consent boolean,
  ADD COLUMN IF NOT EXISTS marketing_consent boolean,
  ADD COLUMN IF NOT EXISTS consent_text_version text,
  ADD COLUMN IF NOT EXISTS consent_at timestamptz;
