-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Block client-side writes to sensitive profile fields
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.block_profile_takeover()
returns trigger language plpgsql security definer as $$
begin
  -- Only the service role (webhooks) may change these columns
  if (new.firm_id is distinct from old.firm_id
      or new.subscription_tier is distinct from old.subscription_tier
      or new.role is distinct from old.role)
     and current_setting('role') <> 'service_role'
  then
    raise exception 'Direct updates to firm_id, subscription_tier and role are not allowed';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_block_profile_takeover on public.profiles;
create trigger trg_block_profile_takeover
  before update on public.profiles
  for each row execute function public.block_profile_takeover();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. accept_invite() — security definer so it can set firm_id safely
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.accept_invite(invite_id uuid)
returns void language plpgsql security definer as $$
declare
  v_invite public.firm_invites%rowtype;
  v_member_count int;
  v_tier text;
begin
  select * into v_invite
  from public.firm_invites
  where id = invite_id
    and email = (select email from public.profiles where id = auth.uid())
    and status = 'pending';

  if not found then
    raise exception 'Invite not found or already used';
  end if;

  -- Enforce Chambers 3-user cap at DB level
  select subscription_tier into v_tier
  from public.profiles where id = v_invite.firm_id;

  if v_tier = 'chambers' then
    select count(*) into v_member_count
    from public.profiles
    where firm_id = v_invite.firm_id and id <> v_invite.firm_id;

    if v_member_count >= 2 then
      raise exception 'Chambers plan is limited to 2 members';
    end if;
  end if;

  update public.firm_invites set status = 'accepted' where id = invite_id;
  update public.profiles set firm_id = v_invite.firm_id where id = auth.uid();
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. remove_member() — security definer so it can clear firm_id safely
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.remove_member(member_id uuid)
returns void language plpgsql security definer as $$
begin
  -- Only the firm owner may remove members
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
-- 4. get_portal_case() — safe read-only RPC for client portal (no private data)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.get_portal_case(p_token text)
returns json language plpgsql security definer as $$
declare
  v_token public.client_portal_tokens%rowtype;
  v_diary record;
  v_profile record;
  v_timeline json;
begin
  select * into v_token
  from public.client_portal_tokens
  where token = p_token
    and is_active = true
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

  select json_agg(t order by t.entry_date desc) into v_timeline
  from (
    select id, entry_date, content
    from public.diary_timeline_entries
    where diary_id = v_token.diary_id
      and entry_type <> 'private'
    limit 30
  ) t;

  return json_build_object(
    'party_names',         v_diary.party_names,
    'case_type',           v_diary.case_type,
    'case_number',         v_diary.case_number,
    'court_name',          v_diary.court_name,
    'status',              v_diary.status,
    'matter_date',         v_diary.matter_date,
    'hearing_time',        v_diary.hearing_time,
    'stage_of_case',       v_diary.stage_of_case,
    'purpose_of_hearing',  v_diary.purpose_of_hearing,
    'lawyer_name',         coalesce(v_profile.name, 'Your Advocate'),
    'lawyer_phone',        v_profile.phone,
    'timeline',            coalesce(v_timeline, '[]'::json)
  );
end;
$$;

-- Public anon can call this RPC (token is the secret)
grant execute on function public.get_portal_case(text) to anon;

-- Drop the overly-broad public read policy on tokens
drop policy if exists "Public can read active tokens" on public.client_portal_tokens;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Add expires_at to client_portal_tokens (default 90 days)
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.client_portal_tokens
  add column if not exists expires_at timestamptz
    default (now() + interval '90 days');

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Invoices: members see own, owner sees all, nobody edits another member's
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists "Firm members access invoices" on public.invoices;

create policy "invoices_select"
  on public.invoices for select
  using (
    lawyer_id = auth.uid()
    or (
      -- firm owner sees all firm invoices
      exists (
        select 1 from public.profiles p
        where p.id = invoices.lawyer_id
          and p.firm_id = auth.uid()
      )
    )
  );

create policy "invoices_insert"
  on public.invoices for insert
  with check (lawyer_id = auth.uid());

create policy "invoices_update"
  on public.invoices for update
  using (lawyer_id = auth.uid())
  with check (lawyer_id = auth.uid());

create policy "invoices_delete"
  on public.invoices for delete
  using (lawyer_id = auth.uid());
