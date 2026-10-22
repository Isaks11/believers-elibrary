-- Believers e-Library — CMS content model & role expansion migration
-- Filename: 20261020_cms_content_and_roles.sql
--   Versioned so it sorts AFTER 20261019_phase4_security_hardening.sql.
--
-- WARNING — READ BEFORE RUNNING
--   * NOTHING from supabase/migrations/ has been applied to the live project
--     yet. The live database currently has NO tables at all. The intended
--     order is:
--         1. supabase/schema.sql
--         2. supabase/migrations/20261019_phase4_security_hardening.sql
--         3. supabase/migrations/20261020_cms_content_and_roles.sql  (this file)
--   * Run it in the Supabase SQL editor (or via `supabase db push` once the
--     CLI project is linked). See docs/CMS_MIGRATION.md.
--   * Applying this BEFORE schema.sql WILL FAIL (it depends on
--     public.profiles, public.is_admin(), and the legacy content tables).
--
-- Idempotency: this file is safe to re-run. Tables use `create table if not
-- exists`, columns use `add column if not exists`, constraints are dropped
-- with `drop constraint if exists` first, and every policy is
-- `drop policy if exists` + `create policy`.
--
-- Revision design (choose ONE — this file chose the SERVER-SIDE design):
--   public.cms_touch_content() is a BEFORE UPDATE trigger that bumps
--   `version` and inserts a snapshot row into public.content_revisions.
--   The CLIENT does not write revisions. Backfills / bulk maintenance can
--   opt out with:
--       select set_config('beliemcms.skip_revisions', 'on', false);
--   which this migration itself uses during the legacy-table backfill.
--
-- Rollback strategy: a commented "DOWN" section at the very bottom of this
-- file. Uncomment it and run it manually to revert.

-- =========================================================================
-- 1. Roles: expand profiles.role from ('user','admin') to the CMS tier
--    ('super_admin','admin','editor','contributor','user').
--    Existing 'admin' rows remain valid under the new constraint; existing
--    'user' rows stay 'user'. Promote individuals to editor/contributor/
--    super_admin manually after applying.
-- =========================================================================

-- The column-level check in schema.sql was auto-named profiles_role_check.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('super_admin', 'admin', 'editor', 'contributor', 'user'));

-- Helper: does the current user hold ANY of the given roles?
-- (security definer avoids RLS recursion on public.profiles, same pattern
--  as is_admin() in schema.sql). auth.uid() null => no rows match => false,
--  so anon never satisfies a role gate.
create or replace function public.has_role(_roles text[])
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = any(_roles)
  );
$$;

revoke all on function public.has_role(text[]) from public;
grant execute on function public.has_role(text[]) to authenticated;

-- Update is_admin() so super_admins are still admins (signature unchanged;
-- create or replace keeps existing callers/policies working).
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('super_admin', 'admin')
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- =========================================================================
-- 2. Shared trigger helpers
--    NOTE: schema.sql has no generic updated_at trigger function (only
--    prevent_profile_role_escalation() stamps profiles.updated_at), so this
--    migration creates one for the new content tables.
-- =========================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public;
grant execute on function public.set_updated_at() to authenticated;

-- Bump version + record an immutable revision snapshot on every content
-- update. Opt out of the bump/snapshot with:
--   select set_config('beliemcms.skip_revisions', 'on', false);
create or replace function public.cms_touch_content()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('beliemcms.skip_revisions', true) = 'on' then
    return new;
  end if;

  -- First time a row reaches 'published': stamp published_at if unset.
  if new.status = 'published' and old.status is distinct from 'published'
     and new.published_at is null then
    new.published_at := now();
  end if;

  new.version := old.version + 1;
  -- stamp updated_at here too: this trigger fires BEFORE trg_<t>_set_updated_at
  -- (alphabetical firing order), so the snapshot would otherwise capture a
  -- stale value. now() is transaction-stable, so both stamps are identical.
  new.updated_at := now();

  insert into public.content_revisions (entity_type, entity_id, version, snapshot, edited_by)
  values (tg_table_name, new.id, new.version, to_jsonb(new), auth.uid());

  return new;
end;
$$;

revoke all on function public.cms_touch_content() from public;
grant execute on function public.cms_touch_content() to authenticated;

-- Contributors (and editors) may not re-parent content: only admins /
-- super_admins may change created_by on an existing row.
create or replace function public.cms_guard_created_by()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by is distinct from old.created_by and not public.is_admin() then
    raise exception 'Unauthorized: only admins can change created_by.';
  end if;
  return new;
end;
$$;

revoke all on function public.cms_guard_created_by() from public;
grant execute on function public.cms_guard_created_by() to authenticated;

-- =========================================================================
-- 3. CMS content tables
--    Shared publication columns on every table:
--      slug, status ('draft'|'published'|'archived'), published_at,
--      scheduled_for, version, category, tags[], author, license_attribution,
--      offline_policy ('online_only'|'optional'|'essential'), created_by
-- =========================================================================

create table if not exists public.devotionals (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null,
  body                text not null,
  verse_text          text,
  verse_ref           text,
  translation         text,
  devotional_date     date not null,
  slug                text not null,
  status              text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at        timestamptz,
  scheduled_for       timestamptz,
  version             integer not null default 1,
  category            text,
  tags                text[] not null default '{}',
  author              text,
  license_attribution text,
  offline_policy      text not null default 'online_only' check (offline_policy in ('online_only', 'optional', 'essential')),
  created_by          uuid references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint devotionals_slug_key unique (slug)
);
create index if not exists devotionals_status_published_idx on public.devotionals (status, published_at desc);
create index if not exists devotionals_devotional_date_idx  on public.devotionals (devotional_date desc);

create table if not exists public.reading_plans (
  id                       uuid primary key default gen_random_uuid(),
  title                    text not null,
  description              text,
  days                     integer,
  structure                jsonb not null default '[]'::jsonb,
  reading_duration_minutes integer,
  slug                     text not null,
  status                   text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at             timestamptz,
  scheduled_for            timestamptz,
  version                  integer not null default 1,
  category                 text,
  tags                     text[] not null default '{}',
  author                   text,
  license_attribution      text,
  offline_policy           text not null default 'online_only' check (offline_policy in ('online_only', 'optional', 'essential')),
  created_by               uuid references public.profiles (id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint reading_plans_slug_key unique (slug)
);
create index if not exists reading_plans_status_published_idx on public.reading_plans (status, published_at desc);

create table if not exists public.hymns (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null,
  number              integer,
  lyrics              text not null,
  audio_url           text,
  public_domain       boolean not null default true,
  hymn_category       text,
  meter               text,
  composer            text,
  slug                text not null,
  status              text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at        timestamptz,
  scheduled_for       timestamptz,
  version             integer not null default 1,
  category            text,
  tags                text[] not null default '{}',
  author              text,
  license_attribution text,
  offline_policy      text not null default 'online_only' check (offline_policy in ('online_only', 'optional', 'essential')),
  created_by          uuid references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint hymns_slug_key unique (slug)
);
create index if not exists hymns_status_published_idx on public.hymns (status, published_at desc);
create index if not exists hymns_number_idx          on public.hymns (number);

create table if not exists public.videos (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null,
  description         text,
  video_url           text not null,
  thumbnail_url       text,
  speaker             text,
  duration_seconds    integer,
  video_category      text,
  slug                text not null,
  status              text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at        timestamptz,
  scheduled_for       timestamptz,
  version             integer not null default 1,
  category            text,
  tags                text[] not null default '{}',
  author              text,
  license_attribution text,
  offline_policy      text not null default 'online_only' check (offline_policy in ('online_only', 'optional', 'essential')),
  created_by          uuid references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint videos_slug_key unique (slug)
);
create index if not exists videos_status_published_idx on public.videos (status, published_at desc);

create table if not exists public.faith_resources (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null,
  description         text,
  resource_url        text,
  resource_type       text check (resource_type is null or resource_type in ('study', 'commentary', 'dictionary', 'video', 'audio', 'article')),
  scripture_ref       text,
  curated_by          text,
  slug                text not null,
  status              text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at        timestamptz,
  scheduled_for       timestamptz,
  version             integer not null default 1,
  category            text,
  tags                text[] not null default '{}',
  author              text,
  license_attribution text,
  offline_policy      text not null default 'online_only' check (offline_policy in ('online_only', 'optional', 'essential')),
  created_by          uuid references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint faith_resources_slug_key unique (slug)
);
create index if not exists faith_resources_status_published_idx on public.faith_resources (status, published_at desc);

-- -------------------------------------------------------------------------
-- 3b. Revision history & audit trail
-- -------------------------------------------------------------------------

-- Immutable per-row revision snapshots written by cms_touch_content().
-- entity_type/entity_id are polymorphic (no FK); the unique constraint
-- keeps one snapshot per (table, row, version).
create table if not exists public.content_revisions (
  id          uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id   uuid not null,
  version     integer not null,
  snapshot    jsonb not null,
  edited_by   uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint content_revisions_entity_version_key unique (entity_type, entity_id, version)
);
create index if not exists content_revisions_entity_idx
  on public.content_revisions (entity_type, entity_id, version desc);

create table if not exists public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid,
  actor_role  text,
  action      text not null,
  entity_type text not null,
  entity_id   text,
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists audit_log_created_at_idx on public.audit_log (created_at desc);
create index if not exists audit_log_entity_idx     on public.audit_log (entity_type, entity_id);

-- =========================================================================
-- 4. Backfill legacy shared-content tables with the publication columns
--    they are missing. Inspected against schema.sql:
--      * library_items: has approval_status (pending/approved/rejected) but
--        no publication status -> gets the full shared set.
--      * prayer_alerts: ALREADY has a `status` column with different
--        semantics ('active'|'answered'|'archived' — user-facing prayer
--        state, NOT publication state). Adding a second status column or
--        changing its CHECK would break existing app queries, so `status`
--        is deliberately NOT added here. It gets the remaining columns.
--      * news_items: has publish_date (date) but no publication status
--        -> gets the full shared set.
--    The `default 'published'` backfills pre-existing (live seed) rows with
--    status='published' automatically; the UPDATE stamps published_at.
-- =========================================================================

alter table public.library_items
  add column if not exists status              text not null default 'published'
    check (status in ('draft', 'published', 'archived'));
alter table public.library_items
  add column if not exists published_at        timestamptz;
alter table public.library_items
  add column if not exists scheduled_for       timestamptz;
alter table public.library_items
  add column if not exists version             integer not null default 1;
alter table public.library_items
  add column if not exists license_attribution text;
alter table public.library_items
  add column if not exists offline_policy      text not null default 'online_only'
    check (offline_policy in ('online_only', 'optional', 'essential'));

alter table public.prayer_alerts
  add column if not exists published_at        timestamptz;
alter table public.prayer_alerts
  add column if not exists scheduled_for       timestamptz;
alter table public.prayer_alerts
  add column if not exists version             integer not null default 1;
alter table public.prayer_alerts
  add column if not exists license_attribution text;
alter table public.prayer_alerts
  add column if not exists offline_policy      text not null default 'online_only'
    check (offline_policy in ('online_only', 'optional', 'essential'));

alter table public.news_items
  add column if not exists status              text not null default 'published'
    check (status in ('draft', 'published', 'archived'));
alter table public.news_items
  add column if not exists published_at        timestamptz;
alter table public.news_items
  add column if not exists scheduled_for       timestamptz;
alter table public.news_items
  add column if not exists version             integer not null default 1;
alter table public.news_items
  add column if not exists license_attribution text;
alter table public.news_items
  add column if not exists offline_policy      text not null default 'online_only'
    check (offline_policy in ('online_only', 'optional', 'essential'));

-- Existing rows are live seeds: mark them published and stamped.
-- (skip_revisions guard is set for safety; the legacy tables intentionally
--  carry no cms_touch_content trigger, so it is a no-op here.)
do $$
begin
  perform set_config('beliemcms.skip_revisions', 'on', false);
  update public.library_items  set published_at = coalesce(published_at, now()) where published_at is null;
  update public.prayer_alerts  set published_at = coalesce(published_at, now()) where published_at is null;
  update public.news_items     set published_at = coalesce(published_at, now()) where published_at is null;
  perform set_config('beliemcms.skip_revisions', 'off', false);
end $$;

-- =========================================================================
-- 5. Row Level Security
--    Convention matches schema.sql: `drop policy if exists` + `create
--    policy`, `to authenticated` for everything except the public read of
--    published content (an explicit requirement here; schema.sql previously
--    gave anon no access at all). has_role()/is_admin() are EXECUTE-restricted
--    to authenticated, so anon policies must not call them — anon only ever
--    matches the plain "published and live" predicate, which makes drafts
--    unreachable via the API for anon and for ordinary users alike.
-- =========================================================================

alter table public.devotionals       enable row level security;
alter table public.reading_plans     enable row level security;
alter table public.hymns             enable row level security;
alter table public.videos            enable row level security;
alter table public.faith_resources   enable row level security;
alter table public.content_revisions enable row level security;
alter table public.audit_log         enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'devotionals', 'reading_plans', 'hymns', 'videos', 'faith_resources'
  ] loop
    -- SELECT: anon sees only live published rows.
    execute format('drop policy if exists %I_select_published on public.%I', t, t);
    execute format(
      'create policy %I_select_published on public.%I
         for select to anon
         using (status = ''published'' and published_at is not null and published_at <= now())',
      t, t
    );

    -- SELECT: contributors+ additionally see drafts/archived/scheduled.
    execute format('drop policy if exists %I_select_contributor on public.%I', t, t);
    execute format(
      'create policy %I_select_contributor on public.%I
         for select to authenticated
         using (
           (status = ''published'' and published_at is not null and published_at <= now())
           or public.has_role(array[''contributor'', ''editor'', ''admin'', ''super_admin''])
         )',
      t, t
    );

    -- INSERT: contributors+.
    execute format('drop policy if exists %I_insert_contributor on public.%I', t, t);
    execute format(
      'create policy %I_insert_contributor on public.%I
         for insert to authenticated
         with check (public.has_role(array[''contributor'', ''editor'', ''admin'', ''super_admin'']))',
      t, t
    );

    -- UPDATE: contributors+ may edit, but the NEW row must not be left
    -- published unless the actor is editor+ (contributors cannot publish).
    -- Changing created_by is separately blocked for non-admins by the
    -- cms_guard_created_by() trigger (policies cannot see the old row).
    execute format('drop policy if exists %I_update_contributor on public.%I', t, t);
    execute format(
      'create policy %I_update_contributor on public.%I
         for update to authenticated
         using (public.has_role(array[''contributor'', ''editor'', ''admin'', ''super_admin'']))
         with check (
           public.has_role(array[''contributor'', ''editor'', ''admin'', ''super_admin''])
           and (
             (status = ''published'') is not true
             or public.has_role(array[''editor'', ''admin'', ''super_admin''])
           )
         )',
      t, t
    );

    -- DELETE: admins and super_admins only.
    execute format('drop policy if exists %I_delete_admin on public.%I', t, t);
    execute format(
      'create policy %I_delete_admin on public.%I
         for delete to authenticated
         using (public.has_role(array[''admin'', ''super_admin'']))',
      t, t
    );
  end loop;
end $$;

-- content_revisions: contributors+ read and record; immutable by omission
-- (no UPDATE/DELETE policy exists, so RLS denies both for everyone).
drop policy if exists content_revisions_select_contributor on public.content_revisions;
create policy content_revisions_select_contributor on public.content_revisions
  for select to authenticated
  using (public.has_role(array['contributor', 'editor', 'admin', 'super_admin']));

drop policy if exists content_revisions_insert_contributor on public.content_revisions;
create policy content_revisions_insert_contributor on public.content_revisions
  for insert to authenticated
  with check (public.has_role(array['contributor', 'editor', 'admin', 'super_admin']));

-- audit_log: admins read the trail; any signed-in actor may append rows
-- about itself (actor_id must be null = system, or the current user).
-- Immutable by omission (no UPDATE/DELETE policy).
drop policy if exists audit_log_select_admin on public.audit_log;
create policy audit_log_select_admin on public.audit_log
  for select to authenticated
  using (public.has_role(array['admin', 'super_admin']));

drop policy if exists audit_log_insert_signed_in on public.audit_log;
create policy audit_log_insert_signed_in on public.audit_log
  for insert to authenticated
  with check (auth.uid() is not null and (actor_id is null or actor_id = auth.uid()));

-- =========================================================================
-- 6. Grants
--    NOTE: schema.sql relied on Supabase's default table grants and only
--    granted EXECUTE on functions; explicit table grants are added here for
--    clarity. DELETE is intentionally NOT granted on content tables —
--    Postgres checks table-level privileges BEFORE RLS, so only roles that
--    need to delete (admins via Supabase defaults / manual grants) can.
-- =========================================================================

grant select, insert, update
  on public.devotionals, public.reading_plans, public.hymns,
     public.videos, public.faith_resources
  to authenticated;

grant select
  on public.devotionals, public.reading_plans, public.hymns,
     public.videos, public.faith_resources
  to anon;

grant select, insert on public.content_revisions to authenticated;
grant select, insert on public.audit_log         to authenticated;

-- =========================================================================
-- 7. updated_at + revision triggers on the new content tables
--    (legacy tables have no updated_at column and keep their current
--     behaviour; their new publication columns need no triggers.)
-- =========================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'devotionals', 'reading_plans', 'hymns', 'videos', 'faith_resources'
  ] loop
    execute format('drop trigger if exists trg_%I_set_updated_at on public.%I', t, t);
    execute format(
      'create trigger trg_%I_set_updated_at
         before update on public.%I
         for each row execute function public.set_updated_at()',
      t, t
    );

    execute format('drop trigger if exists trg_%I_cms_touch_content on public.%I', t, t);
    execute format(
      'create trigger trg_%I_cms_touch_content
         before update on public.%I
         for each row execute function public.cms_touch_content()',
      t, t
    );

    execute format('drop trigger if exists trg_%I_cms_guard_created_by on public.%I', t, t);
    execute format(
      'create trigger trg_%I_cms_guard_created_by
         before update on public.%I
         for each row execute function public.cms_guard_created_by()',
      t, t
    );
  end loop;
end $$;

-- =========================================================================
-- DOWN — rollback (uncomment and run manually to revert this migration)
-- =========================================================================
-- drop table if exists public.audit_log;
-- drop table if exists public.content_revisions;
-- drop table if exists public.devotionals;
-- drop table if exists public.reading_plans;
-- drop table if exists public.hymns;
-- drop table if exists public.videos;
-- drop table if exists public.faith_resources;
-- drop function if exists public.cms_guard_created_by();
-- drop function if exists public.cms_touch_content();
-- drop function if exists public.set_updated_at();
-- drop function if exists public.has_role(text[]);
-- -- restore original role tier:
-- alter table public.profiles drop constraint if exists profiles_role_check;
-- alter table public.profiles
--   add constraint profiles_role_check check (role in ('user', 'admin'));
-- -- restore is_admin() without super_admin:
-- --   create or replace function public.is_admin() ... where id = auth.uid() and role = 'admin'; ...
-- -- drop the columns added to legacy tables (only if you also revert their data):
-- alter table public.library_items drop column if exists status;
-- alter table public.library_items drop column if exists published_at;
-- alter table public.library_items drop column if exists scheduled_for;
-- alter table public.library_items drop column if exists version;
-- alter table public.library_items drop column if exists license_attribution;
-- alter table public.library_items drop column if exists offline_policy;
-- alter table public.prayer_alerts drop column if exists published_at;
-- alter table public.prayer_alerts drop column if exists scheduled_for;
-- alter table public.prayer_alerts drop column if exists version;
-- alter table public.prayer_alerts drop column if exists license_attribution;
-- alter table public.prayer_alerts drop column if exists offline_policy;
-- alter table public.news_items drop column if exists status;
-- alter table public.news_items drop column if exists published_at;
-- alter table public.news_items drop column if exists scheduled_for;
-- alter table public.news_items drop column if exists version;
-- alter table public.news_items drop column if exists license_attribution;
-- alter table public.news_items drop column if exists offline_policy;
