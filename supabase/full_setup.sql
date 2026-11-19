-- ============================================================================
-- Believers e-Library — Full Supabase setup (consolidated)
-- ============================================================================
-- Run this entire script in the Supabase SQL Editor for your project:
--   Dashboard → SQL Editor → New query → paste → Run
--
-- What this includes (in required order):
--   1) supabase/schema.sql
--   2) supabase/migrations/20261019_phase4_security_hardening.sql
--   3) supabase/migrations/20261020_cms_content_and_roles.sql
--   4) supabase/migrations/20261110_admin_user_management.sql
--
-- Notes:
-- - Designed for a Supabase project (uses auth.users/auth.uid(), RLS, etc.).
-- - Intended to be applied in this order. Most statements are idempotent
--   (IF NOT EXISTS / DROP IF EXISTS / CREATE OR REPLACE), but applying on a
--   fresh project is recommended.
-- - After running: sign in with your admin account, then bootstrap the first
--   super_admin role in SQL if needed, for example:
--     update public.profiles set role = 'super_admin' where email = 'you@example.com';
-- - For cloud "Add user" in Admin, deploy the Edge Function:
--     supabase functions deploy admin-users
--   (requires SUPABASE_SERVICE_ROLE_KEY available to functions).
-- - Do NOT commit real service role keys. Configure VITE_SUPABASE_URL and
--   VITE_SUPABASE_ANON_KEY in Vercel/hosting environment variables for builds.
-- ============================================================================
-- --------------------------------------------------------------------------
-- 1) supabase/schema.sql
-- --------------------------------------------------------------------------
-- Believers e-Library — Supabase schema (Phase 1)
-- Run this in the Supabase SQL editor (or via `supabase db push`).
-- Security model: frontend guards are UX only; Row Level Security below is
-- the real enforcement of ownership and admin authorization.

create extension if not exists "pgcrypto";

-- =========================================================================
-- 1. Profiles & roles
-- =========================================================================

create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  name       text,
  role       text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Helper: is the current user an admin? (security definer avoids RLS recursion)
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- Defense-in-depth trigger: prevent non-admins from escalating their own role
create or replace function public.prevent_profile_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Unauthorized: Users cannot modify their own authorization role.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_prevent_profile_role_escalation on public.profiles;
create trigger trg_prevent_profile_role_escalation
  before update on public.profiles
  for each row execute function public.prevent_profile_role_escalation();

-- Auto-create a profile whenever an auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, ''), '@', 1)),
    'user'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================================
-- 2. User-owned data (strictly isolated per authenticated user)
-- =========================================================================

create table if not exists public.journal_entries (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  title         text not null check (char_length(title) between 1 and 300),
  body          text not null check (char_length(body) between 1 and 20000),
  type          text not null default 'Prayer'
                check (type in ('Prayer', 'Gratitude', 'Dream', 'Notes')),
  scripture_ref text,
  devotional_id text,
  is_private    boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists journal_entries_user_idx on public.journal_entries (user_id, updated_at desc);

create table if not exists public.prayer_requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  title         text not null check (char_length(title) between 1 and 300),
  body          text,
  category      text not null default 'Personal',
  scripture_ref text,
  status        text not null default 'ongoing' check (status in ('ongoing', 'answered')),
  answered_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists prayer_requests_user_idx on public.prayer_requests (user_id, updated_at desc);

create table if not exists public.bookmarks (
  user_id    uuid not null references auth.users (id) on delete cascade,
  item_type  text not null check (item_type in ('library', 'news', 'devotional', 'hymn', 'bible')),
  item_id    text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, item_type, item_id)
);

create table if not exists public.devotional_progress (
  user_id       uuid not null references auth.users (id) on delete cascade,
  devotional_id text not null,
  entry_date    date not null,
  completed_at  timestamptz not null default now(),
  primary key (user_id, devotional_id)
);
create index if not exists devotional_progress_date_idx on public.devotional_progress (user_id, entry_date desc);

create table if not exists public.mood_logs (
  user_id    uuid not null references auth.users (id) on delete cascade,
  log_date   date not null,
  mood       text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, log_date)
);

-- Per-user reading progress, plans, highlights, verse notes, and spiritual goals
create table if not exists public.user_preferences (
  user_id             uuid primary key references auth.users (id) on delete cascade,
  reading_plans_json  jsonb not null default '{}'::jsonb,
  spiritual_goals     jsonb not null default '{}'::jsonb,
  library_progress    jsonb not null default '{}'::jsonb,
  bible_history       jsonb not null default '[]'::jsonb,
  bible_highlights    jsonb not null default '{}'::jsonb,
  bible_notes         jsonb not null default '{}'::jsonb,
  reminder_prefs      jsonb not null default '{}'::jsonb,
  bible_bookmarks     jsonb not null default '{}'::jsonb,
  updated_at          timestamptz not null default now()
);

-- Per-user interaction with shared prayer alerts (the alert itself is admin-managed).
create table if not exists public.prayer_interactions (
  user_id          uuid not null references auth.users (id) on delete cascade,
  alert_id         text not null,
  prayed_at        timestamptz not null default now(),
  reminder_enabled boolean not null default false,
  primary key (user_id, alert_id)
);

-- =========================================================================
-- 3. Shared content (admin-managed, readable by all signed-in users)
-- =========================================================================

create table if not exists public.library_items (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  author          text not null,
  publisher       text,
  license         text,
  type            text not null check (type in ('book', 'audio', 'video', 'material')),
  category        text not null default 'General',
  description     text,
  content_url     text,
  approval_status text not null default 'approved' check (approval_status in ('pending', 'approved', 'rejected')),
  featured        boolean not null default false,
  created_by      uuid references auth.users (id),
  created_at      timestamptz not null default now()
);

create table if not exists public.prayer_alerts (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text not null,
  urgency      text not null default 'community' check (urgency in ('critical', 'daily', 'community')),
  status       text not null default 'active' check (status in ('active', 'answered', 'archived')),
  submitted_by text,
  created_by   uuid references auth.users (id),
  created_at   timestamptz not null default now()
);

create table if not exists public.news_items (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  excerpt      text,
  content      text not null,
  category     text not null default 'church',
  author       text,
  read_time    int not null default 1,
  publish_date date not null default current_date,
  created_by   uuid references auth.users (id),
  created_at   timestamptz not null default now()
);

-- =========================================================================
-- 4. Row Level Security — Core & Personal Tables
-- =========================================================================

alter table public.profiles             enable row level security;
alter table public.journal_entries      enable row level security;
alter table public.prayer_requests      enable row level security;
alter table public.bookmarks            enable row level security;
alter table public.devotional_progress  enable row level security;
alter table public.mood_logs            enable row level security;
alter table public.user_preferences     enable row level security;
alter table public.prayer_interactions  enable row level security;
alter table public.library_items        enable row level security;
alter table public.prayer_alerts        enable row level security;
alter table public.news_items           enable row level security;

-- profiles: own row always; admins see everyone; users cannot insert/escalate role.
drop policy if exists profiles_select_own      on public.profiles;
drop policy if exists profiles_select_admin    on public.profiles;
drop policy if exists profiles_insert_own      on public.profiles;
drop policy if exists profiles_update_own      on public.profiles;
drop policy if exists profiles_update_admin    on public.profiles;
drop policy if exists profiles_delete_admin    on public.profiles;

create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());
create policy profiles_select_admin on public.profiles
  for select to authenticated using (public.is_admin());
create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (id = auth.uid() and role = 'user');
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select p.role from public.profiles p where p.id = auth.uid()));
create policy profiles_update_admin on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());
create policy profiles_delete_admin on public.profiles
  for delete to authenticated using (public.is_admin());

-- user-owned tables: full CRUD strictly for the authenticated owner (even admins cannot read private journals/prayers).
do $$
declare t text;
begin
  foreach t in array array[
    'journal_entries', 'prayer_requests', 'bookmarks',
    'devotional_progress', 'mood_logs', 'user_preferences', 'prayer_interactions'
  ] loop
    execute format('drop policy if exists %I_owner_all on public.%I', t, t);
    execute format(
      'create policy %I_owner_all on public.%I for all to authenticated
       using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t, t
    );
  end loop;
end $$;

-- shared content: any signed-in user reads; only admins write.
do $$
declare t text;
begin
  foreach t in array array['library_items', 'prayer_alerts', 'news_items'] loop
    execute format('drop policy if exists %I_read_authenticated on public.%I', t, t);
    execute format(
      'create policy %I_read_authenticated on public.%I
       for select to authenticated using (true)',
      t, t
    );
    execute format('drop policy if exists %I_write_admin on public.%I', t, t);
    execute format(
      'create policy %I_write_admin on public.%I
       for all to authenticated using (public.is_admin()) with check (public.is_admin())',
      t, t
    );
  end loop;
end $$;

-- =========================================================================
-- 5. Phase 3 & 4: Community Fellowship, Group Membership & Safeguarding RLS
-- =========================================================================

create table if not exists public.community_group_members (
  user_id    uuid not null references auth.users (id) on delete cascade,
  group_id   int not null,
  group_name text not null,
  joined_at  timestamptz not null default now(),
  primary key (user_id, group_name)
);

create table if not exists public.community_posts (
  id                uuid primary key default gen_random_uuid(),
  author_id         uuid not null references auth.users (id) on delete cascade,
  author_name       text not null,
  is_anonymous      boolean not null default false,
  group_name        text not null,
  category          text not null default 'testimony'
                    check (category in ('testimony', 'scripture_reflection', 'prayer_request', 'question')),
  privacy_scope     text not null default 'community_public'
                    check (privacy_scope in ('group_only', 'community_public')),
  scripture_ref     text,
  body              text not null check (char_length(body) between 3 and 2000),
  moderation_status text not null default 'active'
                    check (moderation_status in ('active', 'flagged', 'removed')),
  created_at        timestamptz not null default now()
);

create table if not exists public.community_comments (
  id                uuid primary key default gen_random_uuid(),
  post_id           uuid not null references public.community_posts (id) on delete cascade,
  author_id         uuid not null references auth.users (id) on delete cascade,
  author_name       text not null,
  body              text not null check (char_length(body) between 2 and 1000),
  moderation_status text not null default 'active'
                    check (moderation_status in ('active', 'flagged', 'removed')),
  created_at        timestamptz not null default now()
);

create table if not exists public.community_reports (
  id          uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('post', 'comment')),
  target_id   text not null,
  post_id     text not null,
  reason      text not null check (reason in ('harassment', 'false_teaching_spam', 'privacy_violation', 'scam_solicitation', 'other')),
  details     text,
  status      text not null default 'pending' check (status in ('pending', 'resolved_removed', 'resolved_dismissed')),
  reported_by uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table if not exists public.user_blocks (
  blocker_id  uuid not null references auth.users (id) on delete cascade,
  blocked_ref text not null,
  created_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_ref)
);

alter table public.community_group_members enable row level security;
alter table public.community_posts         enable row level security;
alter table public.community_comments      enable row level security;
alter table public.community_reports       enable row level security;
alter table public.user_blocks             enable row level security;

-- Only the known fellowship groups may be joined (blocks junk/renamed group names).
alter table public.community_group_members
  drop constraint if exists community_group_members_known_group;
alter table public.community_group_members
  add constraint community_group_members_known_group check (
    group_name in (
      'Morning Prayer Warriors', 'Youth Bible Study',
      'Mothers of Faith', 'Men of Valor Fellowship'
    )
  );

-- Server-side rate limit for community posts/comments (client limit is UX only).
create or replace function public.enforce_community_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  window_seconds int;
  max_items      int;
  recent         int;
begin
  if new.author_id is distinct from auth.uid() then
    return new; -- admin/system backfills are not rate limited here
  end if;

  if tg_table_name = 'community_comments' then
    window_seconds := 30; max_items := 6;
    select count(*) into recent
    from public.community_comments c
    where c.author_id = auth.uid()
      and c.created_at > now() - make_interval(secs => window_seconds);
  else
    window_seconds := 30; max_items := 3;
    select count(*) into recent
    from public.community_posts p
    where p.author_id = auth.uid()
      and p.created_at > now() - make_interval(secs => window_seconds);
  end if;

  if recent >= max_items then
    raise exception 'Rate limit exceeded: please wait a moment before posting again.';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_community_rate_limit() from public;
grant execute on function public.enforce_community_rate_limit() to authenticated;

drop trigger if exists trg_community_posts_rate_limit on public.community_posts;
create trigger trg_community_posts_rate_limit
  before insert on public.community_posts
  for each row execute function public.enforce_community_rate_limit();

drop trigger if exists trg_community_comments_rate_limit on public.community_comments;
create trigger trg_community_comments_rate_limit
  before insert on public.community_comments
  for each row execute function public.enforce_community_rate_limit();

-- Helper: is the current user a member of a fellowship group?
create or replace function public.is_group_member(target_group text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.community_group_members
    where user_id = auth.uid() and group_name = target_group
  );
$$;

revoke all on function public.is_group_member(text) from public;
grant execute on function public.is_group_member(text) to authenticated;

-- Group membership: users manage their own group memberships
drop policy if exists community_group_members_owner_all on public.community_group_members;
create policy community_group_members_owner_all on public.community_group_members
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Posts: authenticated users read non-removed items IF public OR they belong to the group OR are author/admin.
drop policy if exists community_posts_select on public.community_posts;
create policy community_posts_select on public.community_posts
  for select to authenticated
  using (
    public.is_admin()
    or (
      moderation_status <> 'removed'
      and (
        privacy_scope = 'community_public'
        or author_id = auth.uid()
        or public.is_group_member(group_name)
      )
    )
  );

drop policy if exists community_posts_insert on public.community_posts;
create policy community_posts_insert on public.community_posts
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and moderation_status = 'active'
    -- group_only posts may only target a group the user actually joined;
    -- community_public posts are open to any signed-in user.
    and (
      privacy_scope = 'community_public'
      or public.is_group_member(group_name)
    )
  );

-- Authors may edit their own active post text, but CANNOT un-remove or un-flag a moderated post.
drop policy if exists community_posts_update_author on public.community_posts;
create policy community_posts_update_author on public.community_posts
  for update to authenticated
  using (author_id = auth.uid() and moderation_status = 'active')
  with check (author_id = auth.uid() and moderation_status = 'active');

-- Only admins can change moderation_status on any post.
drop policy if exists community_posts_moderate_admin on public.community_posts;
create policy community_posts_moderate_admin on public.community_posts
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists community_posts_delete_author_or_admin on public.community_posts;
create policy community_posts_delete_author_or_admin on public.community_posts
  for delete to authenticated
  using (author_id = auth.uid() or public.is_admin());

-- Comments: visible only if the parent post is visible to the requester.
drop policy if exists community_comments_select on public.community_comments;
create policy community_comments_select on public.community_comments
  for select to authenticated
  using (
    public.is_admin()
    or (
      moderation_status <> 'removed'
      and exists (
        select 1 from public.community_posts p
        where p.id = post_id
          and (
            p.moderation_status <> 'removed'
            and (
              p.privacy_scope = 'community_public'
              or p.author_id = auth.uid()
              or public.is_group_member(p.group_name)
            )
          )
      )
    )
  );

drop policy if exists community_comments_insert on public.community_comments;
create policy community_comments_insert on public.community_comments
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and moderation_status = 'active'
    -- No commenting on posts the user cannot see (private/group posts).
    and exists (
      select 1 from public.community_posts p
      where p.id = post_id
        and p.moderation_status <> 'removed'
        and (
          p.privacy_scope = 'community_public'
          or p.author_id = auth.uid()
          or public.is_group_member(p.group_name)
        )
    )
  );

drop policy if exists community_comments_update_author on public.community_comments;
create policy community_comments_update_author on public.community_comments
  for update to authenticated
  using (author_id = auth.uid() and moderation_status = 'active')
  with check (author_id = auth.uid() and moderation_status = 'active');

drop policy if exists community_comments_moderate_admin on public.community_comments;
create policy community_comments_moderate_admin on public.community_comments
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Reports: any authenticated user can file a report; only admins can view and resolve the moderation queue.
drop policy if exists community_reports_insert on public.community_reports;
create policy community_reports_insert on public.community_reports
  for insert to authenticated
  with check (reported_by = auth.uid() and status = 'pending');

drop policy if exists community_reports_admin_all on public.community_reports;
create policy community_reports_admin_all on public.community_reports
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- User blocks: strictly private to the blocker.
drop policy if exists user_blocks_owner_all on public.user_blocks;
create policy user_blocks_owner_all on public.user_blocks
  for all to authenticated
  using (blocker_id = auth.uid())
  with check (blocker_id = auth.uid());

-- Self-service GDPR/account data purge for the currently authenticated user
create or replace function public.delete_own_user_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  delete from public.journal_entries where user_id = auth.uid();
  delete from public.prayer_requests where user_id = auth.uid();
  delete from public.bookmarks where user_id = auth.uid();
  delete from public.devotional_progress where user_id = auth.uid();
  delete from public.mood_logs where user_id = auth.uid();
  delete from public.user_preferences where user_id = auth.uid();
  delete from public.prayer_interactions where user_id = auth.uid();
  delete from public.community_group_members where user_id = auth.uid();
  delete from public.user_blocks where blocker_id = auth.uid();
  delete from public.community_comments where author_id = auth.uid();
  delete from public.community_reports where reported_by = auth.uid();
  delete from public.community_posts where author_id = auth.uid();
  delete from public.profiles where id = auth.uid();
end;
$$;

revoke all on function public.delete_own_user_data() from public;
grant execute on function public.delete_own_user_data() to authenticated;




-- --------------------------------------------------------------------------
-- 2) supabase/migrations/20261019_phase4_security_hardening.sql
-- --------------------------------------------------------------------------
-- Believers e-Library — Phase 4 security hardening migration
-- Apply AFTER supabase/schema.sql (idempotent; safe to re-run).
--
-- Covers the Phase 4 security audit findings that the original schema did not:
--   1. comments select/insert ignored parent-post privacy (group_only posts leaked)
--   2. post insert did not require group membership for group_only posts
--   3. delete_own_user_data() omitted community_comments and community_reports
--   4. user_preferences lacked reminder_prefs / bible_bookmarks columns the app syncs
--   5. no server-side rate limit on community posts/comments (client limit is UX only)
--   6. group membership rows accepted unknown group names
--
-- Status: NOT YET APPLIED to the live project — see docs/PHASE4_COMPLETION_REPORT.md.

-- -------------------------------------------------------------------------
-- 1. New user_preferences columns synced by src/lib/securityAndSync.ts
-- -------------------------------------------------------------------------
alter table public.user_preferences
  add column if not exists reminder_prefs  jsonb not null default '{}'::jsonb;
alter table public.user_preferences
  add column if not exists bible_bookmarks jsonb not null default '{}'::jsonb;

-- -------------------------------------------------------------------------
-- 2. Community group membership: only the known fellowship groups
-- -------------------------------------------------------------------------
alter table public.community_group_members
  drop constraint if exists community_group_members_known_group;
alter table public.community_group_members
  add constraint community_group_members_known_group check (
    group_name in (
      'Morning Prayer Warriors', 'Youth Bible Study',
      'Mothers of Faith', 'Men of Valor Fellowship'
    )
  );

-- -------------------------------------------------------------------------
-- 3. Server-side rate limit on community posts/comments
--    (the client-side cooldown in communityData.ts is UX only)
-- -------------------------------------------------------------------------
create or replace function public.enforce_community_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  window_seconds int;
  max_items      int;
  recent         int;
begin
  if new.author_id is distinct from auth.uid() then
    return new; -- admin/system backfills are not rate limited here
  end if;

  if tg_table_name = 'community_comments' then
    window_seconds := 30; max_items := 6;
    select count(*) into recent
    from public.community_comments c
    where c.author_id = auth.uid()
      and c.created_at > now() - make_interval(secs => window_seconds);
  else
    window_seconds := 30; max_items := 3;
    select count(*) into recent
    from public.community_posts p
    where p.author_id = auth.uid()
      and p.created_at > now() - make_interval(secs => window_seconds);
  end if;

  if recent >= max_items then
    raise exception 'Rate limit exceeded: please wait a moment before posting again.';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_community_rate_limit() from public;
grant execute on function public.enforce_community_rate_limit() to authenticated;

drop trigger if exists trg_community_posts_rate_limit on public.community_posts;
create trigger trg_community_posts_rate_limit
  before insert on public.community_posts
  for each row execute function public.enforce_community_rate_limit();

drop trigger if exists trg_community_comments_rate_limit on public.community_comments;
create trigger trg_community_comments_rate_limit
  before insert on public.community_comments
  for each row execute function public.enforce_community_rate_limit();

-- -------------------------------------------------------------------------
-- 4. Posts: group_only inserts require actual group membership
-- -------------------------------------------------------------------------
drop policy if exists community_posts_insert on public.community_posts;
create policy community_posts_insert on public.community_posts
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and moderation_status = 'active'
    and (
      privacy_scope = 'community_public'
      or public.is_group_member(group_name)
    )
  );

-- -------------------------------------------------------------------------
-- 5. Comments: select/insert are gated on parent-post visibility
--    (fixes group_only/private post leakage through comments)
-- -------------------------------------------------------------------------
drop policy if exists community_comments_select on public.community_comments;
create policy community_comments_select on public.community_comments
  for select to authenticated
  using (
    public.is_admin()
    or (
      moderation_status <> 'removed'
      and exists (
        select 1 from public.community_posts p
        where p.id = post_id
          and (
            p.moderation_status <> 'removed'
            and (
              p.privacy_scope = 'community_public'
              or p.author_id = auth.uid()
              or public.is_group_member(p.group_name)
            )
          )
      )
    )
  );

drop policy if exists community_comments_insert on public.community_comments;
create policy community_comments_insert on public.community_comments
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and moderation_status = 'active'
    and exists (
      select 1 from public.community_posts p
      where p.id = post_id
        and p.moderation_status <> 'removed'
        and (
          p.privacy_scope = 'community_public'
          or p.author_id = auth.uid()
          or public.is_group_member(p.group_name)
        )
    )
  );

-- -------------------------------------------------------------------------
-- 6. Account purge covers community comments and reports
-- -------------------------------------------------------------------------
create or replace function public.delete_own_user_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  delete from public.journal_entries where user_id = auth.uid();
  delete from public.prayer_requests where user_id = auth.uid();
  delete from public.bookmarks where user_id = auth.uid();
  delete from public.devotional_progress where user_id = auth.uid();
  delete from public.mood_logs where user_id = auth.uid();
  delete from public.user_preferences where user_id = auth.uid();
  delete from public.prayer_interactions where user_id = auth.uid();
  delete from public.community_group_members where user_id = auth.uid();
  delete from public.user_blocks where blocker_id = auth.uid();
  delete from public.community_comments where author_id = auth.uid();
  delete from public.community_reports where reported_by = auth.uid();
  delete from public.community_posts where author_id = auth.uid();
  delete from public.profiles where id = auth.uid();
end;
$$;

revoke all on function public.delete_own_user_data() from public;
grant execute on function public.delete_own_user_data() to authenticated;


-- --------------------------------------------------------------------------
-- 3) supabase/migrations/20261020_cms_content_and_roles.sql
-- --------------------------------------------------------------------------
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


-- --------------------------------------------------------------------------
-- 4) supabase/migrations/20261110_admin_user_management.sql
-- --------------------------------------------------------------------------
-- Believers e-Library — Admin user management & content fixes
-- Filename: 20261110_admin_user_management.sql
--
-- Apply AFTER (in order):
--   1. supabase/schema.sql
--   2. supabase/migrations/20261019_phase4_security_hardening.sql
--   3. supabase/migrations/20261020_cms_content_and_roles.sql
--
-- This migration:
--   A. Lets the `admin-users` Edge Function (service role) set the role of a
--      newly created auth user. `prevent_profile_role_escalation()` previously
--      blocked EVERY role change unless the caller passed `is_admin()`, and the
--      service role has no auth.uid() — so server-side user creation could
--      never assign anything but the default 'user'.
--   B. Hardens the trigger with super_admin protections:
--        - only a super_admin (or the service role) may touch a super_admin row;
--        - only a super_admin (or the service role) may grant super_admin.
--   C. Widens `faith_resources.resource_type` so the CMS editor's values
--      (study_guide / commentary / dictionary / article / podcast / other)
--      stop being rejected by Postgres while the UI showed success.
--
-- Everything stays idempotent (drop-if-exists / create-or-replace).

-- =========================================================================
-- A + B. Role escalation guard: service-role bypass + super_admin rules
-- =========================================================================

create or replace function public.prevent_profile_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- The service role (Edge Function with SUPABASE_SERVICE_ROLE_KEY) applies
  -- roles for newly created users. Privileged SQL editor/DBA sessions
  -- (postgres/supabase_admin) must also be able to bootstrap and repair roles.
  -- Endpoint/DBA controls remain the gate.
  if auth.role() = 'service_role' or current_user in ('postgres', 'supabase_admin') then
    new.updated_at := now();
    return new;
  end if;

  -- Ordinary sessions may only change roles at all when they are an admin.
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Unauthorized: Users cannot modify their own authorization role.';
  end if;

  if new.role is distinct from old.role then
    -- super_admin accounts can only be managed by another super_admin.
    if old.role = 'super_admin' and not public.has_role(array['super_admin']) then
      raise exception 'Unauthorized: Only a super_admin can manage a super_admin account.';
    end if;
    -- super_admin can only be granted by another super_admin.
    if new.role = 'super_admin' and not public.has_role(array['super_admin']) then
      raise exception 'Unauthorized: Only a super_admin can grant the super_admin role.';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.prevent_profile_role_escalation() from public;

-- =========================================================================
-- C. faith_resources.resource_type — accept the CMS editor's values
-- =========================================================================

alter table public.faith_resources
  drop constraint if exists faith_resources_resource_type_check;

alter table public.faith_resources
  add constraint faith_resources_resource_type_check
  check (
    resource_type is null
    or resource_type in (
      'study_guide', 'study', 'commentary', 'dictionary',
      'article', 'podcast', 'video', 'audio', 'other'
    )
  );


-- --------------------------------------------------------------------------
-- 5) supabase/migrations/20261119_donation_settings.sql
-- --------------------------------------------------------------------------
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

-- --------------------------------------------------------------------------
-- 6) supabase/migrations/20261119_daily_verses.sql
-- --------------------------------------------------------------------------
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
