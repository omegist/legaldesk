-- Claim each welcome email before sending it so retries and duplicate browser
-- requests cannot send multiple welcome messages to the same user.
CREATE TABLE IF NOT EXISTS public.welcome_email_log (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.welcome_email_log ENABLE ROW LEVEL SECURITY;

-- No client policies: only the service-role Edge Function can access this log.
