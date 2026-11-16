-- Smart eCourtsIndia sync: keep the expensive full import to one call per CNR
-- per firm, and use refresh endpoints for every later check.

alter table public.profiles
  add column if not exists auto_sync_enabled boolean not null default false;

alter table public.subscriptions
  add column if not exists auto_sync_enabled boolean not null default false;

alter table public.diaries
  add column if not exists case_status text not null default 'ACTIVE',
  add column if not exists next_hearing_date date,
  add column if not exists last_synced_at timestamptz,
  add column if not exists is_initial_imported boolean not null default false;

alter table public.diaries
  drop constraint if exists diaries_case_status_check;
alter table public.diaries
  add constraint diaries_case_status_check check (case_status in ('ACTIVE', 'DISPOSED'));

-- Preserve existing records while moving the sync source of truth to the new columns.
update public.profiles
set auto_sync_enabled = subscription_tier in ('pro', 'chambers', 'firm');

update public.profiles member
set auto_sync_enabled = true
from public.profiles owner
where member.firm_id = owner.id
  and owner.subscription_tier in ('chambers', 'firm');

update public.subscriptions
set auto_sync_enabled = tier in ('pro', 'chambers', 'firm')
  and status in ('active', 'authenticated');

update public.diaries
set case_status = case when status = 'disposed' then 'DISPOSED' else 'ACTIVE' end,
    next_hearing_date = matter_date,
    last_synced_at = cnr_last_synced_at,
    is_initial_imported = case
      when cnr_number is not null and cnr_last_synced_at is not null then true
      else is_initial_imported
    end;

create index if not exists diaries_cnr_number_idx
  on public.diaries (cnr_number) where cnr_number is not null;
create index if not exists diaries_auto_sync_candidates_idx
  on public.diaries (case_status, next_hearing_date)
  where cnr_number is not null and is_initial_imported = true;
create index if not exists profiles_auto_sync_enabled_idx
  on public.profiles (id) where auto_sync_enabled = true;

-- This is the authoritative filter for the 7:30 PM IST job. Keeping it in SQL
-- prevents a future Edge Function edit from accidentally refreshing paid or
-- future-hearing cases.
create or replace function public.get_auto_sync_candidate_cases(p_today date)
returns table (
  id uuid,
  cnr_number text,
  lawyer_id uuid,
  next_hearing_date date,
  case_status text
)
language sql security definer set search_path = public as $$
  select d.id, d.cnr_number, d.lawyer_id, d.next_hearing_date, d.case_status
  from public.diaries d
  join public.profiles p on p.id = d.lawyer_id
  where p.auto_sync_enabled = true
    and d.cnr_number is not null
    and d.is_initial_imported = true
    and d.case_status = 'ACTIVE'
    and (d.next_hearing_date is null or d.next_hearing_date <= p_today);
$$;

-- Keep the old application fields in step while clients are rolled out.
create or replace function public.sync_ecourts_case_columns()
returns trigger language plpgsql as $$
begin
  if new.case_status = 'DISPOSED' then new.status := 'disposed';
  elsif new.status = 'disposed' then new.case_status := 'DISPOSED';
  else new.case_status := 'ACTIVE';
  end if;

  if new.next_hearing_date is not null then new.matter_date := new.next_hearing_date; end if;
  if new.last_synced_at is not null then new.cnr_last_synced_at := new.last_synced_at; end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_ecourts_case_columns on public.diaries;
create trigger trg_sync_ecourts_case_columns
  before insert or update on public.diaries
  for each row execute function public.sync_ecourts_case_columns();

-- Subscription state is the only authority that can enable auto-sync.
create or replace function public.block_profile_takeover()
returns trigger language plpgsql as $$
begin
  if (new.firm_id is distinct from old.firm_id
   or new.subscription_tier is distinct from old.subscription_tier
   or new.role is distinct from old.role
   or new.auto_sync_enabled is distinct from old.auto_sync_enabled)
     and current_user in ('authenticated', 'anon')
  then
    raise exception 'Direct updates to profile access fields are not allowed';
  end if;
  return new;
end;
$$;

-- Daily 7:30 PM IST equals 14:00 UTC. Configure these Vault secrets once:
--   ecourts_sync_function_url = https://<project-ref>.supabase.co/functions/v1/auto-sync-cnr-cases
--   ecourts_sync_cron_secret = same value as the CRON_SECRET Edge Function secret
-- The scheduler invokes only the bulk-refresh function; it never fetches orders.
create or replace function public.invoke_daily_ecourts_auto_sync()
returns void language plpgsql security definer set search_path = public, vault, extensions as $$
declare
  function_url text;
  cron_secret text;
begin
  select decrypted_secret into function_url from vault.decrypted_secrets where name = 'ecourts_sync_function_url';
  select decrypted_secret into cron_secret from vault.decrypted_secrets where name = 'ecourts_sync_cron_secret';
  if function_url is null or cron_secret is null then
    raise exception 'eCourts cron Vault secrets are not configured';
  end if;
  perform net.http_post(
    url := function_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', cron_secret),
    body := '{}'::jsonb
  );
end;
$$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'vakildesk-daily-ecourts-auto-sync') then
      perform cron.unschedule((select jobid from cron.job where jobname = 'vakildesk-daily-ecourts-auto-sync'));
    end if;
    perform cron.schedule(
      'vakildesk-daily-ecourts-auto-sync',
      '0 14 * * *',
      'select public.invoke_daily_ecourts_auto_sync()'
    );
  end if;
end $$;
