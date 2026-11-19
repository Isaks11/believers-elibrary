-- Daily verses managed by admins (single entries and bulk upload)
-- Used by the app to display the Daily Verse (with fallback to devotional-derived verse).

create table if not exists public.daily_verses (
  id uuid primary key default gen_random_uuid(),
  verse_ref text not null,
  verse_text text not null,
  verse_date date,
  is_active boolean not null default true,
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists daily_verses_date_idx on public.daily_verses (verse_date desc nulls last);
create index if not exists daily_verses_active_idx on public.daily_verses (is_active);

alter table public.daily_verses enable row level security;

drop policy if exists daily_verses_read_authenticated on public.daily_verses;
create policy daily_verses_read_authenticated on public.daily_verses
  for select to authenticated
  using (true);

drop policy if exists daily_verses_write_admin on public.daily_verses;
create policy daily_verses_write_admin on public.daily_verses
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
