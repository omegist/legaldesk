-- =============================================================================
-- VakilDesk — Verified Bug Fixes
-- Timestamp: 20261012010000
-- =============================================================================
-- Run this AFTER all previous migrations.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 1: block_profile_takeover trigger blocks accept_invite / remove_member
--
-- Root cause: SECURITY DEFINER runs the function as its owner (postgres/service
-- role), but current_setting('role') inside a SECURITY DEFINER function still
-- returns 'authenticated' when called from the JWT context, so the check fired
-- for the SECURITY DEFINER RPCs too.
--
-- Fix: remove SECURITY DEFINER from the trigger (it doesn't need it), and gate
-- only on the Supabase JWT roles that real client requests use.
-- ─────────────────────────────────────────────────────────────────────────────
set search_path = public;

create or replace function public.block_profile_takeover()
returns trigger language plpgsql
-- No SECURITY DEFINER — run as the calling role so current_user is accurate
as $$
begin
  -- Only block when an ordinary client (authenticated / anon) tries a direct
  -- UPDATE. Internal SECURITY DEFINER functions (accept_invite, remove_member,
  -- webhook via service_role) all run as a higher role and are NOT blocked.
  if (new.firm_id             is distinct from old.firm_id
   or new.subscription_tier   is distinct from old.subscription_tier
   or new.role                is distinct from old.role)
     and current_user in ('authenticated', 'anon')
  then
    raise exception 'Direct updates to firm_id, subscription_tier and role are not allowed';
  end if;
  return new;
end;
$$;

-- Re-attach (drop first to avoid duplicate trigger on re-run)
drop trigger if exists trg_block_profile_takeover on public.profiles;
create trigger trg_block_profile_takeover
  before update on public.profiles
  for each row execute function public.block_profile_takeover();

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 2: accept_invite() — match against JWT email, not profiles.email
--
-- Root cause: profiles.email is user-editable; an attacker could change it to
-- match any pending invite and join a firm they were never invited to.
--
-- Fix:
--   a) Compare lower(auth.jwt() ->> 'email') — the verified email in the token.
--   b) Require the owner's tier to be 'chambers' or 'firm' (no free-tier firms).
--   c) Lock the owner row FOR UPDATE before the member count check to prevent
--      two simultaneous accepts from both passing the 2-member cap.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.accept_invite(invite_id uuid)
returns void language plpgsql security definer
set search_path = public
as $$
declare
  v_invite  public.firm_invites%rowtype;
  v_owner   public.profiles%rowtype;
  v_member_count int;
  v_jwt_email    text;
begin
  -- Use the verified email from the JWT, not the editable profiles.email
  v_jwt_email := lower(auth.jwt() ->> 'email');
  if v_jwt_email is null then
    raise exception 'No verified email in token';
  end if;

  select * into v_invite
  from public.firm_invites
  where id         = invite_id
    and lower(email) = v_jwt_email
    and status     = 'pending';

  if not found then
    raise exception 'Invite not found or already used';
  end if;

  -- Lock the owner row to serialise concurrent accepts for the same firm
  select * into v_owner
  from public.profiles
  where id = v_invite.firm_id
  for update;

  -- Require owner to actually be on a paid multi-user plan
  if v_owner.subscription_tier not in ('chambers', 'firm') then
    raise exception 'Firm owner does not have a paid multi-user plan';
  end if;

  -- Enforce per-plan member cap (owner counts as 1, so cap = max_members - 1)
  select count(*) into v_member_count
  from public.profiles
  where firm_id = v_invite.firm_id
    and id <> v_invite.firm_id;

  if v_owner.subscription_tier = 'chambers' and v_member_count >= 2 then
    raise exception 'Chambers plan is limited to 2 additional members';
  end if;

  update public.firm_invites set status = 'accepted' where id = invite_id;
  update public.profiles     set firm_id = v_invite.firm_id where id = auth.uid();
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 3: remove_member() — re-apply search_path (good hygiene)
-- (Logic was correct; just add search_path so it survives schema changes)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.remove_member(member_id uuid)
returns void language plpgsql security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = member_id and firm_id = auth.uid()
  ) then
    raise exception 'Not authorised to remove this member';
  end if;

  update public.profiles set firm_id = null where id = member_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 4: Private notes leak into client portal
--
-- The migration 20261011000001 defaulted entry_type to 'order', so every
-- manually typed note was visible in the portal.
--
-- Fix:
--   a) Backfill: any row where created_by is not null (i.e. human-typed) and
--      entry_type = 'order' becomes 'private'. CNR-synced entries have
--      content starting with known prefixes — keep those as 'order'.
--   b) Change the column default to 'private' so future manual inserts
--      are private by default.
--   c) Re-create get_portal_case with set search_path and ORDER BY before LIMIT.
-- ─────────────────────────────────────────────────────────────────────────────

-- Backfill: entries typed by a human (created_by not null, not auto-synced)
-- Auto-synced entries from sync-case-from-cnr always contain 'Hearing on' or
-- 'Next date:' — everything else is a lawyer note and should be private.
update public.diary_timeline_entries
set entry_type = 'private'
where entry_type = 'order'
  and created_by is not null
  and content not ilike 'Hearing on%'
  and content not ilike 'Next date:%'
  and content not ilike 'Stage:%'
  and content not ilike 'Purpose:%';

-- Change default so future manual inserts are private
alter table public.diary_timeline_entries
  alter column entry_type set default 'private';

-- Re-create get_portal_case with search_path + ORDER BY before LIMIT
create or replace function public.get_portal_case(p_token text)
returns json language plpgsql security definer
set search_path = public
as $$
declare
  v_token   public.client_portal_tokens%rowtype;
  v_diary   record;
  v_profile record;
  v_timeline json;
begin
  select * into v_token
  from public.client_portal_tokens
  where token      = p_token
    and is_active  = true
    and (expires_at is null or expires_at > now());

  if not found then return null; end if;

  select party_names, case_type, case_number, court_name, status,
         matter_date, hearing_time, stage_of_case, purpose_of_hearing
  into v_diary
  from public.diaries
  where id = v_token.diary_id;

  if not found then return null; end if;

  select name, phone into v_profile
  from public.profiles where id = v_token.lawyer_id;

  -- ORDER BY inside the sub-query, THEN limit 30
  select json_agg(t) into v_timeline
  from (
    select id, entry_date, content
    from public.diary_timeline_entries
    where diary_id   = v_token.diary_id
      and entry_type <> 'private'
    order by entry_date desc
    limit 30
  ) t;

  return json_build_object(
    'party_names',        v_diary.party_names,
    'case_type',          v_diary.case_type,
    'case_number',        v_diary.case_number,
    'court_name',         v_diary.court_name,
    'status',             v_diary.status,
    'matter_date',        v_diary.matter_date,
    'hearing_time',       v_diary.hearing_time,
    'stage_of_case',      v_diary.stage_of_case,
    'purpose_of_hearing', v_diary.purpose_of_hearing,
    'lawyer_name',        coalesce(v_profile.name, 'Your Advocate'),
    'lawyer_phone',       v_profile.phone,
    'timeline',           coalesce(v_timeline, '[]'::json)
  );
end;
$$;

grant execute on function public.get_portal_case(text) to anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 5: Invoice numbers can collide — move assignment into a BEFORE INSERT
--        trigger so the lock and the insert are in the same transaction.
--
-- Also:
--   a) The old generate_invoice_number() function had no auth check — anyone
--      could call it with another lawyer's UUID. Replace it with a trigger so
--      it is never callable directly.
--   b) Safely add the unique constraint only if it doesn't already exist.
--   c) Drop the old advisory-lock function (replaced by trigger).
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop old exposed function (was callable by any authenticated user)
drop function if exists public.generate_invoice_number(uuid);

-- BEFORE INSERT trigger — runs inside the same transaction as the INSERT,
-- so the lock is held until the row is actually written.
create or replace function public.assign_invoice_number()
returns trigger language plpgsql security definer
set search_path = public
as $$
declare
  next_num integer;
begin
  -- Advisory lock scoped to this lawyer for the duration of the transaction
  perform pg_advisory_xact_lock(hashtext(new.lawyer_id::text || '_invoice'));

  select coalesce(
    max(cast(substring(invoice_number from 5) as integer)), 0
  ) + 1
  into next_num
  from public.invoices
  where lawyer_id = new.lawyer_id;

  new.invoice_number := 'INV-' || lpad(next_num::text, 4, '0');
  return new;
end;
$$;

-- Only fire when invoice_number is not already set (allows explicit overrides)
drop trigger if exists trg_assign_invoice_number on public.invoices;
create trigger trg_assign_invoice_number
  before insert on public.invoices
  for each row
  when (new.invoice_number is null or new.invoice_number = '')
  execute function public.assign_invoice_number();

-- Safely add unique constraint (skip if it already exists from old migration)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'invoices_lawyer_number_unique'
      and conrelid = 'public.invoices'::regclass
  ) then
    alter table public.invoices
      add constraint invoices_lawyer_number_unique unique (lawyer_id, invoice_number);
  end if;
end $$;

