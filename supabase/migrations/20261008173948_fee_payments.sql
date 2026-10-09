create table if not exists public.fee_payments (
  id uuid primary key default gen_random_uuid(),
  diary_id uuid not null references public.diaries(id) on delete cascade,
  lawyer_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  payment_type text not null default 'general',
  payment_date date not null default current_date,
  mode text not null default 'cash',
  note text,
  created_at timestamptz not null default now()
);

alter table public.fee_payments enable row level security;

create policy "Lawyer manages own fee payments"
  on public.fee_payments
  for all
  using (lawyer_id = auth.uid())
  with check (lawyer_id = auth.uid());

create index fee_payments_diary_id_idx on public.fee_payments(diary_id);
create index fee_payments_lawyer_id_idx on public.fee_payments(lawyer_id);
