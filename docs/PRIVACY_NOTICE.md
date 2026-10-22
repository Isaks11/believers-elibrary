> Status: Draft for beta readiness review — 2026-10-19

# Privacy Notice — Believers e-Library

Believers e-Library is a Christian devotional progressive web app (React 19 + TypeScript + Vite). This notice describes the **beta build as it exists today**: much of the app runs on-device, and cloud sync is not yet fully active (see [Current limitation](#current-limitation)).

## Current limitation

`supabase/schema.sql` **has not been applied to the Supabase project yet.** Until it is, cloud sync fails gracefully and the app runs in local-only mode: your data stays in your browser's storage on this device. Row Level Security (RLS) policies are defined in `supabase/schema.sql` and take effect only once the schema is applied.

## What is stored and where

| Data | Where it is stored | Syncs to cloud |
|---|---|---|
| Journal entries, prayer requests, mood logs | Device `localStorage`; Supabase Postgres once schema is applied | Per-user, RLS-protected |
| Bible bookmarks, highlights, verse notes, reading history | Device `localStorage` / IndexedDB; Supabase when enabled | Per-user, RLS-protected |
| Devotional progress, reading plans, spiritual goals, streaks/activity | Device `localStorage`; Supabase when enabled | Per-user, RLS-protected |
| User preferences | Device `localStorage`; Supabase when enabled | Per-user |
| Community posts, comments, reports, blocks | Supabase Postgres (when configured); cached locally | Visible to others per privacy scope + RLS |
| Offline Bible chapters | IndexedDB on this device | Never — local cache only |
| Account credentials | Supabase Auth (when `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are set); otherwise a **device-local prototype auth** stored in `localStorage` and labeled as such in the app | Supabase Auth only when configured |
| Auth session | `localStorage` (Supabase session token) | Not applicable |
| Backup exports (JSON) | A file **you** download to your device | Not stored by us |

## What is NOT collected

- No analytics, telemetry, or advertising trackers — the app ships no analytics or ad SDKs.
- No location, contacts, camera, or microphone access.
- No payment or financial data (the app processes no payments).
- No cross-app or cross-site profiling; no tracking cookies.
- We do not read your journal or prayer content for any purpose other than showing it to you (and, for public community posts, to other users as scoped).

## Third parties

| Third party | What it receives | Why |
|---|---|---|
| **Supabase** (backend hosting this app's project) | Auth credentials (when configured) and the rows in the tables above | Authentication and database |
| **bible-api.com** | Scripture reference requested (book, chapter, translation) | Fetching KJV and other translations at read time |
| Static asset hosts (Google Fonts CSS; cover/OG images on Google Cloud Storage / S3) | Standard HTTP request for the asset | Fonts and images |

No analytics or advertising third parties are involved. `bible-api.com` sees your scripture requests but is not given your account identity by the app.

## Privacy of journal and prayer content

Journal entries, prayer requests, and mood logs are **private per user**. Access is enforced by Postgres **Row Level Security** policies in `supabase/schema.sql`: a signed-in user can read/write only their own rows; admins can moderate community content, not read your private journal. RLS is only active after the schema is applied — until then, data does not leave the device.

## Exporting and deleting your data

- **Export:** Profile → *Backup & Restore Data* → *Download JSON Backup* (also available from Journal). The file contains your journal entries, prayer requests, bookmarks, mood logs, and reading progress. Restore the same way.
- **Delete:** Profile → *Delete Account & Personal Data* → confirm. This permanently deletes your personal records from device storage (and from cloud tables when sync is active).
- **Known limitation:** account deletion does **not** currently remove the Supabase Auth login row. If you signed up with email/password, the login itself survives until an operator removes it in the Supabase dashboard. This is tracked as a pre-launch item.

## The journal PIN is not encryption

The optional 4–8 digit journal PIN is a **UI convenience gate only**. It hides the journal screen from casual device sharing; it does **not** encrypt your entries. Journal and prayer data remain readable in this device's browser storage to anyone with access to the device/profile. Do not treat the PIN as a security control.

## Cookies

- No tracking or advertising cookies are set.
- The Supabase auth session is persisted in `localStorage`, not in cookies.
- The service worker caches public assets (app shell, downloaded scripture) in the Cache Storage API; it never caches authenticated or private API responses.

## Contact and changes

- Contact: raise an issue in the project repository, or contact the operator of the deployment you use.
- Changes: this notice will be revised as cloud sync, account deletion, and moderation features land; the status line at the top records the review date. Material changes will be announced in-app before release.
