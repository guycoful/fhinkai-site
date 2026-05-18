-- Clear test reminder marks set during 18.5.2026 integration testing.
-- These were created by manually POSTing to mark-reminder-sent for QA;
-- no actual WhatsApp messages were sent.
UPDATE public.challenge_participants
SET last_reminder_day = NULL,
    last_reminder_sent_at = NULL
WHERE last_reminder_sent_at IS NOT NULL
  AND last_reminder_sent_at >= '2026-05-18T00:00:00+03:00';
