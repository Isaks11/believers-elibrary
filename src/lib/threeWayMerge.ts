/**
 * Three-way merge for per-user preference datasets (Phase 4).
 *
 * Problem this solves: `syncUserPreferencesWithServer()` used to blindly spread
 * local values over the remote row (`{ ...remote, ...local }`), which silently
 * overwrote newer cloud data written from another device, and could push stale
 * local copies of records the user had already replaced upstream.
 *
 * Strategy: remember a `snapshot` of the last successfully synchronised copy of
 * each dataset in localStorage (`believers_prefs_snapshot_v1`). On the next sync
 * we can therefore tell who changed what:
 *
 *   - only local changed  -> push local
 *   - only remote changed -> pull remote
 *   - neither changed     -> keep as is (no write, no duplication)
 *   - both changed        -> per-key merge; where a single key genuinely changed
 *                            on BOTH sides with different values, the remote
 *                            (cloud) value wins so newer cloud data is never
 *                            overwritten by a stale local copy. Those collisions
 *                            are reported back as `conflicts` so the UI can say
 *                            so honestly instead of pretending a clean merge.
 *
 * This module is intentionally dependency-free and erasable-TypeScript only so
 * it can be imported directly by the Node test runner (`tests/phase4.test.mjs`).
 */

export type MergeSource = 'local' | 'remote' | 'merged' | 'unchanged';

export interface MergeResult<T> {
  merged: T;
  source: MergeSource;
  /** Dot-paths where the cloud value won over an equally-new local value. */
  conflicts: string[];
  /** True when local differs from `merged` (caller should persist locally). */
  localChanged: boolean;
  /** True when remote differs from `merged` (caller should push to server). */
  remoteChanged: boolean;
}

/** Deterministic JSON stringify (sorted object keys) for change detection. */
export function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value as object).length === 0;
  return false;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function dedupeByStable(items: unknown[]): unknown[] {
  const seen = new Set<string>();
  const out: unknown[] = [];
  for (const item of items) {
    const key = stableStringify(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function mergeDeep(
  local: unknown,
  remote: unknown,
  snapshot: unknown,
  path: string,
  conflicts: string[]
): unknown {
  if (stableStringify(local) === stableStringify(remote)) return remote;

  if (Array.isArray(local) && Array.isArray(remote)) {
    return dedupeByStable([...remote, ...local]);
  }

  if (isPlainObject(local) && isPlainObject(remote)) {
    const snapObj = isPlainObject(snapshot) ? snapshot : {};
    const result: Record<string, unknown> = {};
    const keys = new Set([...Object.keys(remote), ...Object.keys(local)]);
    for (const key of keys) {
      const inLocal = key in local;
      const inRemote = key in remote;
      if (inLocal && !inRemote) {
        // Key removed (or never present) upstream: keep the local value unless
        // the local copy is untouched since the snapshot (then honour the delete).
        if (snapshot !== undefined && stableStringify(local[key]) === stableStringify(snapObj[key])) continue;
        result[key] = local[key];
        continue;
      }
      if (inRemote && !inLocal) {
        if (snapshot !== undefined && stableStringify(remote[key]) === stableStringify(snapObj[key])) continue;
        result[key] = remote[key];
        continue;
      }
      const localSameAsSnap = stableStringify(local[key]) === stableStringify(snapObj[key]);
      const remoteSameAsSnap = stableStringify(remote[key]) === stableStringify(snapObj[key]);
      if (localSameAsSnap && !remoteSameAsSnap) {
        result[key] = remote[key]; // only the cloud changed this key
      } else if (!localSameAsSnap && remoteSameAsSnap) {
        result[key] = local[key]; // only this device changed this key
      } else if (localSameAsSnap && remoteSameAsSnap) {
        result[key] = remote[key]; // identical or unknown to snapshot
      } else {
        // Genuinely changed on both sides with different values.
        result[key] = remote[key];
        conflicts.push(path ? `${path}.${key}` : key);
      }
    }
    return result;
  }

  // Primitive / type mismatch: remote wins, but only report a conflict when the
  // local value actually moved away from the snapshot.
  const localSameAsSnap = snapshot !== undefined && stableStringify(local) === stableStringify(snapshot);
  if (!localSameAsSnap) conflicts.push(path);
  return remote;
}

/**
 * Three-way merge of one preference dataset (object, array or primitive).
 * `snapshot` is the value persisted at the last successful sync; `undefined`
 * means we have never synced this dataset before.
 */
export function mergePreferenceDataset<T>(
  local: T,
  remote: T | null | undefined,
  snapshot: T | undefined
): MergeResult<T> {
  const remoteValue: T = remote === null || remote === undefined ? (undefined as unknown as T) : remote;
  const hasRemote = remote !== null && remote !== undefined;

  if (!hasRemote) {
    return {
      merged: local,
      source: isEmpty(local) ? 'unchanged' : 'local',
      conflicts: [],
      localChanged: false,
      remoteChanged: !isEmpty(local),
    };
  }

  const localStr = stableStringify(local);
  const remoteStr = stableStringify(remoteValue);
  const snapshotStr = snapshot === undefined ? undefined : stableStringify(snapshot);

  const localChanged = snapshotStr === undefined ? !isEmpty(local) : localStr !== snapshotStr;
  const remoteChanged = snapshotStr === undefined ? !isEmpty(remoteValue) : remoteStr !== snapshotStr;

  if (!localChanged && !remoteChanged) {
    return { merged: remoteValue, source: 'unchanged', conflicts: [], localChanged: false, remoteChanged: false };
  }
  if (localChanged && !remoteChanged) {
    return { merged: local, source: 'local', conflicts: [], localChanged: true, remoteChanged: true };
  }
  if (!localChanged && remoteChanged) {
    return { merged: remoteValue, source: 'remote', conflicts: [], localChanged: true, remoteChanged: false };
  }

  const conflicts: string[] = [];
  const merged = mergeDeep(local, remoteValue, snapshot, '', conflicts) as T;
  return { merged, source: 'merged', conflicts, localChanged: true, remoteChanged: true };
}

/** Convenience wrapper merging a record of datasets and collecting conflicts. */
export function mergePreferenceSets<
  K extends string,
  D extends Record<string, unknown>
>(
  locals: Record<K, D>,
  remotes: Partial<Record<K, D | null | undefined>>,
  snapshots: Partial<Record<K, D | undefined>>
): {
  merged: Record<K, D>;
  conflicts: string[];
  pushDatasets: K[];
  pullDatasets: K[];
} {
  const merged = {} as Record<K, D>;
  const conflicts: string[] = [];
  const pushDatasets: K[] = [];
  const pullDatasets: K[] = [];

  for (const key of Object.keys(locals) as K[]) {
    const result = mergePreferenceDataset<D>(
      locals[key],
      remotes[key] ?? null,
      snapshots[key]
    );
    merged[key] = result.merged;
    for (const c of result.conflicts) conflicts.push(`${key}${c ? `.${c}` : ''}`);
    if (result.source === 'local' || result.source === 'merged') pushDatasets.push(key);
    if (result.source === 'remote' || result.source === 'merged') pullDatasets.push(key);
  }

  return { merged, conflicts, pushDatasets, pullDatasets };
}
