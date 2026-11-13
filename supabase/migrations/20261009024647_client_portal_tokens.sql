create table if not exists public.client_portal_tokens (
  id uuid primary key default gen_random_uuid(),
  token uuid not null unique default gen_random_uuid(),
  diary_id uuid not null references public.diaries(id) on delete cascade,
  lawyer_id uuid not null references public.profiles(id) on delete cascade,
  is_active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.client_portal_tokens enable row level security;

-- Lawyer can manage their own tokens
create policy "Lawyer manages own portal tokens"
  on public.client_portal_tokens
  for all
  using (lawyer_id = auth.uid())
  with check (lawyer_id = auth.uid());

-- Public read via token (used by the portal page — anon key)
create policy "Public can read active tokens"
  on public.client_portal_tokens
  for select
  using (is_active = true and (expires_at is null or expires_at > now()));

create index client_portal_tokens_token_idx on public.client_portal_tokens(token);
create index client_portal_tokens_diary_id_idx on public.client_portal_tokens(diary_id);
