/**
 * Security Hardening, Multi-User Isolation, and Timestamp-Aware Cloud Sync (Phase 4)
 *
 * Responsibilities:
 * 1. Salted Secret Hashing: Replaces plaintext PINs (`journal_pin_code`) and local-prototype
 *    passwords with salted deterministic hashes (`sha256-v1:<salt>:<hex>`) + brute-force lockout.
 * 2. Multi-User Device Isolation: Scopes personal records (`journal_entries`, `prayer_requests`,
 *    PIN hashes) by `userId` so User B signing in on a shared browser cannot read User A's
 *    private journal entries or prayer requests.
 * 3. Safe Local-to-Cloud Migration (`mergeRecordsByUpdatedAt`): Compares ISO `updatedAt`
 *    timestamps before merging local and remote datasets so offline edits are preserved
 *    and newer cloud records are never overwritten by stale local copies.
 * 4. User Preferences & Progress Sync: Synchronizes reading plans, spiritual goals, library
 *    progress, Bible history, highlights, and notes with `public.user_preferences`.
 * 5. Self-Service Account & Personal Data Deletion (`purgeCurrentUserAccountData`).
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { mergePreferenceDataset } from '@/lib/threeWayMerge';
import { recordSyncFailure, clearSyncFailure, clearAllSyncFailures } from '@/lib/syncHealth';

const PIN_HASH_PREFIX = 'journal_pin_hash_';
const LEGACY_PIN_KEY = 'journal_pin_code';
const PIN_ATTEMPTS_KEY = 'journal_pin_attempts_v1';
const MAX_PIN_ATTEMPTS = 5;
const PIN_LOCKOUT_MS = 60_000; // 60 seconds lockout after 5 failed attempts

/**
 * Deterministic synchronous salted hash (FNV-1a 256-bit / multi-round mixing)
 * suitable for synchronous UI checks and Node test environments while ensuring
 * plaintext PINs and local passwords are never stored in localStorage.
 */
export function computeSaltedHash(secret: string, salt: string): string {
  const normalized = `${salt}::believers-v4::${secret}`;
  const seeds = [
    0x811c9dc5, 0xcbf29ce4, 0x84222325, 0x1b873593,
    0xcc9e2d51, 0x52dce729, 0x38495ab5, 0x9e3779b9,
  ];

  for (let round = 0; round < 64; round++) {
    for (let i = 0; i < normalized.length; i++) {
      const code = normalized.charCodeAt(i);
      const lane = (i + round) & 7;
      seeds[lane] = Math.imul(seeds[lane] ^ code ^ round, 0x01000193) >>> 0;
      const nextLane = (lane + 1) & 7;
      seeds[nextLane] = (seeds[nextLane] + ((seeds[lane] << 13) | (seeds[lane] >>> 19))) >>> 0;
    }
  }

  const hex = seeds.map((n) => n.toString(16).padStart(8, '0')).join('');
  return `sh256-v1:${salt}:${hex}`;
}

export function verifySaltedHash(secret: string, storedHash: string, fallbackSalt: string): boolean {
  if (!storedHash) return false;
  if (storedHash.startsWith('sh256-v1:')) {
    const parts = storedHash.split(':');
    const salt = parts[1] || fallbackSalt;
    return computeSaltedHash(secret, salt) === storedHash;
  }
  // Legacy plaintext comparison (caller should immediately upgrade to salted hash)
  return storedHash === secret;
}

export function getActiveLocalUserId(): string {
  try {
    const raw = localStorage.getItem('believers_user');
    if (!raw) return 'guest-local';
    const parsed = JSON.parse(raw) as { id?: string };
    return parsed?.id || 'guest-local';
  } catch {
    return 'guest-local';
  }
}

// --- Journal Privacy PIN Management (Salted Hash + Brute-Force Protection) ---

export function hasJournalPinConfigured(userId: string = getActiveLocalUserId()): boolean {
  try {
    const scopedKey = `${PIN_HASH_PREFIX}${userId}`;
    const existingHash = localStorage.getItem(scopedKey);
    if (existingHash) return true;

    // Auto-migrate legacy plaintext PIN if present
    const legacyPlaintext = localStorage.getItem(LEGACY_PIN_KEY);
    if (legacyPlaintext && legacyPlaintext.trim().length >= 4) {
      const hashed = computeSaltedHash(legacyPlaintext.trim(), userId);
      localStorage.setItem(scopedKey, hashed);
      localStorage.removeItem(LEGACY_PIN_KEY);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function setJournalPin(pin: string, userId: string = getActiveLocalUserId()): { ok: boolean; error?: string } {
  const trimmed = pin.trim();
  if (!/^\d{4,8}$/.test(trimmed)) {
    return { ok: false, error: 'PIN must be 4 to 8 digits.' };
  }
  try {
    const scopedKey = `${PIN_HASH_PREFIX}${userId}`;
    const hashed = computeSaltedHash(trimmed, userId);
    localStorage.setItem(scopedKey, hashed);
    localStorage.removeItem(LEGACY_PIN_KEY);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not save PIN in browser storage.' };
  }
}

export function clearJournalPin(userId: string = getActiveLocalUserId()): void {
  try {
    localStorage.removeItem(`${PIN_HASH_PREFIX}${userId}`);
    localStorage.removeItem(LEGACY_PIN_KEY);
  } catch {
    /* ignore */
  }
}

export function verifyJournalPin(
  pin: string,
  userId: string = getActiveLocalUserId(),
  nowMs: number = Date.now()
): { ok: boolean; error?: string; lockedOutSeconds?: number } {
  try {
    const rawAttempts = localStorage.getItem(PIN_ATTEMPTS_KEY);
    const attemptsMap: Record<string, { count: number; lockUntil: number }> = rawAttempts
      ? JSON.parse(rawAttempts)
      : {};
    const record = attemptsMap[userId] || { count: 0, lockUntil: 0 };

    if (record.lockUntil > nowMs) {
      const lockedOutSeconds = Math.ceil((record.lockUntil - nowMs) / 1000);
      return {
        ok: false,
        lockedOutSeconds,
        error: `Too many failed PIN attempts. Try again in ${lockedOutSeconds}s.`,
      };
    }

    const scopedKey = `${PIN_HASH_PREFIX}${userId}`;
    let stored = localStorage.getItem(scopedKey) || '';
    if (!stored) {
      const legacy = localStorage.getItem(LEGACY_PIN_KEY);
      if (legacy) {
        stored = computeSaltedHash(legacy.trim(), userId);
        localStorage.setItem(scopedKey, stored);
        localStorage.removeItem(LEGACY_PIN_KEY);
      }
    }

    const matches = verifySaltedHash(pin.trim(), stored, userId);
    if (matches) {
      delete attemptsMap[userId];
      localStorage.setItem(PIN_ATTEMPTS_KEY, JSON.stringify(attemptsMap));
      return { ok: true };
    }

    const nextCount = record.count + 1;
    const lockUntil = nextCount >= MAX_PIN_ATTEMPTS ? nowMs + PIN_LOCKOUT_MS : 0;
    attemptsMap[userId] = { count: nextCount >= MAX_PIN_ATTEMPTS ? 0 : nextCount, lockUntil };
    localStorage.setItem(PIN_ATTEMPTS_KEY, JSON.stringify(attemptsMap));

    if (lockUntil > nowMs) {
      return {
        ok: false,
        lockedOutSeconds: Math.ceil(PIN_LOCKOUT_MS / 1000),
        error: 'Too many failed PIN attempts. Locked for 60 seconds.',
      };
    }

    return {
      ok: false,
      error: `Incorrect PIN code (${MAX_PIN_ATTEMPTS - nextCount} attempts remaining).`,
    };
  } catch {
    return { ok: false, error: 'PIN verification failed.' };
  }
}

// --- Timestamp-Aware Conflict Resolution (Safe Local-to-Cloud Merge) ---------

export interface TimestampedRecord {
  id: string;
  updatedAt?: string;
  createdAt?: string;
}

/**
 * Merges local and remote arrays by `id`, always keeping the version with the newer
 * `updatedAt` (or `createdAt`) timestamp, and returning both the merged list and
 * the subset of local records that are newer or missing on the remote server.
 */
export function mergeRecordsByUpdatedAt<T extends TimestampedRecord>(
  localRecords: T[],
  remoteRecords: T[]
): {
  merged: T[];
  toPushToServer: T[];
} {
  const remoteMap = new Map<string, T>();
  for (const r of remoteRecords) {
    if (r && r.id) remoteMap.set(r.id, r);
  }

  const mergedMap = new Map<string, T>();
  for (const [id, r] of remoteMap.entries()) {
    mergedMap.set(id, r);
  }

  const toPushToServer: T[] = [];

  for (const local of localRecords) {
    if (!local || !local.id) continue;
    const remote = remoteMap.get(local.id);
    if (!remote) {
      mergedMap.set(local.id, local);
      toPushToServer.push(local);
      continue;
    }

    const localTs = Date.parse(local.updatedAt || local.createdAt || '') || 0;
    const remoteTs = Date.parse(remote.updatedAt || remote.createdAt || '') || 0;

    if (localTs > remoteTs) {
      mergedMap.set(local.id, { ...remote, ...local });
      toPushToServer.push(local);
    } else {
      mergedMap.set(local.id, { ...local, ...remote });
    }
  }

  const merged = Array.from(mergedMap.values()).sort((a, b) => {
    const tsB = Date.parse(b.createdAt || b.updatedAt || '') || 0;
    const tsA = Date.parse(a.createdAt || a.updatedAt || '') || 0;
    return tsB - tsA;
  });

  return { merged, toPushToServer };
}

// --- User Preferences & Reading Progress Cloud Sync --------------------------

/**
 * Canonical localStorage keys. These are the keys the FEATURES write (verified
 * against Bible.tsx / readingPlans.ts / mockFaithData.ts). Earlier versions of
 * this file synced four unrelated "believers_*" keys that nothing ever wrote,
 * so those datasets silently never reached the server. `LEGACY_SYNC_KEYS` maps
 * the canonical key to the dead key an old build may have populated.
 */
export const PREF_STORAGE_KEYS = {
  readingPlans: 'reading_plans_progress_v1',
  spiritualGoals: 'spiritual_goals_v1',
  reminderPrefs: 'daily_reminder_prefs_v1',
  libraryProgress: 'faith_library_progress',
  bibleHistory: 'bible_history',
  bibleHighlights: 'bible_highlights',
  bibleHighlightColors: 'bible_highlight_colors',
  bibleVerseNotes: 'bible_verse_notes',
  bibleBookmarks: 'bible_bookmarks',
} as const;

const LEGACY_SYNC_KEYS: Record<string, string> = {
  reading_plans_progress_v1: 'believers_reading_plans_v1',
  spiritual_goals_v1: 'believers_spiritual_goals_v1',
  bible_verse_notes: 'bible_verse_notes_v1',
};

/** Snapshot of the last successfully synced copy of each dataset (3-way merge). */
export const PREFS_SNAPSHOT_KEY = 'believers_prefs_snapshot_v1';

function safeParseJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode — local copy stays as it was */
  }
}

/** One-time migration: fold data written by older builds into the canonical keys. */
function migrateLegacyPreferenceKeys(): void {
  for (const [canonical, legacy] of Object.entries(LEGACY_SYNC_KEYS)) {
    try {
      const legacyRaw = localStorage.getItem(legacy);
      if (!legacyRaw) continue;
      const legacyValue = JSON.parse(legacyRaw) as unknown;
      const canonicalRaw = localStorage.getItem(canonical);
      const canonicalValue = canonicalRaw ? JSON.parse(canonicalRaw) : null;
      const isEmptyNow =
        canonicalValue === null ||
        (Array.isArray(canonicalValue) && canonicalValue.length === 0) ||
        (typeof canonicalValue === 'object' &&
          canonicalValue !== null &&
          Object.keys(canonicalValue as object).length === 0);
      if (isEmptyNow && legacyValue !== null && legacyValue !== undefined) {
        localStorage.setItem(canonical, JSON.stringify(legacyValue));
      }
      localStorage.removeItem(legacy);
    } catch {
      localStorage.removeItem(legacy);
    }
  }

  // bible_highlights_v2 stored a ref->color map; the feature keeps a list plus a
  // separate colour map. Convert the map into those two shapes when present.
  try {
    const legacyHighlights = localStorage.getItem('bible_highlights_v2');
    if (legacyHighlights) {
      const map = JSON.parse(legacyHighlights) as Record<string, string>;
      if (map && typeof map === 'object') {
        const currentList = safeParseJson<string[]>(PREF_STORAGE_KEYS.bibleHighlights, []);
        if (currentList.length === 0 && Object.keys(map).length > 0) {
          writeJson(PREF_STORAGE_KEYS.bibleHighlights, Object.keys(map));
        }
        const currentColors = safeParseJson<Record<string, string>>(PREF_STORAGE_KEYS.bibleHighlightColors, {});
        if (Object.keys(currentColors).length === 0) {
          writeJson(PREF_STORAGE_KEYS.bibleHighlightColors, map);
        }
      }
    }
    localStorage.removeItem('bible_highlights_v2');
  } catch {
    localStorage.removeItem('bible_highlights_v2');
  }
}

interface LocalPreferences {
  readingPlans: Record<string, unknown>;
  spiritualGoals: Record<string, unknown>;
  reminderPrefs: Record<string, unknown>;
  libraryProgress: Record<string, number>;
  bibleHistory: string[];
  bibleHighlights: { items: string[]; colors: Record<string, string> };
  bibleNotes: Record<string, string>;
  bibleBookmarks: string[];
}

function readLocalPreferences(): LocalPreferences {
  migrateLegacyPreferenceKeys();
  return {
    readingPlans: safeParseJson<Record<string, unknown>>(PREF_STORAGE_KEYS.readingPlans, {}),
    spiritualGoals: safeParseJson<Record<string, unknown>>(PREF_STORAGE_KEYS.spiritualGoals, {}),
    reminderPrefs: safeParseJson<Record<string, unknown>>(PREF_STORAGE_KEYS.reminderPrefs, {}),
    libraryProgress: safeParseJson<Record<string, number>>(PREF_STORAGE_KEYS.libraryProgress, {}),
    bibleHistory: safeParseJson<string[]>(PREF_STORAGE_KEYS.bibleHistory, []),
    bibleHighlights: {
      items: safeParseJson<string[]>(PREF_STORAGE_KEYS.bibleHighlights, []),
      colors: safeParseJson<Record<string, string>>(PREF_STORAGE_KEYS.bibleHighlightColors, {}),
    },
    bibleNotes: safeParseJson<Record<string, string>>(PREF_STORAGE_KEYS.bibleVerseNotes, {}),
    bibleBookmarks: safeParseJson<string[]>(PREF_STORAGE_KEYS.bibleBookmarks, []),
  };
}

function writeLocalPreferences(prefs: LocalPreferences): void {
  writeJson(PREF_STORAGE_KEYS.readingPlans, prefs.readingPlans);
  writeJson(PREF_STORAGE_KEYS.spiritualGoals, prefs.spiritualGoals);
  writeJson(PREF_STORAGE_KEYS.reminderPrefs, prefs.reminderPrefs);
  writeJson(PREF_STORAGE_KEYS.libraryProgress, prefs.libraryProgress);
  writeJson(PREF_STORAGE_KEYS.bibleHistory, prefs.bibleHistory);
  writeJson(PREF_STORAGE_KEYS.bibleHighlights, prefs.bibleHighlights.items);
  writeJson(PREF_STORAGE_KEYS.bibleHighlightColors, prefs.bibleHighlights.colors);
  writeJson(PREF_STORAGE_KEYS.bibleVerseNotes, prefs.bibleNotes);
  writeJson(PREF_STORAGE_KEYS.bibleBookmarks, prefs.bibleBookmarks);
}

export interface PreferenceSyncResult {
  synced: boolean;
  error?: string;
  /** Datasets where the cloud value won a genuine both-sides-changed collision. */
  conflicts?: string[];
  /** Datasets that were pulled down from the server. */
  pulled?: string[];
}

/**
 * Three-way merges every preference dataset with `public.user_preferences`.
 * - Never pushes a stale local copy over newer cloud data (snapshot comparison).
 * - Never re-writes datasets that did not change (no duplicate writes).
 * - Surfaces server errors instead of claiming success.
 */
export async function syncUserPreferencesWithServer(): Promise<PreferenceSyncResult> {
  if (!isSupabaseConfigured || !supabase) {
    return { synced: false, error: 'Cloud sync is not configured (device-local mode).' };
  }

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user?.id;
    if (!uid) return { synced: false, error: 'Not signed in — sign in to synchronize.' };

    const local = readLocalPreferences();
    const snapshot = safeParseJson<{ datasets?: Partial<LocalPreferences> }>(PREFS_SNAPSHOT_KEY, {}).datasets || {};

    const { data: remoteRow, error: selectErr } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', uid)
      .maybeSingle();

    if (selectErr) {
      recordSyncFailure('preferences', selectErr.message);
      return { synced: false, error: selectErr.message };
    }

    type DatasetKey = keyof LocalPreferences;
    const remoteByDataset: Record<DatasetKey, unknown> = {
      readingPlans: remoteRow?.reading_plans_json ?? null,
      spiritualGoals: remoteRow?.spiritual_goals ?? null,
      reminderPrefs: remoteRow?.reminder_prefs ?? null,
      libraryProgress: remoteRow?.library_progress ?? null,
      bibleHistory: remoteRow?.bible_history ?? null,
      bibleHighlights:
        remoteRow?.bible_highlights && typeof remoteRow.bible_highlights === 'object'
          ? {
              items: (remoteRow.bible_highlights as { items?: string[] }).items || [],
              colors: (remoteRow.bible_highlights as { colors?: Record<string, string> }).colors || {},
            }
          : null,
      bibleNotes: remoteRow?.bible_notes ?? null,
      bibleBookmarks: remoteRow?.bible_bookmarks ?? null,
    };

    const merged = {} as LocalPreferences;
    const conflicts: string[] = [];
    const pulled: string[] = [];
    let needsPush = false;
    let needsLocalWrite = false;

    for (const key of Object.keys(local) as DatasetKey[]) {
      const result = mergePreferenceDataset<LocalPreferences[DatasetKey]>(
        local[key],
        remoteByDataset[key] as LocalPreferences[DatasetKey] | null | undefined,
        (snapshot as Partial<LocalPreferences>)[key]
      );
      (merged as unknown as Record<string, unknown>)[key] = result.merged;
      for (const c of result.conflicts) conflicts.push(`${key}${c ? `.${c}` : ''}`);
      if (result.source === 'local' || result.source === 'merged') needsPush = true;
      if (result.source === 'remote') pulled.push(key);
      if (result.source === 'remote' || result.source === 'merged') needsLocalWrite = true;
    }

    if (needsLocalWrite) writeLocalPreferences(merged);

    if (needsPush) {
      const { error: upsertErr } = await supabase.from('user_preferences').upsert({
        user_id: uid,
        reading_plans_json: merged.readingPlans,
        spiritual_goals: merged.spiritualGoals,
        reminder_prefs: merged.reminderPrefs,
        library_progress: merged.libraryProgress,
        bible_history: merged.bibleHistory,
        bible_highlights: merged.bibleHighlights,
        bible_notes: merged.bibleNotes,
        bible_bookmarks: merged.bibleBookmarks,
        updated_at: new Date().toISOString(),
      });

      if (upsertErr) {
        recordSyncFailure('preferences', upsertErr.message);
        return { synced: false, error: upsertErr.message, conflicts, pulled };
      }
    }

    writeJson(PREFS_SNAPSHOT_KEY, { at: new Date().toISOString(), datasets: merged });
    clearSyncFailure('preferences');
    return { synced: true, conflicts, pulled };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sync failed';
    recordSyncFailure('preferences', message);
    return { synced: false, error: message };
  }
}

// --- Self-Service Account & Personal Data Purge ------------------------------

/**
 * Every user-owned localStorage key the app writes. Kept in one place so the
 * purge cannot drift out of sync with the features again (Phase 4 audit found
 * eleven personal keys — verse notes, highlights, reading plans, goals,
 * community posts, reflections — surviving "permanent deletion").
 */
export const USER_OWNED_LOCAL_KEYS = [
  // journal / prayer / mood
  'journal_entries',
  'journal_prayer_requests',
  'journal_moods',
  'journal_pin_attempts_v1',
  // bible reader
  'bible_bookmarks',
  'bible_history',
  'bible_highlights',
  'bible_highlight_colors',
  'bible_verse_notes',
  // plans / goals / preferences
  'reading_plans_progress_v1',
  'spiritual_goals_v1',
  'daily_reminder_prefs_v1',
  'faith_library_progress',
  PREFS_SNAPSHOT_KEY,
  // devotionals / hymns / library
  'devotional_completed_map',
  'devotional_bookmarks_list',
  'hymn_favorites_list',
  'hymn_recent_ids',
  'hymn_playlist_ids',
  'faith_user_stats_v2',
  'faith_prayer_interactions',
  // community
  'community_posts_v2',
  'community_joined_groups_v1',
  'community_blocked_authors_v1',
  'community_moderation_reports_v1',
  'community_last_action_ts_v1',
  // sync health + legacy dead keys
  'believers_sync_health_v1',
  'believers_reading_plans_v1',
  'believers_spiritual_goals_v1',
  'bible_highlights_v2',
  'bible_verse_notes_v1',
] as const;

/** Removes every key owned by `userId`, including dynamic `reflection-*` keys. */
function purgeLocalOwnedData(userId: string): void {
  // Owner-scoped arrays: keep other users' records; drop unowned legacy rows so
  // pre-ownerId personal data cannot outlive the account that created it.
  for (const key of ['journal_entries', 'journal_prayer_requests'] as const) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as Array<{ ownerId?: string }>;
      if (Array.isArray(parsed)) {
        localStorage.setItem(
          key,
          JSON.stringify(parsed.filter((e) => e.ownerId && e.ownerId !== userId))
        );
      }
    } catch {
      localStorage.removeItem(key);
    }
  }

  clearJournalPin(userId);
  localStorage.removeItem('journal_pin_hash_' + userId);

  for (const key of USER_OWNED_LOCAL_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore individual key failures */
    }
  }

  // Dynamic per-entry reflection keys: `reflection-<entryId>`
  try {
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('reflection-')) doomed.push(key);
    }
    doomed.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }

  // Remove from local user registry
  try {
    const rawUsers = localStorage.getItem('believers_users');
    if (rawUsers) {
      const users = JSON.parse(rawUsers) as Array<{ id?: string }>;
      if (Array.isArray(users)) {
        localStorage.setItem('believers_users', JSON.stringify(users.filter((u) => u.id !== userId)));
      }
    }
  } catch {
    /* ignore */
  }
}

export async function purgeCurrentUserAccountData(userId: string): Promise<{ ok: boolean; error?: string }> {
  let remoteOk = true;
  let remoteError: string | undefined;

  // 1. If connected to Supabase, invoke server-side security-definer purge function
  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase.rpc('delete_own_user_data');
      if (error) {
        remoteOk = false;
        remoteError = error.message;
      }
    } catch {
      remoteOk = false;
      remoteError = 'Could not reach server to delete remote account data.';
    }
  }

  // 2. Purge all user-owned local storage records for this user (always runs so
  //    a failed network call cannot leave private data on the device).
  purgeLocalOwnedData(userId);

  if (!remoteOk) {
    return {
      ok: false,
      error:
        `${remoteError} Your private data was removed from THIS device only. ` +
        'Reconnect and retry to erase it from the server.',
    };
  }

  clearAllSyncFailures();
  return { ok: true };
}
