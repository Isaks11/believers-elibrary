/**
 * CMS sync outbox.
 *
 * A failed cloud write is no longer lost: the mutation is queued here and
 * retried when the browser comes back online or the Admin CMS is opened.
 * Entries are de-duplicated per record so a create → update → delete sequence
 * collapses to the final intent.
 *
 * Security: payloads are the same content rows already stored in localStorage;
 * no auth tokens or personal journal data are recorded.
 */

import { isSupabaseConfigured, supabase } from '@/lib/supabase'

export const CMS_OUTBOX_KEY = 'cms_outbox_v1'
const MAX_ENTRIES = 500

export interface CmsOutboxEntry {
  id: string
  op: 'upsert' | 'delete' | 'audit'
  /** CMS entity type, or 'audit' for the audit trail. */
  type: string
  /** PostgREST table name. */
  table: string
  /** Content record id (null for audit entries). */
  recordId: string | null
  payload?: Record<string, unknown>
  createdAt: string
  attempts: number
  lastError?: string
}

export interface OutboxFlushResult {
  flushed: number
  remaining: number
  failed: number
}

function newId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `outbox-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function readOutbox(): CmsOutboxEntry[] {
  try {
    const raw = localStorage.getItem(CMS_OUTBOX_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (entry): entry is CmsOutboxEntry =>
        Boolean(entry) &&
        typeof entry === 'object' &&
        (entry as CmsOutboxEntry).op !== undefined &&
        typeof (entry as CmsOutboxEntry).table === 'string'
    )
  } catch {
    return []
  }
}

function writeOutbox(entries: CmsOutboxEntry[]): void {
  try {
    if (entries.length === 0) localStorage.removeItem(CMS_OUTBOX_KEY)
    else localStorage.setItem(CMS_OUTBOX_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)))
  } catch {
    /* storage unavailable — the queue is best-effort */
  }
}

/** Queues (or replaces) the pending intent for one record. */
export function enqueueOutbox(
  entry: Omit<CmsOutboxEntry, 'id' | 'createdAt' | 'attempts'>
): void {
  const existing = readOutbox().filter(
    (item) =>
      !(
        item.op === entry.op &&
        item.type === entry.type &&
        item.recordId === entry.recordId
      )
  )
  // A record only needs its final state. Replace any earlier op for the same row.
  const withoutRecord = existing.filter(
    (item) => !(item.recordId && item.recordId === entry.recordId && item.table === entry.table)
  )
  writeOutbox([
    ...withoutRecord,
    { ...entry, id: newId(), createdAt: new Date().toISOString(), attempts: 0 },
  ])
}

export function getOutboxCount(): number {
  return readOutbox().length
}

export function clearOutbox(): void {
  writeOutbox([])
}

async function runEntry(entry: CmsOutboxEntry): Promise<string | null> {
  if (!supabase) return 'Supabase is not configured.'
  try {
    if (entry.op === 'delete') {
      const { error } = await supabase.from(entry.table).delete().eq('id', entry.recordId)
      return error ? error.message : null
    }
    if (entry.op === 'audit') {
      const { error } = await supabase.from(entry.table).insert(entry.payload ?? {})
      return error ? error.message : null
    }
    const { error } = await supabase
      .from(entry.table)
      .upsert(entry.payload ?? {}, { onConflict: 'id' })
    return error ? error.message : null
  } catch (err) {
    return err instanceof Error ? err.message : 'Network error while retrying.'
  }
}

/**
 * Retries every queued mutation. Safe to call repeatedly; only reachable when
 * Supabase is configured. Returns how many entries were flushed or remain.
 */
export async function flushOutbox(): Promise<OutboxFlushResult> {
  if (!isSupabaseConfigured || !supabase) {
    return { flushed: 0, remaining: getOutboxCount(), failed: 0 }
  }

  let flushed = 0
  let failed = 0
  const remaining: CmsOutboxEntry[] = []

  for (const entry of readOutbox()) {
    const error = await runEntry(entry)
    if (error) {
      failed += 1
      remaining.push({
        ...entry,
        attempts: entry.attempts + 1,
        lastError: error.slice(0, 300),
      })
    } else {
      flushed += 1
    }
  }

  writeOutbox(remaining)
  return { flushed, remaining: remaining.length, failed }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void flushOutbox()
  })
}
