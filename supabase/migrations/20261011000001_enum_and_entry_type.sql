-- Add 'chambers' to the subscription_tier enum
-- Postgres requires this to be done outside a transaction for enum alterations
alter type public.subscription_tier add value if not exists 'chambers';

-- Add entry_type to diary_timeline_entries (used by get_portal_case to filter private notes)
alter table public.diary_timeline_entries
  add column if not exists entry_type text not null default 'order'
    check (entry_type in ('order', 'note', 'private'));
