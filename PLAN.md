# Believers e-Library — Product Audit & Roadmap

> Status: **Approved plan.** Supabase project is available — Phase 1 includes real auth, Postgres, and Row Level Security.
> Last updated: 2026-10-19

---

## Executive summary

Believers e-Library is a **strong frontend prototype**, not yet a complete, dependable Christian digital platform. It brings Bible reading, devotionals, hymns, prayer, Christian books, journaling, and spiritual growth into one app — but most features are simulated: there is no backend, no real media playback, no server-side security, and several features silently lose user data.

The next step is **not more pages**. It is making the existing features **real, secure, connected, and useful** in a believer's everyday life.

**Top three priorities:**

1. **Security and real data persistence** — users must be able to trust the platform.
2. **A complete Bible, devotional, and personal study experience** — the core value of the product.
3. **Real content playback and a functional library** — this fulfils the promise of an e-Library.

Only after that: the AI Faith Guide and ministry ecosystem as differentiators.

**The biggest mistake would be to keep adding attractive screens while the underlying features remain simulated.** The goal is a dependable Christian spiritual-growth platform, not a collection of Christian-themed pages.

---

## How the app will be evaluated

| Area | Question |
|---|---|
| **Functionality** | Do the features actually work, or do they only look functional? |
| **Spiritual value** | Does the application genuinely help someone grow in their faith? |
| **Reliability** | Can users trust their notes, progress, bookmarks, and reminders to be saved? |
| **Security** | Are personal information and administrative features protected? |
| **Scalability** | Can the application support real users, content contributors, and ministries? |

---

## Current state of the code (audit findings)

These were verified directly against the source on 2026-10-19.

> **Status:** the admin guard, journal persistence, fake statistics, and broken dev scripts rows
> below have since been addressed — see the Phase 1 checklist for what is done vs. still open.
> Real security still depends on the Supabase RLS policies being applied to a live project.

### Confirmed critical issues

| Finding | Evidence |
|---|---|
| **No backend at all** | Zero `fetch`/`axios`/`useQuery`/network calls anywhere in `src/`. All data is mock seed arrays + `localStorage`. |
| **Admin route not protected** | `src/App.tsx` puts `/admin` inside `ProtectedRoute` only. The nav button is hidden from guests via `user.isGuest`, but the user object is a editable `localStorage` record. Hiding a button is not security. |
| **Journal loses user data** | `src/pages/Journal.tsx` holds entries in `useState` — a page refresh erases them. Worst reliability bug relative to the app's promise (personal reflection). |
| **Fake media playback** | No `<audio>` or `<video>` elements exist in `src/`. Hymn, devotional, and library players are `setInterval`-driven animated progress bars. |
| **Fake statistics** | Dashboard streak (12), prayer hours (87), and Admin "124.5k users" are hard-coded constants in `src/data/mockFaithData.ts`. |
| **Bible reader is a demo** | `src/pages/Bible.tsx` contains 5 hard-coded Genesis verses. Version/book selectors, search, bookmark, listen, and history buttons are decorative. |
| **Mock auth providers** | Google/Facebook buttons in `src/pages/Auth.tsx` have no handlers. Login is `localStorage['believers_user']` with no password or validation. |
| **Dead/dev-only breakage** | `package.json` script `watch:errors` references missing `dala-internal-watch-build-errors.js`; `vite.config.ts` previously imported a missing internal plugin (removed 2026-10-19). |

### Other confirmed findings

- **Home** shows a hard-coded date ("Monday, June 12") and static verse/stats; grid buttons navigate via `window.location.href = '#/path'` instead of the router.
- **Community** feed is entirely static — search, join, like, and post buttons are dead; route is not in bottom navigation.
- **Faith Guide** is a keyword rule-bot (`getMockResponse`, 1s `setTimeout`) — no LLM/API.
- **Profile** stats, activity, and storage counts are hard-coded; only Sign Out works.
- **`/admin` "Users 124.5k"** and other metrics are fabricated.
- **Devotional "audio narration"** animates a 180s bar with no sound.
- **Dead code:** `src/data/mockHymnData.ts` (duplicate, never imported), `src/components/devotional/DevotionalDetail.tsx` (orphaned duplicate of the copy inside `pages/Devotional.tsx`), ~40 unused shadcn/ui components, `hooks/use-mobile.ts` (used only by unused sidebar).
- **Installed but unused dependencies:** `supabase` (this is the **CLI** package — `@supabase/supabase-js` must still be installed), `@tanstack/react-query`, `@dnd-kit/*`, `zod`, `@hookform/resolvers`, `react-hook-form`, `recharts`, `@phosphor-icons/react`, `@types/react-router-dom` (v5 types, wrong for router v7).

---

## 1. Most important missing features

### 1. A complete, functional Bible reader — *Critical*

The current reader (5 Genesis verses) is a UI demonstration, not part of an e-Library.

- Complete books, chapters, and verses.
- Multiple translations from **legitimate, authorized sources**.
- Search by keyword, reference, and passage.
- Highlighting, bookmarks, personal notes, reading history.
- Chapter navigation and continue-reading.
- Offline access to downloaded Bible content.

> **Make Bible reading the core experience.** Verify source, licensing, and permitted use of every translation **before** importing anything — licensing review is a Phase 1 investigation because it determines what Phase 2 can build.

### 2. A real daily spiritual-growth system — *Critical*

The calendar, prayer checklist, and dashboard are a foundation; the system must track what users actually do.

- Complete daily devotional: scripture, reflection, application, prayer.
- Daily reading plan with progress tracking.
- Reading streaks calculated from real activity (not constants).
- Personal spiritual goals and milestones.
- History of completed devotionals and reading sessions.
- Time-zone-aware daily reminders.

> Goal: help a believer answer — *What should I read today? What have I learned? How can I apply it?*

### 3. Real audio and media playback — *Critical*

An animated progress bar is not playback.

- Real audio for hymns and approved devotional recordings.
- Play, pause, seek, volume, progress.
- Background playback and lock-screen controls where supported.
- Playlists, favourites, recently played.
- Video for approved sermons and Bible lessons.
- Downloads for offline listening, where licensing permits.

> Requires real audio files, storage, playback handling, and media permissions.

### 4. A complete personal journal and prayer system — *High*

Journal entries currently reset on reload — unacceptable for an app built on personal reflection.

- Create, edit, delete, search journal entries.
- Prayer requests with dates and categories; mark answered/ongoing.
- Optional private entries and app locking.
- Link entries to Bible passages or devotionals.
- Export / backup of personal entries.

> Prayer and journal content can be deeply personal. **Design privacy controls before introducing cloud sync or community sharing.**

### 5. A genuine digital library — *High*

Library items are catalogue metadata, not content.

- Actual EPUB, PDF, audio, and video files.
- A reader for supported ebook formats.
- Categories, authors, publishers, topics, descriptions.
- Search and filtering.
- Real reading/listening progress.
- Downloads, availability controls, licensing information.
- Review and approval process for uploaded material.

---

## 2. Technical weaknesses

| Current weakness | What should change |
|---|---|
| No backend or server-side database | Connect **Supabase (PostgreSQL)** — project ready. |
| Login is a local simulation | Real authentication, sessions, account recovery via Supabase Auth. |
| Admin access not protected | Server-enforced role-based access control. |
| Data stored in `localStorage` | Persist user-owned data remotely; retain offline support. |
| Fake dashboard statistics | Calculate from actual user activity. |
| Journal resets | Store entries persistently (Phase 1, even before sync). |
| Dead/decorative buttons | Every control performs its stated action or is clearly disabled. |
| No real media files | Implement actual playback and storage. |
| No backup or sync | Recovery, synchronization, conflict handling. |
| Mock auth providers | Integrate real providers **or remove the misleading buttons** until ready. |

### The security issue to fix first

`/admin` is reachable by any logged-in user because the UI hides the link from guests instead of enforcing administrator permissions. **Hiding a button is not security.** Both are required:

1. **Frontend route protection** — prevent ordinary users from navigating to admin screens (immediate fix, not sufficient alone).
2. **Backend authorization** — only authorized administrators may create, delete, publish, or broadcast, even if the interface is bypassed.

With Supabase: use **Auth + PostgreSQL Row Level Security + storage policies**. Never rely on a frontend role check alone.

> `localStorage` is suitable for a prototype but is **not** a secure database or a reliable backup. Clearing browser data destroys content, and nothing syncs across devices.

---

## 3. Differentiating features (after the core works)

**A. A trustworthy AI Faith Guide** — Upgrade the keyword bot to answer Bible-study questions from approved sources, cite chapter and verse, explain passages in context, suggest related scripture, and generate study questions. It must distinguish biblical text from interpretation, acknowledge denominational differences, avoid presenting uncertain answers as God's definitive instruction, and state clearly that it is an AI tool — not a pastor or a substitute for trusted human counsel.

**B. A genuine Christian community** — Bible study groups, posts and comments, shared prayer requests with explicit privacy controls, reporting/blocking/moderator tools, verified ministry/church profiles. **Build moderation and safeguarding into the design before opening posting publicly.**

**C. A proper notification system** — scheduled notifications beyond the page session, user-selected reminder times, preferences, quiet hours, time-zone awareness. Browser notifications and mobile push need different implementations.

**D. Ministry and content-contributor portal** — evolve the admin panel into a CMS: roles (admin / editor / ministry contributor / user), drafts, scheduled publishing, approval workflows, author attribution, revision history, audit logs. Long-term: churches publish approved devotionals, sermons, hymns, and study material through the platform.

**E. Offline-first support** — save authorized Bible content, devotionals, and library materials offline; queue changes until connectivity returns; clearly mark what is available offline. PWA as the starting point; native mobile later for deeper device integration.

---

## 4. Product polish (do not overlook)

- **Accessibility:** readable text, screen-reader labels, keyboard navigation, contrast, scalable font sizes.
- **Language support:** English first, then relevant local languages for the target audience.
- **Content quality:** reliable references, editorial review, clear attribution, permission to distribute copyrighted material.
- **Privacy:** explain what is stored, where, how to export/delete it, and how information is used.
- **Performance:** optimize images, lazy-load large sections, avoid unnecessary animation on low-powered devices.
- **Testing:** authentication, permissions, persistence, navigation, media playback, error handling.
- **Mobile installation:** dependable install experience; test on real Android devices, not only the desktop phone frame.
- **Code cleanup:** remove unused components and broken dev scripts — but only after preserving working functionality and establishing basic tests. Cleanup is maintenance, not a substitute for finishing the product.

---

## 5. Roadmap

### Phase 1 — Make the foundation reliable *(Immediate)*

- [x] **Protect `/admin`** — role-based frontend route guard added (non-admins redirect to `/`). Roles resolve from `VITE_ADMIN_EMAILS` (secure default: nobody is admin). ⏳ Still required: Supabase RLS enforcement (server-side is the real protection).
- [x] **Supabase client + schema scaffolded** — `@supabase/supabase-js` installed, `src/lib/supabase.ts` (null-safe until configured), `.env.example`, and `supabase/schema.sql` with profiles, user tables, content tables, and RLS policies. ⏳ Still required: fill `.env` with real project URL/key and run the schema; then swap local auth for Supabase Auth.
- [~] **Establish user roles and database policies** — policies written in `supabase/schema.sql`; not yet applied to a live project.
- [x] **Persist journal entries** — full CRUD + search + mood log now stored in `localStorage` (`src/data/journalData.ts`). No more data loss on refresh. ⏳ Still required: sync to Postgres.
- [~] **Persist bookmarks, reflections, and progress reliably** — bookmarks/progress already persisted locally; existing fake bookmark/continue seeds removed. ⏳ Still required: migrate `localStorage` → Postgres with offline fallback.
- [x] **Replace fake statistics** with real derived counts — streak, weekly activity, devotionals, journal, prayed/answered counts all computed from recorded activity (`src/lib/activity.ts`); Admin "124.5k users" → real local sign-up count.
- [~] **Fix or visibly disable dead buttons** — done for Auth (social buttons disabled with notice), Admin (news preview now works), Dashboard (quick links now navigate), Home (share/reflect/grid wired). ⏳ Still required: Community, Profile, and Bible reader controls.
- [x] **Fix broken dev scripts** — removed `watch:errors` / `preview:dev` (referenced a missing file); `typecheck` fixed to actually typecheck (`tsc -b` — the old root-config invocation silently passed).
- [ ] **Investigate Bible translation licensing** — decides what Phase 2 may import.

> **Note on `VITE_ADMIN_EMAILS`:** set your own email there (comma-separated) to reach `/admin`. Left empty, admin access is off by default.

### Phase 2 — Complete the core faith experience *(High)*

- [ ] Usable Bible reader (complete text, search, highlights, notes, history, offline).
- [ ] Complete devotionals and reading plans with real progress tracking.
- [ ] Real hymn and media playback (audio files, storage, controls, background play).
- [ ] Finished personal journal and prayer tracker (search, categories, answered prayers, export, privacy/app-lock).
- [ ] Library connected to actual content (EPUB/PDF/audio/video + reader + approval workflow).

### Phase 3 — Add distinctive capabilities *(After core features work)*

- [ ] Faith Guide upgraded to a grounded, sourced, clearly-labelled AI assistant.
- [ ] Reliable reminders (scheduled/time-zone-aware) and offline access (PWA).
- [ ] Community features with moderation and safeguarding built in.
- [ ] Ministry contributor accounts and content workflow.

### Phase 4 — Prepare for public launch *(Before real users depend on it)*

- [ ] Test on real mobile devices.
- [ ] Security, privacy, and content-licensing audit.
- [ ] Error monitoring, backups, recovery procedures.
- [ ] Performance and accessibility optimization.
- [ ] Small pilot with real users; address feedback.

---

## Definition of done for the MVP

A believer can: read the Bible daily in a trusted translation → complete a devotional and see their **real** streak grow → pray and journal with the certainty nothing is lost → listen to actual hymns → find and read real library content → trust that their data is private and their admin panel is locked — on a phone, with a weak connection, after closing and reopening the app.
