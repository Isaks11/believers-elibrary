-- Monthly aggregated visitor & user visit counters (no PII stored).
create table if not exists public.site_visit_monthly (
  year              integer not null,
  month             integer not null check (month >= 1 and month <= 12),
  visitor_count     integer not null default 0,
  user_visit_count  integer not null default 0,
  updated_at        timestamptz not null default now(),
  primary key (year, month)
);

alter table public.site_visit_monthly enable row level security;

drop policy if exists "Analytics viewers can read monthly visits" on public.site_visit_monthly;
create policy "Analytics viewers can read monthly visits"
  on public.site_visit_monthly
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('editor', 'admin', 'super_admin')
    )
  );

create or replace function public.record_site_visit(p_is_authenticated boolean default false)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year integer := extract(year from now())::integer;
  v_month integer := extract(month from now())::integer;
begin
  insert into public.site_visit_monthly (year, month, visitor_count, user_visit_count, updated_at)
  values (
    v_year,
    v_month,
    1,
    case when p_is_authenticated then 1 else 0 end,
    now()
  )
  on conflict (year, month) do update
  set
    visitor_count = public.site_visit_monthly.visitor_count + 1,
    user_visit_count = public.site_visit_monthly.user_visit_count + (case when p_is_authenticated then 1 else 0 end),
    updated_at = now();
end;
$$;

grant execute on function public.record_site_visit(boolean) to anon, authenticated;
