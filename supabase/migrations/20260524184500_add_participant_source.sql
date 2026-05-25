ALTER TABLE public.challenge_participants
ADD COLUMN IF NOT EXISTS source text;

CREATE INDEX IF NOT EXISTS challenge_participants_source_idx
ON public.challenge_participants (source);
