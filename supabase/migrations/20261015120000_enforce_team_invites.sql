-- Keep Chambers capacity and invitation ownership correct even when the
-- client UI is bypassed. Chambers permits three logins total: the owner and
-- two additional members.

create unique index if not exists firm_invites_one_pending_email_per_firm_idx
  on public.firm_invites (firm_id, lower(email))
  where status = 'pending';

create or replace function public.enforce_firm_invite_entitlement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner public.profiles%rowtype;
  v_member_count integer;
  v_pending_count integer;
  v_inviter_email text;
begin
  -- Client-originated writes may only create invitations for the caller's own
  -- firm. Service-role jobs are allowed to create an invitation after doing
  -- their own authorization check.
  if auth.uid() is not null
     and (new.firm_id <> auth.uid() or new.invited_by <> auth.uid()) then
    raise exception 'Only a firm owner can invite members';
  end if;

  select * into v_owner from public.profiles where id = new.firm_id for update;
  if not found or v_owner.subscription_tier not in ('chambers', 'firm') then
    raise exception 'A Chambers or Firm plan is required to invite members';
  end if;

  v_inviter_email := lower(auth.jwt() ->> 'email');
  if v_inviter_email is not null and lower(new.email) = v_inviter_email then
    raise exception 'You cannot invite your own email address';
  end if;

  if v_owner.subscription_tier = 'chambers' then
    select count(*) into v_member_count
    from public.profiles
    where firm_id = new.firm_id and id <> new.firm_id;

    -- Pending invitations reserve a seat so concurrent invitations cannot
    -- exceed the advertised two-member Chambers allowance.
    select count(*) into v_pending_count
    from public.firm_invites
    where firm_id = new.firm_id and status = 'pending';

    if v_member_count + v_pending_count >= 2 then
      raise exception 'Chambers plan is limited to 2 additional members';
    end if;
  end if;

  new.email := lower(trim(new.email));
  return new;
end;
$$;

drop trigger if exists trg_enforce_firm_invite_entitlement on public.firm_invites;
create trigger trg_enforce_firm_invite_entitlement
  before insert on public.firm_invites
  for each row execute function public.enforce_firm_invite_entitlement();
