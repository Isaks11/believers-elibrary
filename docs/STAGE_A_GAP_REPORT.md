# Stage A — Existing Implementation Audit & Gap Report

> Scope: Believers e-Library (React 19 + TypeScript + Vite + Tailwind v4 + Supabase JS v2).
> All findings are source-verified. "EXISTS" = implemented and wired; "PARTIAL" = present but
> incomplete; "MISSING" = not present anywhere in the repository.

## 1. Backend / Supabase

| Item | Status | Evidence |
|---|---|---|
| `supabase/schema.sql` (16 tables, 6 functions, 4 triggers, 32 RLS policies) | EXISTS | `supabase/schema.sql` |
| Phase 4 hardening migration | EXISTS | `supabase/migrations/20261019_phase4_security_hardening.sql` (header states **NOT YET APPLIED to the live project**) |
| Tables referenced in code vs schema | 16 / 16 — perfect match, no phantom tables | `docs/*`, code grep |
| **Schema applied to live Supabase project** | **MISSING** | `docs/BETA_ACCEPTANCE_CHECKLIST.md`, `docs/DEPLOYMENT.md`, `docs/PRIVACY_NOTICE.md` all state it has not been applied → the live DB currently has **no tables, no RLS, no functions**; the app runs in local-only mode |
| Supabase client + `isSupabaseConfigured` | EXISTS | `src/lib/supabase.ts` |
| Local `.env` (URL + anon key) | CONFIGURED | `.env` populated; `VITE_ADMIN_EMAILES` empty (no env admins) |
| Staging/production env | NOT CONFIGURED | `.env.staging` / `.env.production` have empty URL/key |
| Supabase CLI project (`config.toml`), Edge Functions | MISSING | `supabase/` contains only schema + 1 migration |
| Storage buckets, signed URLs, storage policies | MISSING | Zero `supabase.storage` usage; zero bucket DDL. "Upload" in E-Library is a URL text field. Images point at an external GCS bucket |
| RPC usage | `delete_own_user_data` only | `src/lib/securityAndSync.ts` |

## 2. Admin CMS

| Capability | Status | Notes |
|---|---|---|
| Admin area (`/admin`) with tabs (library, prayers, news, moderation) | EXISTS | `src/pages/Admin.tsx` (~606 lines) |
| Client route guard (`requireAdmin`) | EXISTS | `src/App.tsx:53-62`; server enforcement = RLS `is_admin()` |
| Dual-write (localStorage first, best-effort Supabase) | EXISTS | `recordWriteOutcome` in `src/lib/syncHealth.ts` |
| Create / delete / feature / approve | EXISTS | library items, prayer alerts, news |
| **Edit existing content** | MISSING | no edit forms for library items or news |
| **Drafts** | MISSING | user uploads go straight to `approvalStatus: 'pending'` |
| **Scheduled publication** | MISSING | — |
| **Archive/restore** | PARTIAL | prayer alerts only (`answered`/`archived`); hard delete elsewhere |
| **Revision history** | MISSING | `threeWayMerge.ts` is sync-only, not content versioning |
| **Admin search / filter / sort / pagination** | MISSING | `ui/pagination.tsx` exists but unused |
| **User & role management UI** | MISSING | only a user count card |
| **Audit log** | MISSING | no table, no type, no writes anywhere |
| **Content-type sections** (devotionals, hymns, reading plans, videos, faith-guide resources, offline pack) | MISSING | admin manages only library items, prayer alerts, news |
| Role model | PARTIAL | only `'user' \| 'admin'` exist (`UserRole`); spec requires 5 roles |
| Dedicated permission helper (`can(...)`) | MISSING | role checks duplicated inline in 8+ files |

## 3. Content architecture (user-facing sources of truth)

| Content | Current source | Gap |
|---|---|---|
| Devotionals | **hard-coded generator** — 8 body templates × 7 verses × 5 translations ≈ 944 seeded rows (`src/data/mockDevotionalHymnData.ts`) | not admin-managed, not DB-backed |
| Hymns | 15 hard-coded public-domain hymns (`HYMN_CONTENT`) | not admin-managed; `src/data/mockHymnData.ts` is a dead duplicate (zero importers) |
| Reading plans | 3 hard-coded 7-day plans (`src/data/readingPlans.ts`) | not admin-managed |
| Library items | 8 hard-coded seeds + localStorage (`src/data/mockFaithData.ts`) | partially synced to `library_items` when configured |
| Prayer alerts / News | 5 + 4 hard-coded seeds | partially synced |
| Community rules / groups / posts | 4 rules, 4 groups (fake member counts), 2 seed posts | rules & groups not admin-managed |
| Faith Guide studies | 5 hard-coded `CURATED_BIBLE_STUDIES` | not admin-managed |
| Home "Scripture of the day" | hard-coded `DAILY_VERSE` (`Home.tsx:25`) | not admin-managed |
| Bible text | live fetch (bible-api.com) + IndexedDB/local fallback | OK |
| Loading / empty / error / offline states | PARTIAL | sync failures surfaced via `syncHealth`; no global pattern |

## 4. Offline / PWA

| Item | Status | Notes |
|---|---|---|
| Service worker + manifest + precached shell | EXISTS | `public/sw.js`, `public/manifest.webmanifest` |
| Privacy of cache (never caches `supabase.co`, `/auth/`, `Authorization` requests, non-GET) | EXISTS | `sw.js` `isPrivateOrAuthenticatedRequest` |
| IndexedDB offline store | PARTIAL | **only** `bible_chapters`; nothing else downloadable |
| Quota estimates | EXISTS | `getStorageQuotaStats()` |
| **Admin offline-content policy controls** | MISSING | — |
| **User download/cancel/progress/delete/retry UI** | MISSING | — |
| **Downloaded vs available-online indicators** | MISSING | — |
| **Version invalidation of cached content** | PARTIAL | shell/scripture cache versioning only |
| **Background sync / update-on-reconnect for content** | PARTIAL | prefs 3-way merge on reconnect; no content updates |
| PNG icons / maskable icon set | PARTIAL | SVG only |

## 5. Notifications

| Item | Status |
|---|---|
| Permission request (`requestNotificationPermissionAndTest`) | EXISTS but fires only a one-off test notification at toggle time |
| Daily reminder **scheduling** | **MISSING** — no timer compares now to the reminder time |
| `lastNotifiedDate` write-back | **MISSING** (read, never written) |
| `push` / `notificationclick` SW handlers | **MISSING** |
| Prayer-alert "reminder" switch | **FAKE** — flips a localStorage boolean + toast only |
| Push subscriptions (VAPID) / server push | **MISSING** (needs backend; not in schema) |

## 6. Tests & scripts

- `npm test` = source-level assertions only (`tests/phase3.test.mjs`, `tests/phase4.test.mjs`); plus opt-in live check `tests/phase4-rls.live.mjs` (skips when unconfigured).
- No tests for offline runtime behavior, notifications, CMS workflows, RLS authorization, or browser-level flows (Playwright is installed but unused).

## 7. UX / layout (fixed in this pass)

| Issue | Status |
|---|---|
| Floating brand badge covering every page `h1` | FIXED — replaced by in-flow app bar |
| Floating Admin button sitting exactly on top of each page's top-right control | FIXED — moved into app bar + More sheet |
| Library/Dashboard floating shortcuts covering right ends of search inputs / tabs | FIXED — removed; destinations live in More sheet |
| FaithGuide FAB covering Home's last grid tile & Bible's toolbar | FIXED — removed; Faith Guide in More sheet |
| `/community` unreachable (orphan route) | FIXED — Community added to More sheet |
| No menu/drawer navigation (7 of 12 routes not in bottom bar) | FIXED — bottom bar (Home/Bible/Devotion/Hymns/More) + More sheet with all destinations |
| Selectable user color themes | ADDED — 6 accent palettes + light/dark/system mode (`src/lib/theme.ts`, `src/styles/theme.css`, `ThemeSettings` in Profile) |
| Working reminders | ADDED — scheduler + SW notification handlers (`src/lib/notifications.ts`) |

## 8. Blockers for Stages B–G

1. **The database does not exist on the live project.** No migration can be "applied safely" until someone with Supabase access runs `schema.sql` + migrations (no service-role key or CLI auth in this environment).
2. No storage buckets/policies exist for media (Stage 7 prerequisite).
3. Server-side push (VAPID keys + push subscription table + send job) requires backend infrastructure that does not exist; local notifications are implemented.
4. Production/staging env files are unconfigured.
