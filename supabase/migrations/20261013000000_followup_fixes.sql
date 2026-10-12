-- ============================================================
-- VakilDesk follow-up fixes  2026-10-13
-- Apply in Supabase SQL Editor (safe to re-run; all DDL is
-- guarded with IF EXISTS / IF NOT EXISTS / OR REPLACE).
-- ============================================================

-- ── 1. firms.name: add a sensible default so upserts without a name never fail ─

ALTER TABLE firms
  ALTER COLUMN name SET DEFAULT 'My Chambers';


-- ── 2. Invoice trigger: ignore legacy invoice numbers ─────────────────────────
--
-- The BEFORE INSERT trigger assign_invoice_number() was added in the previous
-- migration.  We need to skip assignment when the invoice_number is already in
-- a non-empty, non-INV-prefixed legacy format such as "2026/001".

CREATE OR REPLACE FUNCTION assign_invoice_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  next_num INTEGER;
BEGIN
  -- Skip if a non-empty, non-INV-prefixed number was already supplied
  -- (handles legacy invoice numbers like "2026/001").
  IF NEW.invoice_number IS NOT NULL
     AND NEW.invoice_number <> ''
     AND NEW.invoice_number NOT LIKE 'INV-%' THEN
    RETURN NEW;
  END IF;

  -- Acquire an advisory lock scoped to this transaction so two concurrent
  -- inserts for the same lawyer cannot pick the same sequence value.
  PERFORM pg_advisory_xact_lock(hashtext(NEW.lawyer_id::text || '_invoice'));

  SELECT COALESCE(
    MAX(CAST(SUBSTRING(invoice_number FROM 5) AS INTEGER)), 0
  ) + 1
  INTO next_num
  FROM invoices
  WHERE lawyer_id = NEW.lawyer_id
    AND invoice_number LIKE 'INV-%'
    AND invoice_number ~ '^INV-[0-9]+$';

  NEW.invoice_number := 'INV-' || LPAD(next_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

-- Re-attach (drop first in case it already exists from the previous migration)
DROP TRIGGER IF EXISTS trg_assign_invoice_number ON invoices;
CREATE TRIGGER trg_assign_invoice_number
  BEFORE INSERT ON invoices
  FOR EACH ROW EXECUTE FUNCTION assign_invoice_number();


-- ── 3. accept_invite: refuse when the owner profile is missing ────────────────
--
-- The previous migration added the owner-tier check but not the null-profile
-- guard.  Replace the whole function.

CREATE OR REPLACE FUNCTION accept_invite(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv          RECORD;
  owner_profile RECORD;
  caller_email  TEXT;
  member_count  INTEGER;
BEGIN
  -- Use the email from the login token, not the editable profiles.email
  caller_email := lower(auth.jwt() ->> 'email');
  IF caller_email IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  -- Fetch the invite
  SELECT * INTO inv
  FROM   firm_invites
  WHERE  token = p_token
    AND  accepted_at IS NULL
    AND  expires_at > now();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'invite_not_found_or_expired');
  END IF;

  IF lower(inv.invitee_email) <> caller_email THEN
    RETURN jsonb_build_object('error', 'email_mismatch');
  END IF;

  -- Lock the owner row to serialise concurrent accepts
  SELECT * INTO owner_profile
  FROM   profiles
  WHERE  id = inv.firm_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'owner_profile_missing');
  END IF;

  IF owner_profile.subscription_tier NOT IN ('chambers', 'firm') THEN
    RETURN jsonb_build_object('error', 'owner_not_on_paid_plan');
  END IF;

  -- Check member cap for Chambers (2 members)
  IF owner_profile.subscription_tier = 'chambers' THEN
    SELECT COUNT(*) INTO member_count
    FROM   profiles
    WHERE  firm_id = inv.firm_id
      AND  id <> inv.firm_id;

    IF member_count >= 2 THEN
      RETURN jsonb_build_object('error', 'chambers_capacity_reached');
    END IF;
  END IF;

  -- Accept
  UPDATE firm_invites
  SET    accepted_at = now()
  WHERE  token = p_token;

  UPDATE profiles
  SET    firm_id = inv.firm_id
  WHERE  id = auth.uid();

  RETURN jsonb_build_object('ok', true);
END;
$$;


-- ── 4. reminder_log: idempotency table for send-hearing-reminders ─────────────
--
-- Each (diary_id, reminder_date, channel) triple is claimed atomically before
-- sending so a retry or duplicate cron trigger never sends twice.

CREATE TABLE IF NOT EXISTS reminder_log (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  diary_id     UUID        NOT NULL REFERENCES diaries(id) ON DELETE CASCADE,
  reminder_date DATE       NOT NULL,
  channel      TEXT        NOT NULL CHECK (channel IN ('email', 'push', 'whatsapp', 'sms')),
  sent_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (diary_id, reminder_date, channel)
);

-- RLS on: the service role (used by Edge Functions) can always bypass RLS;
-- authenticated users should never read or write this table directly.
ALTER TABLE reminder_log ENABLE ROW LEVEL SECURITY;
-- No explicit policies → only service_role / postgres can access.


-- ── 5. Idempotency: apply-twice guard ─────────────────────────────────────────
-- (All statements above are OR REPLACE / IF NOT EXISTS, so re-running is safe.)

-- Manual repair note for CNR-synced timeline entries
-- ─────────────────────────────────────────────────
-- The previous backfill marked ALL entries with no entry_type as 'private'.
-- CNR-synced entries also had no entry_type, so they became private and
-- disappeared from the client portal.
--
-- To restore them run:
--   SELECT id, diary_id, content, entry_date
--   FROM   diary_timeline_entries
--   WHERE  entry_type = 'private'
--     AND  created_by IN (SELECT lawyer_id FROM diaries WHERE cnr_number IS NOT NULL)
--     AND  content LIKE '% — before %';   -- pattern used by the sync functions
--
-- Review the output, then for each verified id:
--   UPDATE diary_timeline_entries
--   SET    entry_type = 'order'
--   WHERE  id = '<verified-id>';
--
-- Do NOT do a bulk UPDATE by pattern alone — a lawyer's own private note
-- could coincidentally match "% — before %".

