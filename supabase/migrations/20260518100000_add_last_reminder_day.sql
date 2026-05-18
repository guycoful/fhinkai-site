-- Track which challenge day's reminder was last sent to each participant.
-- Used by daily-recipients to skip duplicate sends on Make scenario re-runs
-- and by mark-reminder-sent (called by Make after successful WhatsApp send).
ALTER TABLE public.challenge_participants
  ADD COLUMN IF NOT EXISTS last_reminder_day INTEGER,
  ADD COLUMN IF NOT EXISTS last_reminder_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS challenge_participants_cohort_idx
  ON public.challenge_participants (cohort);
