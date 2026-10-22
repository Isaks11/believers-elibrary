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
