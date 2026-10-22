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


