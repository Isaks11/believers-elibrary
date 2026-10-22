/**
 * Journal, Personal Prayer Requests, and Mood Log persistence.
 * Uses localStorage for instant offline-first responsiveness and automatically
 * synchronizes with Supabase (`journal_entries`, `prayer_requests`, `mood_logs`)
 * when a remote session is active.
 *
 * Security & Multi-User Isolation (Phase 4):
 * - Entries are scoped by `ownerId` (`getActiveLocalUserId()`) so User B signing in on a shared
 *   browser cannot read or overwrite User A's private journal entries or prayer requests.
 * - Cloud sync uses timestamp-aware conflict resolution (`mergeRecordsByUpdatedAt`) so newer
 *   offline edits are pushed to the server rather than overwritten by older cloud rows.
 */
import { supabase } from '@/lib/supabase';
import { getActiveLocalUserId, mergeRecordsByUpdatedAt } from '@/lib/securityAndSync';
import { recordSyncFailure, clearSyncFailure, recordWriteOutcome, recordWriteError, trackServerWrite } from '@/lib/syncHealth';

export type JournalType = 'Prayer' | 'Gratitude' | 'Dream' | 'Notes';

export const JOURNAL_TYPES: JournalType[] = ['Prayer', 'Gratitude', 'Dream', 'Notes'];

export interface JournalEntry {
  id: string;
  /** User ID of the owner for multi-user browser isolation */
  ownerId?: string;
  title: string;
  body: string;
  type: JournalType;
  /** Optional linked Bible passage or devotional reference */
  scriptureRef?: string;
  devotionalId?: string;
  isPrivate?: boolean;
  /** ISO timestamp */
  createdAt: string;
  /** ISO timestamp */
  updatedAt: string;
}

export type PrayerRequestStatus = 'ongoing' | 'answered';

export interface PersonalPrayerRequest {
  id: string;
  /** User ID of the owner for multi-user browser isolation */
  ownerId?: string;
  title: string;
  body: string;
  category: string;
  status: PrayerRequestStatus;
  scriptureRef?: string;
  createdAt: string;
  updatedAt: string;
  answeredAt?: string;
}

const ENTRIES_KEY = 'journal_entries';
const PRAYERS_KEY = 'journal_prayer_requests';
const MOODS_KEY = 'journal_moods';

// --- Delete tombstones (Phase 4) --------------------------------------------
// Without these, a record deleted on one device (or while offline) is
// resurrected by the next merge because the server copy still exists. A
// tombstone records the intent to delete until the server confirms it.
const TOMBSTONES_KEY = 'journal_delete_tombstones_v1';

export type TombstoneDataset = 'journal_entries' | 'prayer_requests' | 'mood_logs';

interface Tombstones {
  journal_entries?: string[];
  prayer_requests?: string[];
  mood_logs?: string[];
}

function readTombstones(): Tombstones {
  try {
    const raw = localStorage.getItem(TOMBSTONES_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? (parsed as Tombstones) : {};
  } catch {
    return {};
  }
}

function writeTombstones(next: Tombstones): void {
  try {
    localStorage.setItem(TOMBSTONES_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
}

/** Records that `id` was deleted locally and should never be resurrected. */
export function recordTombstone(dataset: TombstoneDataset, id: string): void {
  const next = readTombstones();
  const list = new Set(next[dataset] || []);
  list.add(id);
  next[dataset] = Array.from(list);
  writeTombstones(next);
}

function confirmedTombstones(dataset: TombstoneDataset, ids: string[]): void {
  if (ids.length === 0) return;
  const next = readTombstones();
  const remaining = (next[dataset] || []).filter((id) => !ids.includes(id));
  if (remaining.length === 0) delete next[dataset];
  else next[dataset] = remaining;
  writeTombstones(next);
}

export function getTombstones(dataset: TombstoneDataset): string[] {
  return readTombstones()[dataset] || [];
}

/**
 * Asks the server to apply pending deletions. Returns the ids that are now
 * confirmed gone (removed both from the tombstone list and from the next merge).
 * Failed deletions stay recorded and are retried on the next sync.
 */
async function flushTombstones(uid: string, dataset: TombstoneDataset): Promise<string[]> {
  const pending = getTombstones(dataset);
  if (pending.length === 0 || !supabase) return [];

  try {
    const table =
      dataset === 'journal_entries'
        ? 'journal_entries'
        : dataset === 'prayer_requests'
          ? 'prayer_requests'
          : 'mood_logs';
    const column = dataset === 'mood_logs' ? 'log_date' : 'id';
    const { error } = await supabase
      .from(table)
      .delete()
      .eq('user_id', uid)
      .in(column, pending);
    if (error) {
      recordSyncFailure('journal', `Pending deletions not yet applied on server: ${error.message}`);
      return [];
    }
    confirmedTombstones(dataset, pending);
    clearSyncFailure('journal');
    return pending;
  } catch (err) {
    recordWriteError('journal', err);
    return [];
  }
}

function readAllRawEntries(): JournalEntry[] {
  try {
    const raw = localStorage.getItem(ENTRIES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getJournalEntries(forUserId: string = getActiveLocalUserId()): JournalEntry[] {
  return readAllRawEntries().filter((e) => !e.ownerId || e.ownerId === forUserId);
}

export function saveJournalEntries(
  entries: JournalEntry[],
  forUserId: string = getActiveLocalUserId()
): void {
  try {
    const otherUsersEntries = readAllRawEntries().filter(
      (e) => e.ownerId && e.ownerId !== forUserId
    );
    const tagged = entries.map((e) => ({ ...e, ownerId: e.ownerId || forUserId }));
    localStorage.setItem(ENTRIES_KEY, JSON.stringify([...tagged, ...otherUsersEntries]));
  } catch {
    /* storage unavailable */
  }
}

export function addJournalEntry(input: {
  title: string;
  body: string;
  type: JournalType;
  scriptureRef?: string;
  devotionalId?: string;
  isPrivate?: boolean;
}): JournalEntry {
  const now = new Date().toISOString();
  const activeUserId = getActiveLocalUserId();
  const id =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `jr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const entry: JournalEntry = {
    id,
    ownerId: activeUserId,
    title: input.title.trim(),
    body: input.body.trim(),
    type: input.type,
    ...(input.scriptureRef?.trim() ? { scriptureRef: input.scriptureRef.trim() } : {}),
    ...(input.devotionalId ? { devotionalId: input.devotionalId } : {}),
    ...(input.isPrivate ? { isPrivate: true } : {}),
    createdAt: now,
    updatedAt: now,
  };
  saveJournalEntries([entry, ...getJournalEntries(activeUserId)], activeUserId);

  if (supabase) {
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id;
      if (!uid || !supabase) return;
      supabase
        .from('journal_entries')
        .upsert({
          id: entry.id,
          user_id: uid,
          title: entry.title,
          body: entry.body,
          type: entry.type,
          scripture_ref: entry.scriptureRef ?? null,
          devotional_id: entry.devotionalId ?? null,
          is_private: Boolean(entry.isPrivate),
          created_at: entry.createdAt,
          updated_at: entry.updatedAt,
        })
        .then((res) => recordWriteOutcome('journal', res), (err) => recordWriteError('journal', err));
    });
  }

  return entry;
}

export function updateJournalEntry(
  id: string,
  patch: Partial<Pick<JournalEntry, 'title' | 'body' | 'type' | 'scriptureRef' | 'isPrivate'>>
): JournalEntry[] {
  const now = new Date().toISOString();
  const activeUserId = getActiveLocalUserId();
  const entries = getJournalEntries(activeUserId).map((e) =>
    e.id === id ? { ...e, ...patch, ownerId: activeUserId, updatedAt: now } : e
  );
  saveJournalEntries(entries, activeUserId);

  const updated = entries.find((e) => e.id === id);
  if (supabase && updated) {
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id;
      if (!uid || !supabase) return;
      supabase
        .from('journal_entries')
        .update({
          title: updated.title,
          body: updated.body,
          type: updated.type,
          scripture_ref: updated.scriptureRef ?? null,
          is_private: Boolean(updated.isPrivate),
          updated_at: now,
        })
        .eq('id', id)
        .eq('user_id', uid)
        .then((res) => recordWriteOutcome('journal', res), (err) => recordWriteError('journal', err));
    });
  }

  return entries;
}

export function removeJournalEntry(id: string): JournalEntry[] {
  const activeUserId = getActiveLocalUserId();
  const entries = getJournalEntries(activeUserId).filter((e) => e.id !== id);
  saveJournalEntries(entries, activeUserId);
  recordTombstone('journal_entries', id);

  if (supabase) {
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id;
      if (!uid || !supabase) return;
      supabase.from('journal_entries').delete().eq('id', id).eq('user_id', uid).then((res) => recordWriteOutcome('journal', res), (err) => recordWriteError('journal', err));
    });
  }

  return entries;
}

// --- Personal Prayer Requests ----------------------------------------------

function readAllRawPrayers(): PersonalPrayerRequest[] {
  try {
    const raw = localStorage.getItem(PRAYERS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getPersonalPrayers(
  forUserId: string = getActiveLocalUserId()
): PersonalPrayerRequest[] {
  return readAllRawPrayers().filter((p) => !p.ownerId || p.ownerId === forUserId);
}

export function savePersonalPrayers(
  prayers: PersonalPrayerRequest[],
  forUserId: string = getActiveLocalUserId()
): void {
  try {
    const otherUsersPrayers = readAllRawPrayers().filter(
      (p) => p.ownerId && p.ownerId !== forUserId
    );
    const tagged = prayers.map((p) => ({ ...p, ownerId: p.ownerId || forUserId }));
    localStorage.setItem(PRAYERS_KEY, JSON.stringify([...tagged, ...otherUsersPrayers]));
  } catch {
    /* storage unavailable */
  }
}

export function addPersonalPrayer(input: {
  title: string;
  body: string;
  category: string;
  scriptureRef?: string;
}): PersonalPrayerRequest {
  const now = new Date().toISOString();
  const activeUserId = getActiveLocalUserId();
  const id =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `ppr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const item: PersonalPrayerRequest = {
    id,
    ownerId: activeUserId,
    title: input.title.trim(),
    body: input.body.trim(),
    category: input.category.trim() || 'Personal',
    status: 'ongoing',
    ...(input.scriptureRef?.trim() ? { scriptureRef: input.scriptureRef.trim() } : {}),
    createdAt: now,
    updatedAt: now,
  };
  savePersonalPrayers([item, ...getPersonalPrayers(activeUserId)], activeUserId);

  if (supabase) {
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id;
      if (!uid || !supabase) return;
      supabase
        .from('prayer_requests')
        .upsert({
          id: item.id,
          user_id: uid,
          title: item.title,
          body: item.body,
          category: item.category,
          scripture_ref: item.scriptureRef ?? null,
          status: item.status,
          created_at: item.createdAt,
          updated_at: item.updatedAt,
        })
        .then((res) => recordWriteOutcome('journal', res), (err) => recordWriteError('journal', err));
    });
  }

  return item;
}

export function togglePersonalPrayerStatus(id: string): PersonalPrayerRequest[] {
  const now = new Date().toISOString();
  const activeUserId = getActiveLocalUserId();
  const updatedList = getPersonalPrayers(activeUserId).map((p) => {
    if (p.id !== id) return p;
    const nextStatus: PrayerRequestStatus = p.status === 'ongoing' ? 'answered' : 'ongoing';
    return {
      ...p,
      ownerId: activeUserId,
      status: nextStatus,
      updatedAt: now,
      answeredAt: nextStatus === 'answered' ? now : undefined,
    };
  });
  savePersonalPrayers(updatedList, activeUserId);

  const target = updatedList.find((p) => p.id === id);
  if (supabase && target) {
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id;
      if (!uid || !supabase) return;
      supabase
        .from('prayer_requests')
        .update({
          status: target.status,
          answered_at: target.answeredAt ?? null,
          updated_at: now,
        })
        .eq('id', id)
        .eq('user_id', uid)
        .then((res) => recordWriteOutcome('journal', res), (err) => recordWriteError('journal', err));
    });
  }

  return updatedList;
}

export function removePersonalPrayer(id: string): PersonalPrayerRequest[] {
  const activeUserId = getActiveLocalUserId();
  const updated = getPersonalPrayers(activeUserId).filter((p) => p.id !== id);
  savePersonalPrayers(updated, activeUserId);
  recordTombstone('prayer_requests', id);

  if (supabase) {
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id;
      if (!uid || !supabase) return;
      supabase.from('prayer_requests').delete().eq('id', id).eq('user_id', uid).then((res) => recordWriteOutcome('journal', res), (err) => recordWriteError('journal', err));
    });
  }

  return updated;
}

// --- Mood Logs -------------------------------------------------------------

/** Mood log: one emoji per local day, e.g. { "2026-10-19": "🙏" } */
export function getMoodLogs(): Record<string, string> {
  try {
    const raw = localStorage.getItem(MOODS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveMoodLogs(logs: Record<string, string>): void {
  try {
    localStorage.setItem(MOODS_KEY, JSON.stringify(logs));
  } catch {
    /* storage unavailable */
  }
}

export function setMoodLog(dateKey: string, emoji: string): Record<string, string> {
  const logs = getMoodLogs();
  const removed = logs[dateKey] === emoji;
  if (removed) {
    delete logs[dateKey];
  } else {
    logs[dateKey] = emoji;
  }
  saveMoodLogs(logs);
  if (removed) recordTombstone('mood_logs', dateKey);

  if (supabase) {
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id;
      if (!uid || !supabase) return;
      if (removed) {
        supabase.from('mood_logs').delete().eq('user_id', uid).eq('log_date', dateKey).then((res) => recordWriteOutcome('journal', res), (err) => recordWriteError('journal', err));
      } else {
        supabase
          .from('mood_logs')
          .upsert({ user_id: uid, log_date: dateKey, mood: emoji })
          .then((res) => recordWriteOutcome('journal', res), (err) => recordWriteError('journal', err));
      }
    });
  }

  return logs;
}

export function localDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Bidirectional timestamp-aware synchronization with Supabase (`journal_entries`,
 * `prayer_requests`, `mood_logs`).
 *
 * - Preserves newer offline edits and pushes unsynced local records without
 *   duplicating rows (`mergeRecordsByUpdatedAt`).
 * - Applies pending local deletions (tombstones) before merging so a record
 *   deleted on this device is never resurrected from the cloud.
 * - Returns `error` and records sync-health failures instead of silently
 *   swallowing server/RLS failures and letting the UI claim success.
 */
export interface JournalSyncResult {
  entries: JournalEntry[];
  prayers: PersonalPrayerRequest[];
  moods: Record<string, string>;
  /** Set when the cloud could not be read or written. Local data is still returned. */
  error?: string;
}

export async function syncPersonalJournalFromServer(): Promise<JournalSyncResult> {
  const activeUserId = getActiveLocalUserId();
  const localEntries = getJournalEntries(activeUserId);
  const localPrayers = getPersonalPrayers(activeUserId);
  const localMoods = getMoodLogs();

  if (!supabase) {
    return { entries: localEntries, prayers: localPrayers, moods: localMoods };
  }

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user?.id;
    if (!uid) {
      return { entries: localEntries, prayers: localPrayers, moods: localMoods };
    }

    // 1. Apply deletions performed while offline/signed out, then merge.
    const [deletedEntryIds, deletedPrayerIds, deletedMoodDates] = await Promise.all([
      flushTombstones(uid, 'journal_entries'),
      flushTombstones(uid, 'prayer_requests'),
      flushTombstones(uid, 'mood_logs'),
    ]);

    const [entriesRes, prayersRes, moodsRes] = await Promise.all([
      supabase
        .from('journal_entries')
        .select('*')
        .eq('user_id', uid)
        .order('updated_at', { ascending: false }),
      supabase
        .from('prayer_requests')
        .select('*')
        .eq('user_id', uid)
        .order('updated_at', { ascending: false }),
      supabase.from('mood_logs').select('*').eq('user_id', uid),
    ]);

    const pullErrors: string[] = [];
    if (entriesRes.error) pullErrors.push(`journal entries: ${entriesRes.error.message}`);
    if (prayersRes.error) pullErrors.push(`prayer requests: ${prayersRes.error.message}`);
    if (moodsRes.error) pullErrors.push(`mood log: ${moodsRes.error.message}`);

    const pendingEntryTombstones = getTombstones('journal_entries');
    const pendingPrayerTombstones = getTombstones('prayer_requests');
    const pendingMoodTombstones = getTombstones('mood_logs');

    let mergedEntries = localEntries;
    if (!entriesRes.error && entriesRes.data) {
      const remoteEntries: JournalEntry[] = entriesRes.data
        .map((row: Record<string, unknown>) => ({
          id: String(row.id),
          ownerId: uid,
          title: String(row.title ?? ''),
          body: String(row.body ?? ''),
          type: (row.type as JournalType) || 'Prayer',
          ...(row.scripture_ref ? { scriptureRef: String(row.scripture_ref) } : {}),
          ...(row.devotional_id ? { devotionalId: String(row.devotional_id) } : {}),
          ...(row.is_private ? { isPrivate: Boolean(row.is_private) } : {}),
          createdAt: String(row.created_at ?? new Date().toISOString()),
          updatedAt: String(row.updated_at ?? row.created_at ?? new Date().toISOString()),
        }))
        .filter(
          (e) => !deletedEntryIds.includes(e.id) && !pendingEntryTombstones.includes(e.id)
        );

      const { merged, toPushToServer } = mergeRecordsByUpdatedAt(localEntries, remoteEntries);
      mergedEntries = merged
        .filter((e) => !pendingEntryTombstones.includes(e.id))
        .map((e) => ({ ...e, ownerId: uid }));
      saveJournalEntries(mergedEntries, uid);

      if (toPushToServer.length > 0) {
        const upsertPayload = toPushToServer.map((e) => ({
          id: e.id,
          user_id: uid,
          title: e.title,
          body: e.body,
          type: e.type,
          scripture_ref: e.scriptureRef ?? null,
          devotional_id: e.devotionalId ?? null,
          is_private: Boolean(e.isPrivate),
          created_at: e.createdAt,
          updated_at: e.updatedAt,
        }));
        const pushRes = await trackServerWrite(
          'journal',
          supabase.from('journal_entries').upsert(upsertPayload)
        );
        if (pushRes && pushRes.error) pullErrors.push(`journal push: ${pushRes.error.message}`);
      }
    }

    let mergedPrayers = localPrayers;
    if (!prayersRes.error && prayersRes.data) {
      const remotePrayers: PersonalPrayerRequest[] = prayersRes.data
        .map((row: Record<string, unknown>): PersonalPrayerRequest => ({
          id: String(row.id),
          ownerId: uid,
          title: String(row.title ?? ''),
          body: String(row.body ?? ''),
          category: String(row.category ?? 'Personal'),
          status: row.status === 'answered' ? 'answered' : 'ongoing',
          ...(row.scripture_ref ? { scriptureRef: String(row.scripture_ref) } : {}),
          ...(row.answered_at ? { answeredAt: String(row.answered_at) } : {}),
          createdAt: String(row.created_at ?? new Date().toISOString()),
          updatedAt: String(row.updated_at ?? row.created_at ?? new Date().toISOString()),
        }))
        .filter(
          (p) => !deletedPrayerIds.includes(p.id) && !pendingPrayerTombstones.includes(p.id)
        );

      const { merged, toPushToServer } = mergeRecordsByUpdatedAt(localPrayers, remotePrayers);
      mergedPrayers = merged
        .filter((p) => !pendingPrayerTombstones.includes(p.id))
        .map((p) => ({ ...p, ownerId: uid }));
      savePersonalPrayers(mergedPrayers, uid);

      if (toPushToServer.length > 0) {
        const upsertPayload = toPushToServer.map((p) => ({
          id: p.id,
          user_id: uid,
          title: p.title,
          body: p.body,
          category: p.category,
          scripture_ref: p.scriptureRef ?? null,
          status: p.status,
          answered_at: p.answeredAt ?? null,
          created_at: p.createdAt,
          updated_at: p.updatedAt,
        }));
        const pushRes = await trackServerWrite(
          'journal',
          supabase.from('prayer_requests').upsert(upsertPayload)
        );
        if (pushRes && pushRes.error) pullErrors.push(`prayer push: ${pushRes.error.message}`);
      }
    }

    const remoteMoods: Record<string, string> = {};
    if (!moodsRes.error && moodsRes.data) {
      moodsRes.data.forEach((row: Record<string, unknown>) => {
        if (row.log_date && row.mood) {
          remoteMoods[String(row.log_date)] = String(row.mood);
        }
      });
    }
    // Local entries win for the same day; deleted dates stay deleted.
    const mergedMoods: Record<string, string> = { ...remoteMoods, ...localMoods };
    const allTombstonedDates = [...new Set([...deletedMoodDates, ...pendingMoodTombstones])];
    allTombstonedDates.forEach((d) => delete mergedMoods[d]);
    saveMoodLogs(mergedMoods);

    // Push only moods the cloud does not already hold with the same value.
    const moodPush = Object.entries(localMoods).filter(
      ([date, emoji]) => remoteMoods[date] !== emoji && !allTombstonedDates.includes(date)
    );
    if (!moodsRes.error && moodPush.length > 0) {
      const pushRes = await trackServerWrite(
        'journal',
        supabase
          .from('mood_logs')
          .upsert(moodPush.map(([log_date, mood]) => ({ user_id: uid, log_date, mood })))
      );
      if (pushRes && pushRes.error) pullErrors.push(`mood push: ${pushRes.error.message}`);
    }

    if (pullErrors.length > 0) {
      const message = pullErrors.join(' | ');
      recordSyncFailure('journal', message);
      return { entries: mergedEntries, prayers: mergedPrayers, moods: mergedMoods, error: message };
    }

    clearSyncFailure('journal');
    return { entries: mergedEntries, prayers: mergedPrayers, moods: mergedMoods };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Journal sync failed';
    recordSyncFailure('journal', message);
    return { entries: localEntries, prayers: localPrayers, moods: localMoods, error: message };
  }
}

