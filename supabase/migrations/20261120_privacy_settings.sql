-- Admin-editable Privacy Terms shown to users during registration.
create table if not exists public.privacy_settings (
  id          text primary key default 'default',
  title       text not null default 'Privacy Policy & Terms',
  content     text not null,
  updated_at  timestamptz not null default now()
);

alter table public.privacy_settings enable row level security;

drop policy if exists "Anyone can read privacy settings" on public.privacy_settings;
create policy "Anyone can read privacy settings"
  on public.privacy_settings
  for select
  using (true);

drop policy if exists "Admins can manage privacy settings" on public.privacy_settings;
create policy "Admins can manage privacy settings"
  on public.privacy_settings
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
