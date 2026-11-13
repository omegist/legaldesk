-- Add firm logo URL to profiles for firm branding
alter table public.profiles add column if not exists firm_logo_url text;

-- ─────────────────────────────────────────────
-- Centralized billing: firm owner can see all invoices raised by firm members
-- ─────────────────────────────────────────────
drop policy if exists "Lawyers manage own invoices" on public.invoices;

create policy "Firm members access invoices"
  on public.invoices for all
  using (
    lawyer_id = auth.uid()
    or (
      -- firm owner sees all invoices raised by their members
      exists (
        select 1 from public.profiles p
        where p.id = invoices.lawyer_id
          and p.firm_id is not null
          and p.firm_id = (select firm_id from public.profiles where id = auth.uid())
      )
    )
  )
  with check (
    lawyer_id = auth.uid()
  );
