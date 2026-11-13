-- ─────────────────────────────────────────────
-- Chambers / Firm multi-user support
-- ─────────────────────────────────────────────

-- 1. firm_invites: owner sends invite → member accepts → firm_id set on profile
create table if not exists public.firm_invites (
  id          uuid primary key default gen_random_uuid(),
  firm_id     uuid not null references public.profiles(id) on delete cascade,
  invited_by  uuid not null references public.profiles(id) on delete cascade,
  email       text not null,
  status      text not null default 'pending' check (status in ('pending','accepted','revoked')),
  created_at  timestamptz not null default now()
);

alter table public.firm_invites enable row level security;

-- Owner can manage their own firm's invites
create policy "Owner manages firm invites"
  on public.firm_invites for all
  using (invited_by = auth.uid())
  with check (invited_by = auth.uid());

-- Invitee can read their own invite (to accept it)
create policy "Invitee reads own invite"
  on public.firm_invites for select
  using (email = (select email from public.profiles where id = auth.uid()));

create index firm_invites_firm_id_idx on public.firm_invites(firm_id);
create index firm_invites_email_idx   on public.firm_invites(email);

-- ─────────────────────────────────────────────
-- 2. diaries: firm members can read/write cases that share their firm_id
-- ─────────────────────────────────────────────
-- Drop the old single-lawyer policy and replace with firm-aware one
drop policy if exists "Lawyers manage own diaries" on public.diaries;

create policy "Firm members access shared diaries"
  on public.diaries for all
  using (
    lawyer_id = auth.uid()
    or (
      firm_id is not null
      and firm_id = (select firm_id from public.profiles where id = auth.uid())
    )
  )
  with check (
    lawyer_id = auth.uid()
    or (
      firm_id is not null
      and firm_id = (select firm_id from public.profiles where id = auth.uid())
    )
  );

-- ─────────────────────────────────────────────
-- 3. fee_payments: firm members can see all payments for cases in their firm
-- ─────────────────────────────────────────────
drop policy if exists "Lawyer manages own fee payments" on public.fee_payments;

create policy "Firm members access fee payments"
  on public.fee_payments for all
  using (
    lawyer_id = auth.uid()
    or exists (
      select 1 from public.diaries d
      where d.id = fee_payments.diary_id
        and d.firm_id is not null
        and d.firm_id = (select firm_id from public.profiles where id = auth.uid())
    )
  )
  with check (
    lawyer_id = auth.uid()
    or exists (
      select 1 from public.diaries d
      where d.id = fee_payments.diary_id
        and d.firm_id is not null
        and d.firm_id = (select firm_id from public.profiles where id = auth.uid())
    )
  );

-- ─────────────────────────────────────────────
-- 4. client_portal_tokens: firm members can manage tokens for shared cases
-- ─────────────────────────────────────────────
drop policy if exists "Lawyer manages own portal tokens" on public.client_portal_tokens;

create policy "Firm members manage portal tokens"
  on public.client_portal_tokens for all
  using (
    lawyer_id = auth.uid()
    or exists (
      select 1 from public.diaries d
      where d.id = client_portal_tokens.diary_id
        and d.firm_id is not null
        and d.firm_id = (select firm_id from public.profiles where id = auth.uid())
    )
  )
  with check (
    lawyer_id = auth.uid()
    or exists (
      select 1 from public.diaries d
      where d.id = client_portal_tokens.diary_id
        and d.firm_id is not null
        and d.firm_id = (select firm_id from public.profiles where id = auth.uid())
    )
  );
