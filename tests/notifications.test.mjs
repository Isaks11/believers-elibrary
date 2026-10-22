/**
 * Daily Reminder Notification System Verification Suite (`tests/notifications.test.mjs`)
 *
 * Source-level assertions covering:
 * 1. Service Worker — `notificationclick` & `push` handlers exist, cache version
 *    bumped to v4, and the strict privacy caching rules remain untouched.
 * 2. `src/lib/notifications.ts` — exports the documented API and reuses the
 *    shared `daily_reminder_prefs_v1` helpers from `@/data/readingPlans`.
 * 3. `src/pages/Devotional.tsx` — no longer calls the old
 *    `requestNotificationPermissionAndTest` test-notification helper.
 * 4. `src/pages/PrayerAlertsNews.tsx` — reminder switch is wired to the real
 *    shared prefs + permission flow, not a localStorage-only boolean.
 * 5. `src/App.tsx` — the scheduler is initialised on app mount.
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

// ---------------------------------------------------------------------------
// 1. Service Worker: notification handlers + cache version bump
// ---------------------------------------------------------------------------
test('public/sw.js registers a notificationclick handler', () => {
  const sw = read('public/sw.js');
  assert.match(sw, /addEventListener\(\s*['"]notificationclick['"]/);
  // Closes the notification, focuses/opens the target window
  assert.match(sw, /event\.notification\.close\(\)/);
  assert.match(sw, /clients\.openWindow/);
  assert.match(sw, /data\?\.url|data && event\.notification\.data\.url|data\.url/);
});

test('public/sw.js registers a push handler with defensive JSON parsing', () => {
  const sw = read('public/sw.js');
  assert.match(sw, /addEventListener\(\s*['"]push['"]/);
  assert.match(sw, /event\.data\.json\(\)/);
  assert.match(sw, /event\.data\.text\(\)/); // plain-text fallback
  assert.match(sw, /self\.registration\.showNotification/);
});

test('public/sw.js cache version bumped to v4 (no v3 caches remain)', () => {
  const sw = read('public/sw.js');
  assert.match(sw, /CACHE_VERSION\s*=\s*['"]v4['"]/);
  assert.doesNotMatch(sw, /believers-library-shell-v3/);
  assert.doesNotMatch(sw, /believers-library-scripture-v3/);
});

test('public/sw.js keeps the strict privacy caching boundary intact', () => {
  const sw = read('public/sw.js');
  assert.match(sw, /isPrivateOrAuthenticatedRequest/);
  assert.match(sw, /request\.headers\.get\(\s*['"]Authorization['"]\s*\)/);
  assert.match(sw, /supabase\.co/);
  assert.match(sw, /request\.method !== 'GET'/);
});

// ---------------------------------------------------------------------------
// 2. src/lib/notifications.ts: documented API + shared prefs reuse
// ---------------------------------------------------------------------------
test('notifications.ts exports the documented functions', () => {
  const src = read('src/lib/notifications.ts');
  assert.match(src, /export function getNotificationPermission\s*\(/);
  assert.match(src, /export async function requestNotificationPermission\s*\(/);
  assert.match(src, /export function isStandalonePwa\s*\(/);
  assert.match(src, /export async function showLocalNotification\s*\(/);
  assert.match(src, /export function checkAndFireDailyReminder\s*\(/);
  assert.match(src, /export function initDailyReminderScheduler\s*\(/);
});

test('notifications.ts reuses the shared daily_reminder_prefs_v1 helpers (no duplicated storage)', () => {
  const src = read('src/lib/notifications.ts');
  assert.match(src, /import\s*{[^}]*getDailyReminderPrefs[^}]*}\s*from\s*['"]@\/data\/readingPlans['"]/);
  assert.match(src, /saveDailyReminderPrefs/);
  // Storage key must NOT be re-declared here — it belongs to readingPlans.ts
  assert.doesNotMatch(src, /localStorage\./);
});

test('notifications.ts fires via service worker first, falls back to Notification then toast', () => {
  const src = read('src/lib/notifications.ts');
  assert.match(src, /navigator\.serviceWorker\.getRegistration/);
  assert.match(src, /registration\.showNotification/);
  assert.match(src, /new Notification\(/);
  assert.match(src, /toast\.info/);
});

test('checkAndFireDailyReminder de-duplicates with lastNotifiedDate and persists it', () => {
  const src = read('src/lib/notifications.ts');
  assert.match(src, /lastNotifiedDate === todayISO/);
  assert.match(src, /lastNotifiedDate: todayISO/);
  assert.match(src, /prefs\.enabled/);
  assert.match(src, /getNotificationPermission\(\) !== 'granted'/);
});

test('initDailyReminderScheduler checks immediately, on interval and lifecycle events', () => {
  const src = read('src/lib/notifications.ts');
  assert.match(src, /schedulerActive/); // idempotency guard
  assert.match(src, /setInterval\(check,\s*60_000\)/);
  assert.match(src, /addEventListener\('focus',\s*check\)/);
  assert.match(src, /addEventListener\('online',\s*check\)/);
  assert.match(src, /visibilitychange/);
  assert.match(src, /clearInterval\(intervalId\)/);
});

// ---------------------------------------------------------------------------
// 3. src/pages/Devotional.tsx: real permission flow replaces the test helper
// ---------------------------------------------------------------------------
test('Devotional.tsx no longer imports or calls requestNotificationPermissionAndTest', () => {
  const src = read('src/pages/Devotional.tsx');
  assert.doesNotMatch(src, /requestNotificationPermissionAndTest/);
  assert.match(src, /import\s*{[^}]*requestNotificationPermission[^}]*}\s*from\s*['"]@\/lib\/notifications['"]/);
  assert.match(src, /checkAndFireDailyReminder/);
});

// ---------------------------------------------------------------------------
// 4. src/pages/PrayerAlertsNews.tsx: reminder switch uses shared prefs
// ---------------------------------------------------------------------------
test('PrayerAlertsNews.tsx reminder switch uses the shared prefs + permission flow', () => {
  const src = read('src/pages/PrayerAlertsNews.tsx');
  assert.match(src, /getDailyReminderPrefs/);
  assert.match(src, /saveDailyReminderPrefs/);
  assert.match(src, /requestNotificationPermission/);
  // Switch reflects stored pref state, not the per-alert fake boolean
  assert.doesNotMatch(src, /checked=\{alert\.reminderEnabled\}/);
  assert.doesNotMatch(src, /\.\.\.\s*a,\s*reminderEnabled:/);
});

// ---------------------------------------------------------------------------
// 5. src/App.tsx: scheduler initialised on mount
// ---------------------------------------------------------------------------
test('App.tsx initialises the daily reminder scheduler on mount', () => {
  const src = read('src/App.tsx');
  assert.match(src, /import\s*{[^}]*initDailyReminderScheduler[^}]*}\s*from\s*['"]@\/lib\/notifications['"]/);
  assert.match(src, /useEffect\(\(\)\s*=>\s*\{\s*const stop = initDailyReminderScheduler\(\);\s*return stop;\s*\},\s*\[\]\)/);
});

// ---------------------------------------------------------------------------
// 6. package.json: test:notifications script registered
// ---------------------------------------------------------------------------
test('package.json registers the test:notifications script', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.scripts['test:notifications'], 'node --test tests/notifications.test.mjs');
});
