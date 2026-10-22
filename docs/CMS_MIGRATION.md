# CMS Migration — How to Apply

> **Status: NOTHING has been applied to the live project yet.** The live
> Supabase database currently has **no tables at all**. Everything below is
> a forward-looking runbook.

## Files (apply strictly in this order)

| # | File | Purpose |
|---|------|---------|
| 1 | `supabase/schema.sql` | Base schema: profiles, user data, legacy shared content, community tables, RLS |
| 2 | `supabase/migrations/20261019_phase4_security_hardening.sql` | Phase 4 security fixes |
| 3 | `supabase/migrations/20261020_cms_content_and_roles.sql` | CMS content tables, role expansion (`super_admin`/`editor`/`contributor`), revision history, audit log |

## How to apply safely

### Option A — Supabase SQL editor (current workflow)

1. Supabase Dashboard → **SQL Editor**.
2. Paste and run `supabase/schema.sql` (skip if the tables already exist).
3. Paste and run `20261019_phase4_security_hardening.sql`.
4. Paste and run `20261020_cms_content_and_roles.sql`.
5. Each file is idempotent (`if not exists`, `drop policy if exists`,
   `drop constraint if exists`), so a failed/partial run can simply be
   re-run.

### Option B — Supabase CLI (once the project is linked)

```bash
supabase link --project-ref <project-ref>
supabase db push
```

The CLI applies `schema.sql`-equivalent state plus the migration files in
filename order.

## Verification queries

```sql
-- All public tables exist (expect 20+ incl. devotionals, hymns,
-- content_revisions, audit_log):
select table_name from information_schema.tables
 where table_schema = 'public' order by table_name;

-- Policies on a content table (expect select_published, select_contributor,
-- insert_contributor, update_contributor, delete_admin):
select policyname, roles, cmd from pg_policies
 where schemaname = 'public' and tablename = 'devotionals';

-- Role constraint includes the new tier:
select conname, pg_get_constraintdef(oid)
  from pg_constraint
 where conrelid = 'public.profiles'::regclass and conname = 'profiles_role_check';

-- Backfill worked:
select count(*) from public.library_items where published_at is null;  -- expect 0
```

## What breaks if applied out of order

- **This migration before `schema.sql`** → fails immediately (depends on
  `public.profiles`, `public.is_admin()`, `library_items`, `prayer_alerts`,
  `news_items`).
- **This migration before the phase 4 file** → succeeds technically, but
  the phase 4 fixes for `community_comments` RLS and the rate-limit trigger
  would then overwrite nothing here (they touch different objects); still,
  always keep the documented order to avoid drift.
- **Re-running any file** → safe; all statements are idempotent.

## Notes

- `prayer_alerts.status` is intentionally left unchanged: its existing
  values (`active`/`answered`/`archived`) are prayer state, not publication
  state. Publication is tracked via `published_at` on that table.
- Contributors can edit drafts but **cannot** set `status = 'published'`;
  only editors/admins/super_admins can publish (enforced by RLS `with check`).
- Revision snapshots are written server-side by the `cms_touch_content()`
  trigger; the client never writes `content_revisions` directly (the insert
  policy exists only for admin tooling).
