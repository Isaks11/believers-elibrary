> Status: Draft for beta readiness review — 2026-10-19

# Deployment — Believers e-Library

Static SPA (Vite build → `dist/`) + Supabase backend. Staging and production are separate builds differing only by Vite mode/env.

## ⚠ Top open item

**The database schema has not been applied to the Supabase project.** Sign-up works, but all cloud reads/writes fail gracefully to local-only mode. Run `supabase/schema.sql` (see step 2) before any deployment is considered functional. This is the single blocking item for beta.

## 1. Vite modes and env files

Vite loads env files per mode: `.env` → `.env.local` → `.env.[mode]` → `.env.[mode].local` (later wins). Only `VITE_`-prefixed vars are exposed to the client.

| File | Used by |
|---|---|
| `.env` / `.env.local` | All modes (base values) |
| `.env.development` | `npm run dev` |
| `.env.staging` | staging build |
| `.env.production` | production build (default for `vite build`) |

All env files are gitignored except `.env.example` — never commit real keys.

**Scripts:** `package.json` currently ships only `"build": "tsc -b && vite build"`. Until it is extended, build per mode by appending the flag (npm passes it to the last command, `vite build`):

```bash
npm run build -- --mode staging       # → tsc -b && vite build --mode staging
npm run build -- --mode production    # same as npm run build
```

Recommended additions to `package.json` (make separately; do not block on this):

```json
"build:staging": "tsc -b && vite build --mode staging",
"build:prod": "tsc -b && vite build --mode production"
```

## 2. Supabase configuration — exact order

1. Create the Supabase project; note the project URL and anon/publishable key.
2. **Apply the schema:** in the Supabase SQL editor, run `supabase/schema.sql` top-to-bottom (if your branch has `supabase/migrations/`, run those files in numeric order after it). Verify tables + RLS exist.
3. Auth → URL Configuration: set **Site URL** to the deployed origin and add it (plus staging origin) to **Redirect URLs**.
4. Auth → Providers → Email: **enable email confirmations** for production.
5. Create `.env.staging` / `.env.production` with `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (publishable/anon key — public by design; **service-role keys and DB passwords must never enter the client bundle**), and `VITE_ADMIN_EMAILS`.
6. Deploy, then sign up as the first admin and confirm the email.
7. Promote the first admin in the SQL editor:
   ```sql
   update public.profiles set role = 'admin' where email = 'you@example.com';
   ```
   (Frontend `VITE_ADMIN_EMAILS` is a UX allow-list only; RLS + `role='admin'` is the real enforcement, with a trigger preventing self role escalation.)

## 3. Hosting requirements

- **HTTPS is mandatory** — the service worker only registers in a secure context (https or `localhost`).
- **SPA rewrite** for `BrowserRouter` (deep links must serve `index.html`):

| Host | Rule |
|---|---|
| Netlify | `public/_redirects` → `/*  /index.html  200` (file must live in `public/` so it ships in `dist/`) |
| Vercel | `vercel.json` → `{"rewrites": [{"source": "/(.*)", "destination": "/index.html"}]}` |
| nginx | `try_files $uri $uri/ /index.html;` |

- Serve `manifest.webmanifest`, `sw.js`, and icons from the root; keep `Cache-Control: no-cache` on `index.html` and `sw.js`.

## 4. Backups and restore

| Concern | Approach |
|---|---|
| Backups | Supabase: enable daily backups or Point-in-Time Recovery (plan-dependent) for the production project; staging is disposable |
| Frequency | Daily minimum; PITR for continuous WAL on production |
| Restore | Supabase Dashboard → Database → restore a daily backup / PITR to a target time; or `pg_dump`/`pg_restore` via the CLI |
| App-level escape hatch | Users hold their own JSON backups (Profile → Backup & Restore Data) |
| Verify | Quarterly test restore into a scratch project and check `profiles`, `journal_entries`, `community_posts` row counts |

## 5. Error monitoring

- `VITE_ERROR_WEBHOOK_URL` (optional): intended sink for client error reports. **Current code does not consume this variable yet** — it must be wired before it does anything; treat it as reserved.
- Recommended: **Sentry** — self-hosted or hosted. Use a **DSN as a build-time public key** (safe to expose; scope it to the project, scrub `beforeSend` of journal/prayer text and auth tokens).
- Also acceptable: a minimal webhook (Logflare/Cloudflare) with the same scrubbing rules. No analytics/advertising SDKs — keep it that way (see `docs/PRIVACY_NOTICE.md`).

## 6. Cache / service-worker update policy

- Cache keys are versioned by `CACHE_VERSION` in `public/sw.js` (currently `'v3'`), used for `believers-library-shell-*` and `believers-library-scripture-*`.
- **Procedure:** bump `CACHE_VERSION` on any change to precached shell files or SW fetch logic → deploy → old caches are deleted on `activate`; returning users get new assets on next reload (HTML is network-first, so updates propagate without a hard refresh).
- Never cache authenticated/Supabase endpoints (existing SW rule); do not weaken it.

## 7. Pre-launch environment variable checklist

| Variable | Staging | Production | Notes |
|---|---|---|---|
| `VITE_SUPABASE_URL` | Required | Required | Project URL |
| `VITE_SUPABASE_ANON_KEY` | Required | Required | Anon/publishable key only |
| `VITE_ADMIN_EMAILS` | Required | Required | Comma-separated UX allow-list; empty = nobody gets admin UI |
| `VITE_ERROR_WEBHOOK_URL` | Optional | Optional | Reserved — not consumed by current code |
| Service-role key / DB password | **Forbidden** | **Forbidden** | Must never appear in any `VITE_` var |
| Site URL / Redirect URLs | Set | Set | Supabase Auth settings, step 3 |
| Schema applied (`supabase/schema.sql`) | ✔ | ✔ | Step 2 — blocking until done |
