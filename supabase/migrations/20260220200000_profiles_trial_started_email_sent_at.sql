-- Idempotency for "Trial started" email: send at most once per user.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_started_email_sent_at timestamptz;
