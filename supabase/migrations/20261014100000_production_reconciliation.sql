-- Production reconciliation for work previously applied outside migration history.
-- This migration deliberately excludes the obsolete 20261013000000 invite-token
-- rewrite because the current app uses firm_invites.id/email/status.

ALTER TABLE public.firms
  ALTER COLUMN name SET DEFAULT 'My Chambers';

-- Keep invoice numbering atomic while preserving explicitly supplied legacy
-- invoice numbers. New blank invoice numbers receive the next INV-xxxx value.
CREATE OR REPLACE FUNCTION public.assign_invoice_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num INTEGER;
BEGIN
  IF NEW.invoice_number IS NOT NULL
     AND NEW.invoice_number <> ''
     AND NEW.invoice_number NOT LIKE 'INV-%' THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(NEW.lawyer_id::text || '_invoice'));

  SELECT COALESCE(
    MAX(CAST(SUBSTRING(invoice_number FROM 5) AS INTEGER)), 0
  ) + 1
  INTO next_num
  FROM public.invoices
  WHERE lawyer_id = NEW.lawyer_id
    AND invoice_number LIKE 'INV-%'
    AND invoice_number ~ '^INV-[0-9]+$';

  NEW.invoice_number := 'INV-' || LPAD(next_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_invoice_number ON public.invoices;
CREATE TRIGGER trg_assign_invoice_number
  BEFORE INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.assign_invoice_number();

-- Claim a reminder before sending it. The unique key prevents duplicate email
-- or push reminders when a scheduled function is retried.
CREATE TABLE IF NOT EXISTS public.reminder_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diary_id UUID NOT NULL REFERENCES public.diaries(id) ON DELETE CASCADE,
  reminder_date DATE NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'push', 'whatsapp', 'sms')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (diary_id, reminder_date, channel)
);

ALTER TABLE public.reminder_log ENABLE ROW LEVEL SECURITY;
