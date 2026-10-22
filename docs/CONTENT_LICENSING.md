> Status: Draft for beta readiness review — 2026-10-19

# Content Licensing — Believers e-Library

Inventory of third-party and contributor content shipped or fetched by the app, with license status. Statuses: **Licensed**, **Public domain**, **To verify**, **Missing**.

## 1. Bible translations

- Scripture is fetched **live from `bible-api.com`** at read time (`src/pages/Bible.tsx`, `src/lib/faithGuideEngine.ts`); the KJV and other translations are provided by that service.
- The KJV is public domain in most jurisdictions; **other translations offered by the service may carry copyright** that permits display/fetch but not redistribution.
- Offline chapter downloads (IndexedDB) create a persistent local copy of the fetched text: **verify redistribution terms per translation before bundling or caching at scale**, and before shipping any pre-bundled Scripture.
- Do not bundle translation text into the repo without a per-translation check; attribution as required by the source must be preserved.

## 2. Hymn lyrics and audio

- **Lyrics:** traditional hymn texts (e.g. in `src/data/mockHymnData.ts` / `src/data/mockDevotionalHymnData.ts`) are treated as **public domain**; confirm author death dates and text provenance for any hymn added later.
- **Audio:** the app produces hymn audio **at runtime** via `src/lib/audioEngine.ts` (locally generated sound) — no commercial recordings are currently bundled, so nothing is being distributed today.
- **Rule:** any *recorded* hymn audio added later must be licensed for streaming and distribution (mechanical + sync/public-performance rights as applicable). **The app must not ship unlicensed recordings.**

## 3. Devotionals, news, and library content

- Devotional texts, prayer alerts/news items, and e-library entries (books/audio/video) are **contributor-owned** unless stated otherwise.
- Publishing requires a **license or written permission grant** from the contributor covering reproduction, display, and (for media) streaming.
- An admin approval workflow exists: `library_items.approval_status` (`pending` / `approved` / `rejected`) in `supabase/schema.sql`. **No item may go live before a rights grant is recorded and the item is approved.**

## 4. Icons, images, and branding

- SVG icons in `/public` (`icon-192.svg`, `icon-512.svg`) are app-branded and owned by the project.
- The social preview `og:image` / `twitter:image` in `index.html` points at an **external S3 URL** — it must be replaced with a self-hosted asset for launch (also removes a third-party dependency).
- Cover/splash images are loaded from an external Google Cloud Storage bucket; confirm generation rights and self-host before launch.

## 5. Per-asset licensing checklist

| Asset | Source | Status | Action before launch |
|---|---|---|---|
| KJV text (live fetch) | bible-api.com | Public domain | Preserve attribution; verify service terms for caching |
| Other translations (live fetch) | bible-api.com | To verify | Check per-translation copyright before bundling/offline caching |
| Offline chapter cache | Derived from above | To verify | Same as source translation; cap scope of cached texts |
| Traditional hymn lyrics | Bundled data files | Public domain | Verify provenance for any newly added hymn |
| Runtime hymn audio | `src/lib/audioEngine.ts` | Public domain (nothing bundled) | Keep it generated; any recorded track ⇒ license first (**Missing** if added unlicensed) |
| Devotional texts | Contributors | To verify | Obtain written license/permission grant before publishing |
| News / prayer alerts | Contributors or feeds | To verify | Confirm syndication/permission terms |
| E-library books/audio/video | Contributors | Missing | License/permission grant required; publish only via `approval_status = approved` |
| SVG app icons (`/public`) | Project-owned | Licensed | None |
| `og:image` (external S3) | External bucket | Missing | Replace with self-hosted asset |
| Cover/splash images (external GCS) | External bucket | To verify | Confirm rights; self-host |

## 6. Ongoing obligations

- Keep this table current whenever content or a data source is added; status changes get a new review date in the header line.
- On a rights holder's request, remove the affected content promptly and purge cached copies (including offline chapter caches and service-worker caches).
- Contributor submissions must include a rights statement; without it, content stays `pending`/unpublished.
