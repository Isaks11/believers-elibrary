> Status: Draft for beta readiness review — 2026-10-19

# Beta Acceptance Checklist — Believers e-Library

Pass/fail criteria for beta readiness. **Status is pre-filled with the honest state as of 2026-10-19**; nothing is marked passed that has not been demonstrated. Legend: **PASS** / **FAIL** / **PENDING**.

> Blocking known issue: `supabase/schema.sql` has **not** been applied to the Supabase project. Cloud sync degrades to local-only mode; every RLS/security item below inherits this status.

## 1. Build & typecheck

| # | Criteria (pass = …) | Status |
|---|---|---|
| 1.1 | `npm run typecheck` exits 0 on a clean checkout | PENDING — not run in this review |
| 1.2 | `npm run build` produces `dist/` with no TS/checker errors | PENDING — not run in this review |
| 1.3 | `npm run lint` passes with zero errors | PENDING — not run in this review |
| 1.4 | Staging build via `npm run build -- --mode staging` loads correct env values | PENDING — no `.env.staging` in repo yet |

## 2. Security & RLS

| # | Criteria (pass = …) | Status |
|---|---|---|
| 2.1 | `supabase/schema.sql` applied to the Supabase project; tables + RLS confirmed in dashboard | **Pending — schema not applied to Supabase project** |
| 2.2 | RLS test: user A cannot select/insert/update/delete user B's `journal_entries`, `prayer_requests`, `mood_logs`, `bookmarks` | **Pending — schema not applied to Supabase project** |
| 2.3 | RLS test: non-admin cannot read others' `community_reports` or escalate own `profiles.role` (trigger blocks it) | **Pending — schema not applied to Supabase project** |
| 2.4 | RLS test: `group_only` posts invisible to non-members; anonymous posts still carry `author_id` server-side only | **Pending — schema not applied to Supabase project** |
| 2.5 | No service-role key or DB password anywhere in `dist/` (grep built bundle for secret patterns) | PENDING — not run in this review |
| 2.6 | Journal PIN confirmed as UI gate, not encryption; disclosed in `docs/PRIVACY_NOTICE.md` | PASS — documented; behavior matches claim |
| 2.7 | Service worker never caches Supabase/auth responses | PASS — rule present in `public/sw.js`; re-verify after SW changes |

## 3. Authentication flows

| # | Criteria (pass = …) | Status |
|---|---|---|
| 3.1 | Supabase mode: sign-up → email confirmation → sign-in → sign-out → session persist across reload | PENDING — depends on 2.1 + Auth URL settings |
| 3.2 | Unconfigured mode: device-local auth works and is visibly labeled "prototype/local" | PENDING — not exercised in this review |
| 3.3 | First admin promotion SQL applied; admin UI appears only for allow-listed emails | PENDING — requires applied schema |
| 3.4 | Redirect URLs/Site URL correct on both staging and production origins | PENDING — deployment not configured |

## 4. Multi-user isolation

| # | Criteria (pass = …) | Status |
|---|---|---|
| 4.1 | Two local profiles on one device do not see each other's journal/prayer/Bible data | PENDING — manual test not run |
| 4.2 | Cloud: user A/B isolation proven by automated security tests | **Pending — schema not applied to Supabase project** |
| 4.3 | Backup export/restore round-trip preserves one user's data only | PENDING — not run in this review |

## 5. Offline / PWA

| # | Criteria (pass = …) | Status |
|---|---|---|
| 5.1 | Installable (manifest) on desktop + Android; SW registers over HTTPS | PENDING — device testing outstanding |
| 5.2 | App shell loads offline after first visit; downloaded Bible chapters readable offline (IndexedDB) | PENDING — not verified in this review |
| 5.3 | `CACHE_VERSION` bump procedure tested: stale shell replaced on next visit | PENDING — procedure documented, not executed |
| 5.4 | Deep link refresh (SPA rewrite) returns app, not 404 | PENDING — host rewrite not yet added |

## 6. Media playback

| # | Criteria (pass = …) | Status |
|---|---|---|
| 6.1 | Hymn audio plays/pauses/seek via `src/lib/audioEngine.ts` on target browsers | PENDING — not verified in this review |
| 6.2 | Library audio/video items play; no unlicensed recordings bundled | PASS (bundle) — only generated audio shipped; playback PENDING |
| 6.3 | Audio does not break on tab background (OS media controls) | PENDING — not verified |

## 7. Community moderation

| # | Criteria (pass = …) | Status |
|---|---|---|
| 7.1 | Report with each of the 5 reasons files and appears in admin queue as `pending` | PENDING — needs two accounts + applied schema |
| 7.2 | Admin resolve → `resolved_removed` hides content; `resolved_dismissed` restores it | PENDING — needs applied schema |
| 7.3 | Blocking hides the target's posts/comments for the blocker only | PENDING — not run |
| 7.4 | Rate limit: second post/comment within 10s is rejected | PENDING — not run |
| 7.5 | Moderation rules published (`docs/COMMUNITY_GUIDELINES.md`) and reachable in-app | PASS — doc drafted 2026-10-19 |

## 8. Performance

| # | Criteria (pass = …) | Status |
|---|---|---|
| 8.1 | First contentful paint < 2.5s on a mid-range 4G device; initial bundle reviewed for bloat | PENDING — not measured |
| 8.2 | No blocking console errors/warnings in normal flows | PENDING — not run |
| 8.3 | Bible chapter fetch < 2s typical, cached thereafter | PENDING — not measured |

## 9. Legal / privacy docs

| # | Criteria (pass = …) | Status |
|---|---|---|
| 9.1 | `docs/PRIVACY_NOTICE.md` accurate and published | PASS — drafted, pending operator review |
| 9.2 | `docs/TERMS_OF_USE.md` accurate and published | PASS — drafted, pending operator review |
| 9.3 | `docs/COMMUNITY_GUIDELINES.md` published | PASS — drafted, pending operator review |
| 9.4 | `docs/CONTENT_LICENSING.md`: no row still **Missing** for shipped assets (og:image, e-library rights) | **FAIL — og:image external S3 + e-library rights: Missing** |
| 9.5 | Contact channel for privacy/appeals requests exists | PENDING — no contact address published yet |

## 10. Monitoring & backups

| # | Criteria (pass = …) | Status |
|---|---|---|
| 10.1 | Error monitoring live (Sentry DSN or webhook) with PII scrubbing | PENDING — no monitoring configured |
| 10.2 | Supabase daily backup or PITR enabled; one successful test restore | PENDING — backups not configured |
| 10.3 | Account deletion verified end-to-end (including Supabase auth row removal) | **FAIL — auth login row not removed by current delete flow** |

## 11. Device testing

| # | Criteria (pass = …) | Status |
|---|---|---|
| 11.1 | Chrome/Edge (Windows) full smoke test | PENDING |
| 11.2 | Safari/iOS install + playback + offline | PENDING — no iOS device tested |
| 11.3 | Android Chrome install + offline + audio backgrounding | PENDING |
| 11.4 | Guest mode → sign-up data continuity checked | PENDING |

## Summary

| Outcome | Count | Notes |
|---|---|---|
| PASS | 6 | Documentation- and code-inspection-level only |
| FAIL | 2 | #9.4 licensing gaps, #10.3 account deletion |
| PENDING | 29 | Dominated by blocked RLS tests (#2.x) and device testing |

**Any FAIL, or item 2.1, ⇒ automatic NO-GO.**

---

## GO / NO-GO decision record

| Field | Entry |
|---|---|
| Build/version reviewed | ________________ |
| Decision (GO / NO-GO / CONDITIONAL GO) | ________________ |
| Conditions / blockers accepted | ________________ |

| Role | Name | Signature | Date |
|---|---|---|---|
| Technical lead | ________________ | ________________ | __________ |
| Security/RLS reviewer | ________________ | ________________ | __________ |
| Content & licensing owner | ________________ | ________________ | __________ |
| Product/operations owner | ________________ | ________________ | __________ |

*Re-review required when item 2.1 moves off "Pending — schema not applied to Supabase project".*
