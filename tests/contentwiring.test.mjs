/**
 * Stage D content wiring verification (`tests/contentwiring.test.mjs`)
 *
 * Source-level assertions (no DOM, no bundler) covering:
 * 1. `src/lib/contentSource.ts` — documented exports (loaders, CMS→page
 *    mappers, cache clear), read-only delegation to `listContent`, the
 *    5-minute TTL cache, and honest error fallbacks (`[]` / `null`).
 * 2. `src/pages/Devotional.tsx` — imports contentSource AND still imports the
 *    reminders module; renders the "From your church" section and writes
 *    id-based progress under `cms:` ids.
 * 3. `src/pages/HymnBook.tsx` — merges CMS hymns (dedupe by number, CMS wins),
 *    badges their provenance, keeps search over the merged list.
 * 4. `src/pages/Home.tsx` — calls `loadDailyVerse()` and keeps the built-in
 *    DAILY_VERSE fallback.
 * 5. No fire-and-forget empty `.then(() => {})` patterns in any wired file.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

/** Source of one exported function/const, sliced up to the next top-level export. */
function sliceExport(src, name) {
  const markers = [
    `export async function ${name}`,
    `export function ${name}`,
    `async function ${name}`,
    `function ${name}`,
  ];
  let fnStart = -1;
  for (const marker of markers) {
    fnStart = src.indexOf(marker);
    if (fnStart >= 0) break;
  }
  assert.ok(fnStart >= 0, `missing function: ${name}`);
  const next = src.indexOf('\nexport ', fnStart + 1);
  return src.slice(fnStart, next >= 0 ? next : src.length);
}

const sourceSrc = read('src/lib/contentSource.ts');
const devotionalSrc = read('src/pages/Devotional.tsx');
const hymnBookSrc = read('src/pages/HymnBook.tsx');
const homeSrc = read('src/pages/Home.tsx');
const wiredFiles = [sourceSrc, devotionalSrc, hymnBookSrc, homeSrc];

// ---------------------------------------------------------------------------
// 1. contentSource — documented exports, read-only bridge, mappers
// ---------------------------------------------------------------------------
test('contentSource exports the documented loaders, mappers and cache clear', () => {
  assert.match(
    sourceSrc,
    /export async function loadPublishedDevotionals\(\): Promise<DevotionalRecord\[\]>/
  );
  assert.match(sourceSrc, /export async function loadPublishedHymns\(\): Promise<HymnRecord\[\]>/);
  assert.match(
    sourceSrc,
    /export async function loadDailyVerse\(\): Promise<\{ text: string; ref: string \} \| null>/
  );
  assert.match(sourceSrc, /export function clearContentSourceCache\(\): void/);
  assert.match(
    sourceSrc,
    /export function cmsDevotionalToPageDevotional\(record: DevotionalRecord\): DevotionalEntry/
  );
  assert.match(sourceSrc, /export function cmsHymnToPageHymn\(record: HymnRecord\): Hymn/);
  // Stable, collision-free page ids for seeded-id stores.
  assert.match(sourceSrc, /CMS_ID_PREFIX = 'cms:'/);
  assert.match(sourceSrc, /toPageId\(record\.id\)/);
});

test('contentSource delegates reads to contentAdmin.listContent (no duplicated query logic)', () => {
  assert.match(sourceSrc, /import \{ listContent \} from '@\/lib\/contentAdmin'/);
  assert.match(sourceSrc, /listContent\(type, \{ status: 'published'/);
  // Must not re-implement listing itself.
  assert.doesNotMatch(sourceSrc, /function listContent/);
  // Devotionals are filtered to today's device-local date or undated.
  const body = sliceExport(sourceSrc, 'loadPublishedDevotionals');
  assert.match(body, /todayDeviceLocalDate\(\)/);
  assert.match(body, /!row\.devotional_date \|\| row\.devotional_date === today/);
  assert.match(body, /\.sort\(/);
  // Hymns sorted by number then title.
  const hymnsBody = sliceExport(sourceSrc, 'loadPublishedHymns');
  assert.match(hymnsBody, /a\.number/);
  assert.match(hymnsBody, /a\.title\.localeCompare\(b\.title\)/);
});

test('contentSource memoizes reads with a 5-minute TTL and exposes a cache clear', () => {
  assert.match(sourceSrc, /CONTENT_SOURCE_TTL_MS = 5 \* 60 \* 1000/);
  assert.match(sourceSrc, /hit\.expiresAt > Date\.now\(\)/);
  assert.match(sourceSrc, /expiresAt: Date\.now\(\) \+ CONTENT_SOURCE_TTL_MS/);
  const clearBody = sliceExport(sourceSrc, 'clearContentSourceCache');
  assert.match(clearBody, /cache\.clear\(\)/);
});

test('contentSource falls back honestly on error ([] for lists, null for the verse)', () => {
  for (const name of ['loadPublishedDevotionals', 'loadPublishedHymns']) {
    const body = sliceExport(sourceSrc, name);
    assert.match(body, /catch \{/, `${name} must catch errors`);
    assert.match(body, /return \[\]/, `${name} must return [] on error`);
  }
  const verseBody = sliceExport(sourceSrc, 'loadDailyVerse');
  assert.match(verseBody, /catch \{/);
  assert.match(verseBody, /return null/, 'loadDailyVerse must return null on error');
  // The cached read path degrades to [] too.
  const cacheBody = sliceExport(sourceSrc, 'loadPublishedRecords');
  assert.match(cacheBody, /catch \{/);
  assert.match(cacheBody, /return \[\]/);
});

// ---------------------------------------------------------------------------
// 2. Devotional.tsx — CMS section + reminders module untouched
// ---------------------------------------------------------------------------
test('Devotional.tsx imports contentSource and the reminders module', () => {
  assert.match(devotionalSrc, /import \{ cmsDevotionalToPageDevotional, loadPublishedDevotionals \} from '@\/lib\/contentSource'/);
  // Reminder wiring must survive (module + concrete functions).
  assert.match(devotionalSrc, /from '@\/lib\/notifications'/);
  for (const fn of [
    'requestNotificationPermission',
    'checkAndFireDailyReminder',
    'showLocalNotification',
    'isStandalonePwa',
    'getDailyReminderPrefs',
    'saveDailyReminderPrefs',
  ]) {
    assert.ok(devotionalSrc.includes(fn), `reminder function still imported/used: ${fn}`);
  }
});

test('Devotional.tsx renders the church section and maps CMS rows to page entries', () => {
  assert.match(devotionalSrc, /From your church/);
  assert.match(devotionalSrc, /rows\.map\(cmsDevotionalToPageDevotional\)/);
  assert.match(devotionalSrc, /loadPublishedDevotionals\(\)/);
  assert.match(devotionalSrc, /cmsDetailId/);
  // Progress stores are id-based — cms: ids must be written through them.
  assert.match(devotionalSrc, /saveCompletedDevotionalMap/);
  assert.match(devotionalSrc, /saveBookmarkedDevotionalIds/);
  assert.match(devotionalSrc, /getCompletedDevotionalMap/);
  // Empty CMS → no section noise (guarded render).
  assert.match(devotionalSrc, /cmsDevotionals\.length > 0/);
});

// ---------------------------------------------------------------------------
// 3. HymnBook.tsx — merge with number dedupe, provenance badge, search
// ---------------------------------------------------------------------------
test('HymnBook.tsx merges CMS hymns (dedupe by number, CMS wins) with a provenance badge', () => {
  assert.match(hymnBookSrc, /import \{ CMS_ID_PREFIX, cmsHymnToPageHymn, loadPublishedHymns \} from '@\/lib\/contentSource'/);
  assert.match(hymnBookSrc, /function mergeCmsHymns\(local: Hymn\[\], cms: Hymn\[\]\): Hymn\[\]/);
  const mergeIdx = hymnBookSrc.indexOf('function mergeCmsHymns');
  const mergeBody = hymnBookSrc.slice(mergeIdx, hymnBookSrc.indexOf('\nexport ', mergeIdx) >= 0 ? hymnBookSrc.indexOf('\nexport ', mergeIdx) : hymnBookSrc.length);
  // No CMS hymns → today's list exactly as before.
  assert.match(mergeBody, /if \(cms\.length === 0\) return local/);
  // Dedupe by hymn number with the CMS copy winning.
  assert.match(mergeBody, /cmsNumbers/);
  assert.match(mergeBody, /h\.number > 0/);
  assert.match(mergeBody, /!cmsNumbers\.has\(hymn\.number\)/);
  assert.match(mergeBody, /\[\.\.\.cmsRows, \.\.\.remainingLocal\]/);
  // Provenance badge on CMS rows.
  assert.match(hymnBookSrc, /function isCmsHymn\(hymn: Hymn\)/);
  assert.match(hymnBookSrc, /isCmsHymn\(hymn\)/);
  assert.match(hymnBookSrc, />Library</);
  assert.match(hymnBookSrc, /setCmsHymns\(rows\.map\(cmsHymnToPageHymn\)\)/);
});

test('HymnBook.tsx keeps search and filters running over the merged list', () => {
  const searchIdx = hymnBookSrc.indexOf('const filtered = useMemo');
  assert.ok(searchIdx >= 0, 'filtered useMemo missing');
  const searchBody = hymnBookSrc.slice(searchIdx, hymnBookSrc.indexOf('}, [hymns', searchIdx) + 40);
  assert.match(searchBody, /hymns\.filter/);
  assert.match(searchBody, /query/);
  // The merged list is what everything reads from.
  assert.match(hymnBookSrc, /const hymns = useMemo\(\(\) => mergeCmsHymns\(localHymns, cmsHymns\)/);
});

// ---------------------------------------------------------------------------
// 4. Home.tsx — loadDailyVerse + DAILY_VERSE fallback
// ---------------------------------------------------------------------------
test('Home.tsx calls loadDailyVerse and keeps the DAILY_VERSE fallback', () => {
  assert.match(homeSrc, /import \{ loadDailyVerse \} from '@\/lib\/contentSource'/);
  const callIdx = homeSrc.indexOf('loadDailyVerse()');
  assert.ok(callIdx >= 0, 'loadDailyVerse() must be called');
  const effectIdx = homeSrc.indexOf('useEffect(() => {');
  assert.ok(effectIdx >= 0 && effectIdx < callIdx, 'loadDailyVerse() must be called from an effect');
  // Fallback constant stays declared and is what renders when CMS has no verse.
  assert.match(homeSrc, /const DAILY_VERSE = \{/);
  assert.match(homeSrc, /cmsVerse\s*\n?\s*\? \{ text: cmsVerse\.text, reference: cmsVerse\.ref \}/);
  assert.match(homeSrc, /: \{ text: DAILY_VERSE\.text, reference: DAILY_VERSE\.reference \}/);
  // Same styling/citation UI, just fed by the resolved verse.
  assert.match(homeSrc, /\{dailyVerse\.text\}/);
  assert.match(homeSrc, /\{dailyVerse\.reference\}/);
  assert.match(homeSrc, /`"\$\{dailyVerse\.text\}" — \$\{dailyVerse\.reference\}`/);
});

// ---------------------------------------------------------------------------
// 5. No fire-and-forget empty then-callbacks in the wired files
// ---------------------------------------------------------------------------
test('no fire-and-forget empty .then(() => {}) patterns in the wired files', () => {
  const names = [
    'src/lib/contentSource.ts',
    'src/pages/Devotional.tsx',
    'src/pages/HymnBook.tsx',
    'src/pages/Home.tsx',
  ];
  const emptyThen = /\.then\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)/;
  const throwawayThen = /\.then\(\s*\(\s*\)\s*=>\s*(undefined|\{\}\s*)\)/;
  names.forEach((name, i) => {
    assert.doesNotMatch(wiredFiles[i], emptyThen, `${name}: empty .then(() => {}) callback`);
    assert.doesNotMatch(wiredFiles[i], throwawayThen, `${name}: throwaway .then(() => …) callback`);
  });
  // The wired loaders are awaited instead.
  assert.match(devotionalSrc, /await loadPublishedDevotionals\(\)/);
  assert.match(hymnBookSrc, /await loadPublishedHymns\(\)/);
  assert.match(homeSrc, /await loadDailyVerse\(\)/);
});
