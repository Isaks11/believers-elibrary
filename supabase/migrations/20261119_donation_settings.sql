-- Donation settings (single-row config editable by admins, readable by signed-in users)
-- Stores account details and giving purpose shown in the Donate modal.

create table if not exists public.donation_settings (
  id text primary key default 'default',
  enabled boolean not null default true,
  title text not null default 'Support the Ministry',
  description text not null default 'Your giving helps support ministry outreach, discipleship resources, and the ongoing development of this app.',
  account_name text,
  bank_name text,
  account_number text,
  currency text,
  additional_info text,
  updated_by uuid references auth.users (id),
  updated_at timestamptz not null default now(),
  constraint donation_settings_singleton check (id = 'default')
);

insert into public.donation_settings (id)
values ('default')
on conflict (id) do nothing;

alter table public.donation_settings enable row level security;

drop policy if exists donation_settings_read_authenticated on public.donation_settings;
create policy donation_settings_read_authenticated on public.donation_settings
  for select to authenticated
  using (true);

drop policy if exists donation_settings_write_admin on public.donation_settings;
create policy donation_settings_write_admin on public.donation_settings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());