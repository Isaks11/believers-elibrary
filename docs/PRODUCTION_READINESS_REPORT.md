# Production Readiness Report — Believers e-Library

**Date:** 2026-11-10  
**Scope:** CMS persistence, Admin Users & Roles, backend/config hardening, and production readiness.

## Executive summary

The application’s CMS and admin flows were architected for **Supabase (Postgres + Auth + RLS)**, but the configured backend was not usable and several write paths were “best effort” in a way that hid failures. As a result, uploads appeared to save locally while never reaching the database.

This pass implements **cloud-aware, honest persistence** (device-first writes with explicit cloud/queued/local feedback and a retry outbox), adds **backend health diagnostics** in Admin, redesigns **Users & Roles** with create/assign capabilities, adds the required **server-side user-management function/migration**, and fixes environment/build defaults. **Actual cloud persistence still requires a valid Supabase project, applied schema/migrations, and deployed edge function secrets** (see “Required setup”).

## Root causes identified

| Area | Finding | Impact |
|---|---|---|
| Backend URL | `.env` pointed to `https://qzncebzmxfvpwnuqhgwy.supabase.co`, which does not resolve (DNS NXDOMAIN). | All Supabase reads/writes failed; app fell back to `localStorage` silently. |
| Schema | `docs/CMS_MIGRATION.md` / `docs/DEPLOYMENT.md` indicate the CMS tables/migrations were not applied to the live project. | Even with a valid URL, inserts would fail with missing relations/policies. |
| Environment overrides | `.env.production` and `.env.staging` set `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` to empty strings. | Production/staging builds could be forced into local-only mode regardless of intent. |
| Write semantics | CMS mutations were local-first and **fire-and-forget** to Supabase; failures were recorded but not surfaced per action. | Admins saw “saved” while the database never received the row. |
| Sessions & RLS | Demo/guest sessions are device-local (no Supabase session). Supabase RLS requires an authenticated, authorized profile role. | Writes from local/demo sessions cannot satisfy server policies by design. |
| Schema mismatch | `devotionals.devotional_date` is `NOT NULL` on the server but drafts could send null; `faith_resources.resource_type` DB check did not include editor values like `study_guide/podcast/other`. | Cloud inserts rejected after local save appeared successful. |
| Role escalation guard | `prevent_profile_role_escalation()` blocked role changes unless `is_admin()` (no service-role bypass). | Server-side user creation/role assignment via service role was blocked. |
| Users & Roles UI | Cloud mode was read-only (“roles are server-managed”) with no create flow and no clear diagnostics. | Admins could not create users or assign roles from the app. |

## Changes implemented

### 1) Cloud-aware CMS persistence & diagnostics
- **`src/lib/backendHealth.ts`**: probes Supabase reachability and CMS schema; returns actionable states (`local`, `unreachable`, `schema_missing`, `connected`) with friendly error mapping (never exposes secrets).
- **`src/lib/cmsOutbox.ts`**: durable retry queue for failed cloud writes (deduped by record, flushed on load/online/recheck). Prevents silent loss when the backend is temporarily unavailable.
- **`src/lib/contentAdmin.ts`** (refactor): mutations are **async** and report `storage: 'cloud' | 'local' | 'queued'` with user-facing warnings; local write remains first (no data loss), cloud write is awaited and queued on failure; `devotional_date` defaults/validates to avoid NOT NULL violations; revision client-inserts are skipped for server-backed types (DB trigger owns them); `listContent` merges pending/local-session rows so queued or device-local content does not “disappear”.
- **CMS UI call sites** (`ContentTypeManager`, `ContentEditorDialog`, `RevisionHistoryDialog`, `BulkDevotionalDialog`, `BulkHymnDialog`): await mutations and show **honest feedback** (“saved to database” vs “saved on this device / queued for retry”) via `storageFeedback`.
- **`src/pages/Admin.tsx`**: backend health banner with status, detail, queued/unsynced counts, and **Recheck & sync** action; flushes outbox on load.

### 2) Users & Roles (professional redesign + create/assign)
- **`src/components/admin/UserRolePanel.tsx`**: redesigned with stats, search/filter, role legend, loading/error/empty states, and clear cloud vs device-local modes.
  - **Device-local mode (demo/guest/no server session):** manage the browser registry, create local accounts, assign roles with escalation rules, audited (`role_change` / create / delete).
  - **Cloud mode (real Supabase session):** list profiles from Postgres, create users and assign roles through the secure server path, with server-verified escalation and audited actions.
- **`src/lib/adminUsers.ts`**: client API for listing profiles and invoking the `admin-users` function (with RLS-guarded fallbacks where safe).
- **`supabase/functions/admin-users/index.ts`** (Edge Function): verifies caller JWT + admin role, then performs privileged operations with the service-role key (`list`, `create`, `set_role`, `delete`) enforcing escalation rules.
- **`supabase/migrations/20261110_admin_user_management.sql`**:
  - Allows `service_role` through `prevent_profile_role_escalation()` so the Edge Function can set initial roles, while hardening super-admin protections (only super_admin/service_role may grant or modify super_admin).
  - Widens `faith_resources.resource_type` CHECK to accept editor values (`study_guide`, `podcast`, `other`, etc.).

### 3) Configuration, security, and metadata
- **`.env`**: cleared invalid/NXDOMAIN Supabase values (placeholders) so the app reports a clear local-mode state until configured.
- **`.env.production` / `.env.staging`**: removed empty Supabase URL/key overrides so build/deploy-time environment variables can be supplied correctly; demo admin explicitly disabled.
- **`src/contexts/AuthContext.tsx`**: demo admin defaults to **development-only** unless explicitly enabled; production requires explicit opt-in (and should remain disabled).
- **`vercel.json`**: SPA rewrite retained; added baseline security headers (`X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`) and service-worker cache headers.
- **`package.json`**: renamed to `believers-elibrary`, version bumped.

### 4) Tests
- Source-level tests updated where signatures/structure legitimately changed (async CMS mutations, bulk create). Existing contracts preserved where required (permission strings, `UserRolePanel`/`AuditLogView` markers, local-first write ordering patterns).

## Required setup (to make uploads persist to Supabase)

1. **Create/select a Supabase project** and copy **Project URL** and **anon/public key** (Project Settings → API).
2. **Configure environment** (local `.env`, and CI/hosting env vars for staging/production):
   - `VITE_SUPABASE_URL=https://<project-ref>.supabase.co`
   - `VITE_SUPABASE_ANON_KEY=<anon-or-publishable-key>`
   - `VITE_ADMIN_EMAILS=<bootstrap-admin@example.com>` (optional bootstrap)
3. **Apply database schema/migrations in order** (SQL Editor or `supabase db push`):
   1. `supabase/schema.sql`
   2. `supabase/migrations/20261019_phase4_security_hardening.sql`
   3. `supabase/migrations/20261020_cms_content_and_roles.sql`
   4. `supabase/migrations/20261110_admin_user_management.sql`
4. **Deploy the admin function** (for cloud user creation & server-verified role ops):
   - `supabase functions deploy admin-users`
   - Ensure the project provides `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to functions (standard in Supabase).
5. **Create/bootstrap an admin profile**:
   - Sign up/sign in with the intended admin email, then set `profiles.role` to `admin` or `super_admin` in SQL (or via Users & Roles once an admin session exists), e.g.  
     `update public.profiles set role = 'super_admin' where email = 'you@example.com';`
6. **Verify in Admin**: the health banner should show **Cloud CMS connected** for a signed-in Supabase admin; create/edit/publish a record and confirm the toast reports “saved to the database”.

## Operational notes & limitations

- **Demo/local sessions cannot write to Supabase.** RLS requires an authenticated Supabase user with an authorized profile role. The UI now reports this explicitly and queues/keeps a device copy instead of claiming success.
- **Edge Function required for cloud “Add user”.** Without it, role assignment may still work via RLS-guarded updates, but creating auth users cannot (needs service role).
- **Offline/queued writes** are stored in the browser outbox and retried on reconnect/recheck; they are per-device until flushed successfully.
- **Frontend checks are UX only.** PostgreSQL RLS, triggers, and the Edge Function are the security boundary—never rely on client-side role checks for enforcement.
- **Secrets:** never commit real keys; use hosting/CI environment variables for staging/production. The anon/publishable key is public-by-design but must correspond to a real, RLS-protected project.

## Recommended next steps

- Run `npm run typecheck`, the full test suite (`npm test`, `test:cms`, `test:admincms`, `test:contentwiring`, `test:notifications`, `test:devotionals_cms` as applicable), and `npm run build` in CI before deploy.
- Add runtime/integration tests (with a Supabase test project or mocks) for RLS and cloud mutation flows—current tests are largely source-level assertions.
- Configure production monitoring/error reporting (e.g. `VITE_ERROR_WEBHOOK_URL`) and review CSP needs for your exact media/CDN domains.
- Rotate any previously exposed/invalid credentials if they belonged to a real project, and ensure demo admin remains disabled in all deployed environments.
