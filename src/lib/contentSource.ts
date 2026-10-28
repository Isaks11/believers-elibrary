/**
 * Read-only content bridge between the CMS (`src/lib/contentAdmin.ts`) and the
 * user-facing pages (Devotional / HymnBook / Home).
 *
 * Thin by design — it does NOT duplicate any contentAdmin logic:
 * - All reads go through `listContent(type, { status: 'published' })`, which
 *   also auto-publishes due scheduled rows and already degrades to
 *   device-local storage when Supabase isn't configured.
 * - Records are then filtered/sorted for the page (today's devotionals,
 *   hymns ordered by number/title) and mapped to the EXISTING page shapes
 *   (`DevotionalEntry` / `Hymn`) via the named `cms*ToPage*` mappers, so the
 *   pages need only minimal changes.
 * - Every failure path resolves to an empty result (`[]` / `null`) so pages
 *   keep their current fallbacks — no loading states are invented here.
 *
 * Raw result lists are memoized in-memory for 5 minutes so remounts,
 * re-renders and the daily scheduler don't re-hit the store; call
 * `clearContentSourceCache()` to force a refresh (e.g. after publishing).
 *
 * Ids: CMS records get a stable `cms:`-prefixed page id so they can never
 * collide with the seeded ids (`dev-…`, `hymn-…`), and the same prefixed id
 * is used as the key in the id-based progress/bookmark/favorite stores.
 */

import { listContent } from '@/lib/contentAdmin'
import {
  getBookmarkedDevotionalIds,
  getCompletedDevotionalMap,
  getFavoriteHymnIds,
} from '@/data/mockDevotionalHymnData'
import { DAYS_OF_WEEK, MONTHS } from '@/types/devotional-hymn'
import type { DevotionalEntry, Hymn } from '@/types/devotional-hymn'
import type { ContentRecordMap, DevotionalRecord, HymnRecord } from '@/types/content'

/** In-memory cache TTL — five minutes. */
export const CONTENT_SOURCE_TTL_MS = 5 * 60 * 1000

/** Prefix applied to CMS ids when mapped to page shapes (provenance + collision safety). */
export const CMS_ID_PREFIX = 'cms:'

interface CacheEntry {
  value: unknown
  expiresAt: number
}

const cache = new Map<string, CacheEntry>()

/** Empties the in-memory cache so the next read goes back to the CMS store. */
export function clearContentSourceCache(): void {
  cache.clear()
}

if (typeof window !== 'undefined') {
  window.addEventListener('cms:content-changed', () => {
    clearContentSourceCache()
  })
}

// --- Internal cached read ----------------------------------------------------

/** Published rows for a CMS-backed type, cached for `CONTENT_SOURCE_TTL_MS`. */
async function loadPublishedRecords<K extends 'devotional' | 'hymn'>(
  type: K
): Promise<ContentRecordMap[K][]> {
  const key = `published:${type}`
  const hit = cache.get(key)
  if (hit && hit.expiresAt > Date.now()) return hit.value as ContentRecordMap[K][]
  try {
    const result = await listContent(type, { status: 'published', pageSize: 1000 })
    const rows = result.rows
    cache.set(key, { value: rows, expiresAt: Date.now() + CONTENT_SOURCE_TTL_MS })
    return rows
  } catch {
    // Honest fallback: no usable copy → empty list; pages fall back locally.
    return []
  }
}

// --- Small utilities ---------------------------------------------------------

/** Device-local calendar date as YYYY-MM-DD (never UTC — the day must match the user's clock). */
function todayDeviceLocalDate(): string {
  return deviceLocalDateKey(new Date())
}

function deviceLocalDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** Best timestamp for ordering: published date, else devotional date, else updated_at. */
function publishedTs(record: { published_at?: string | null; devotional_date?: string | null; updated_at?: string }): number {
  return Date.parse(record.published_at || record.devotional_date || record.updated_at || '') || 0
}

/** Stable page id — CMS ids are `cms:`-prefixed to avoid seeded-id collisions. */
function toPageId(id: string): string {
  return id.startsWith(CMS_ID_PREFIX) ? id : `${CMS_ID_PREFIX}${id}`
}

/** Local date parts (year / month name / day / weekday name) from an ISO date or timestamp. */
function datePartsFrom(isoDate: string | null | undefined): {
  year: number
  month: string
  day: number
  dayOfWeek: string
} {
  const now = new Date()
  const match = isoDate ? /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate) : null
  const year = match ? Number(match[1]) : now.getFullYear()
  const rawMonthIndex = match ? Number(match[2]) - 1 : now.getMonth()
  const monthIndex = rawMonthIndex >= 0 && rawMonthIndex < 12 ? rawMonthIndex : now.getMonth()
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const rawDay = match ? Number(match[3]) : now.getDate()
  const date = new Date(year, monthIndex, Math.min(Math.max(rawDay, 1), daysInMonth))
  return {
    year: date.getFullYear(),
    month: MONTHS[date.getMonth()],
    day: date.getDate(),
    dayOfWeek: DAYS_OF_WEEK[(date.getDay() + 6) % 7],
  }
}

// --- Public reads ------------------------------------------------------------

/**
 * Today's published devotionals (device-local date), plus evergreen entries
 * with no `devotional_date`. Dated rows sort newest-first; undated rows follow
 * by publish time. Returns `[]` on any error.
 */
export async function loadPublishedDevotionals(): Promise<DevotionalRecord[]> {
  try {
    const rows = await loadPublishedRecords('devotional')
    const today = todayDeviceLocalDate()
    const selected = rows.filter((row) => !row.devotional_date || row.devotional_date === today)
    selected.sort((a, b) => {
      // Dated entries first, newest date first ('' would sort last desc);
      // ties (all of today) broken by publish time, newest first.
      const aDate = a.devotional_date ?? ''
      const bDate = b.devotional_date ?? ''
      if (aDate !== bDate) return bDate.localeCompare(aDate)
      return publishedTs(b) - publishedTs(a)
    })
    return selected
  } catch {
    return []
  }
}

/**
 * All published devotionals from the church CMS regardless of date.
 * Sorted by devotional date / published timestamp newest first.
 */
export async function loadAllPublishedDevotionals(): Promise<DevotionalRecord[]> {
  try {
    const rows = await loadPublishedRecords('devotional')
    const sorted = [...rows].sort((a, b) => {
      const aDate = a.devotional_date ?? ''
      const bDate = b.devotional_date ?? ''
      if (aDate !== bDate) return bDate.localeCompare(aDate)
      return publishedTs(b) - publishedTs(a)
    })
    return sorted
  } catch {
    return []
  }
}

/**
 * All published hymns, sorted by hymn number (unnumbered last) then title.
 * Returns `[]` on any error.
 */
export async function loadPublishedHymns(): Promise<HymnRecord[]> {
  try {
    const rows = await loadPublishedRecords('hymn')
    return [...rows].sort((a, b) => {
      const aNumber = typeof a.number === 'number' ? a.number : Number.MAX_SAFE_INTEGER
      const bNumber = typeof b.number === 'number' ? b.number : Number.MAX_SAFE_INTEGER
      if (aNumber !== bNumber) return aNumber - bNumber
      return a.title.localeCompare(b.title)
    })
  } catch {
    return []
  }
}

/**
 * Newest published devotional that carries a scripture verse
 * (`verse_text` + `verse_ref`), or `null` when there is none / on error —
 * callers fall back to their built-in verse.
 */
export async function loadDailyVerse(): Promise<{ text: string; ref: string } | null> {
  try {
    const rows = await loadPublishedRecords('devotional')
    let newest: { text: string; ref: string } | null = null
    let newestTs = -1
    for (const row of rows) {
      if (!row.verse_text || !row.verse_ref) continue
      const ts = publishedTs(row)
      if (ts >= newestTs) {
        newestTs = ts
        newest = { text: row.verse_text, ref: row.verse_ref }
      }
    }
    return newest
  } catch {
    return null
  }
}

// --- CMS → page shape mappers ------------------------------------------------

/**
 * Maps a published CMS devotional to the `DevotionalEntry` shape the Devotional
 * page already renders (calendar day, scripture, body, …). Progress state is
 * hydrated from the shared id-based stores under the `cms:` id, so completion
 * and bookmarks work exactly as they do for seeded entries.
 *
 * Fields the CMS does not model are derived from the record itself rather than
 * invented: `keyThought` is the first paragraph of the published body, and
 * `prayer` / `prayerPoints` stay empty (the page hides empty prayer content).
 */
export function cmsDevotionalToPageDevotional(record: DevotionalRecord): DevotionalEntry {
  const id = toPageId(record.id)
  const parts = datePartsFrom(record.devotional_date ?? record.published_at ?? record.created_at)
  const body = record.body ?? ''
  const paragraphs = body
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
  const wordCount = body.split(/\s+/).filter(Boolean).length
  const completedMap = getCompletedDevotionalMap()
  const bookmarked = new Set(getBookmarkedDevotionalIds())

  return {
    id,
    ...parts,
    title: record.title,
    theme: (record.category && record.category.trim()) || 'Devotion',
    scriptureRef: record.verse_ref,
    bibleVersions: record.verse_text ? { KJV: record.verse_text } : {},
    mainBody: body,
    keyThought: paragraphs[0] ?? body,
    prayer: '',
    prayerPoints: [],
    author: (record.author && record.author.trim()) || 'Church Library',
    readTimeMinutes: Math.max(1, Math.round(wordCount / 200)),
    tags: record.tags ?? [],
    isCompleted: Boolean(completedMap[id]),
    isBookmarked: bookmarked.has(id),
  }
}

/**
 * Maps a published CMS hymn to the `Hymn` shape the HymnBook already renders.
 * Lyrics split on blank lines into stanzas; a missing number maps to `0`
 * (rendered as "—" in the list); favorite state is hydrated from the shared
 * id-based favorites store under the `cms:` id.
 */
export function cmsHymnToPageHymn(record: HymnRecord): Hymn {
  const id = toPageId(record.id)
  const lyrics = record.lyrics ?? ''
  const stanzas = lyrics
    .split(/\n\s*\n/)
    .map((stanza) => stanza.trim())
    .filter(Boolean)
  const favorites = new Set(getFavoriteHymnIds())

  const hymn: Hymn = {
    id,
    number: typeof record.number === 'number' && Number.isFinite(record.number) ? record.number : 0,
    title: record.title,
    category:
      (record.hymn_category && record.hymn_category.trim()) ||
      (record.category && record.category.trim()) ||
      'Custom',
    author:
      (record.composer && record.composer.trim()) ||
      (record.author && record.author.trim()) ||
      'Unknown',
    stanzas: stanzas.length > 0 ? stanzas : [lyrics],
    isFavorite: favorites.has(id),
  }
  if (record.meter) hymn.meter = record.meter
  if (record.audio_url) hymn.audioUrl = record.audio_url
  return hymn
}
