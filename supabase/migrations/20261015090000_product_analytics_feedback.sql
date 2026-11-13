-- Minimal first-party analytics and feedback. Event properties must never
-- contain case names, client details, document text, payment data, or secrets.
CREATE TABLE IF NOT EXISTS public.product_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  event_name TEXT NOT NULL CHECK (event_name IN (
    'signup_started', 'signup_confirmed', 'password_reset_requested',
    'password_reset_completed', 'checkout_started', 'checkout_completed'
  )),
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_events_event_created_idx
  ON public.product_events (event_name, created_at DESC);
ALTER TABLE public.product_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.customer_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 3 AND 2000),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.customer_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own feedback"
  ON public.customer_feedback FOR SELECT USING (user_id = auth.uid());

CREATE OR REPLACE VIEW public.subscription_metrics AS
SELECT
  date_trunc('day', created_at)::date AS day,
  tier,
  status,
  count(*) AS subscriptions
FROM public.subscriptions
GROUP BY 1, 2, 3;
