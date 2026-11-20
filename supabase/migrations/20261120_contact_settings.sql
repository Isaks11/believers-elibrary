-- Admin-editable Contact Us details displayed to users.
create table if not exists public.contact_settings (
  id              text primary key default 'default',
  title           text not null default 'Contact Us',
  description     text not null default 'Reach out to our ministry team for prayer, support, or inquiries.',
  email           text not null default '',
  phone           text not null default '',
  address         text not null default '',
  website         text not null default '',
  office_hours    text not null default '',
  additional_info text not null default '',
  updated_at      timestamptz not null default now()
);

alter table public.contact_settings enable row level security;

drop policy if exists "Anyone can read contact settings" on public.contact_settings;
create policy "Anyone can read contact settings"
  on public.contact_settings
  for select
  using (true);

drop policy if exists "Admins can manage contact settings" on public.contact_settings;
create policy "Admins can manage contact settings"
  on public.contact_settings
  for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'super_admin')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'super_admin')
    )
  );
