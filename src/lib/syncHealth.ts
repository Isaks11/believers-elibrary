/**
 * Honest Sync Health Tracking (Phase 4)
 *
 * Phase 1-3 code ended every Supabase write with `.then(() => {})`, which threw
 * away rejections and PostgREST error objects alike. The UI then reported
 * "Cloud synchronization complete" even when RLS had rejected every write.
 *
 * This module gives the app one place to record what has NOT reached the server:
 * - `trackServerWrite(scope, promise)` wraps a supabase-js write, records the
 *   error object (RLS denial, network failure, constraint violation) and keeps
 *   a per-scope failure list in localStorage so the state survives reloads.
 * - `recordSyncFailure/clearSyncFailure` are for pull/sync functions.
 * - `readSyncFailures()` lets Profile/Community show a truthful
 *   "N changes not yet synced" line instead of a false success message.
 *
 * Only scope names and error *messages* are stored — never journal/prayer/user
 * content — so this key stays safe to inspect and is purged on account deletion.
 */

const SYNC_HEALTH_KEY = 'believers_sync_health_v1';

export interface SyncFailure {
  /** Feature scope, e.g. 'journal', 'preferences', 'community', 'admin'. */
  scope: string;
  /** Server/network error message (no user content). */
  message: string;
  /** ISO timestamp of the most recent failure for this scope. */
  at: string;
}

export function readSyncFailures(): SyncFailure[] {
  try {
    const raw = localStorage.getItem(SYNC_HEALTH_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (f): f is SyncFailure =>
        Boolean(f) && typeof f.scope === 'string' && typeof f.message === 'string'
    );
  } catch {
    return [];
  }
}

function writeSyncFailures(list: SyncFailure[]): void {
  try {
    if (list.length === 0) localStorage.removeItem(SYNC_HEALTH_KEY);
    else localStorage.setItem(SYNC_HEALTH_KEY, JSON.stringify(list.slice(0, 50)));
  } catch {
    /* storage unavailable — health tracking is best-effort only */
  }
}

export function recordSyncFailure(scope: string, message: string): void {
  const list = readSyncFailures().filter((f) => f.scope !== scope);
  list.push({ scope, message: message.slice(0, 300), at: new Date().toISOString() });
  writeSyncFailures(list);
}

export function clearSyncFailure(scope: string): void {
  const list = readSyncFailures();
  const next = list.filter((f) => f.scope !== scope);
  if (next.length !== list.length) writeSyncFailures(next);
}

export function clearAllSyncFailures(): void {
  writeSyncFailures([]);
}

export function getSyncHealthSummary(): { pending: number; scopes: string[] } {
  const failures = readSyncFailures();
  return { pending: failures.length, scopes: failures.map((f) => f.scope) };
}

type WriteResult = { error?: { message?: string } | null } | null | undefined;

/**
 * Callback form for already-chained promises: `.then((res) => recordWriteOutcome('journal', res))`.
 * Returns the original result so existing call sites keep working.
 */
export function recordWriteOutcome<T extends WriteResult>(scope: string, result: T): T {
  if (result && result.error) {
    recordSyncFailure(scope, result.error.message || 'Server rejected the write.');
  } else if (result !== null && result !== undefined) {
    clearSyncFailure(scope);
  }
  return result;
}

/** `.catch((err) => recordWriteError('journal', err))` companion for network failures. */
export function recordWriteError(scope: string, err: unknown): void {
  recordSyncFailure(scope, err instanceof Error ? err.message : 'Network error during write.');
}

/**
 * Wraps a supabase-js write builder. Returns the original result (so callers can
 * still inspect `data`) after recording any server-side error. Never throws.
 */
export async function trackServerWrite<T extends WriteResult>(
  scope: string,
  promise: PromiseLike<T>
): Promise<T | null> {
  try {
    const result = await promise;
    if (result && result.error) {
      recordSyncFailure(scope, result.error.message || 'Server rejected the write.');
    } else {
      clearSyncFailure(scope);
    }
    return result ?? null;
  } catch (err) {
    recordSyncFailure(scope, err instanceof Error ? err.message : 'Network error during write.');
    return null;
  }
}
