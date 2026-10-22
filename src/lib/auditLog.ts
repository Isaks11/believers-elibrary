/**
 * CMS Audit Log (device-local first + best-effort cloud copy).
 *
 * Every content mutation (create / update / publish / schedule / unpublish /
 * archive / restore / delete / restore_revision) and auth/role change is
 * recorded here so admins can answer "who changed what, when".
 *
 * Dual-write, same philosophy as `src/data/mockFaithData.ts`:
 * 1. localStorage FIRST (`cms_audit_log_v1`, newest first, capped at 500) so
 *    the trail works in device-local mode and survives reloads offline.
 * 2. best-effort `audit_log` insert when Supabase is configured. Failures are
 *    routed through `syncHealth` (RLS denial / network) instead of being
 *    swallowed by an empty then-callback, keeping the "N changes not synced"
 *    indicator honest.
 */

import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { recordWriteError, recordWriteOutcome } from '@/lib/syncHealth';
import type { ContentEntityType } from '@/types/content';

export type AuditEntityType = ContentEntityType | 'auth' | 'role';

/** Who performed the action. `id` is the auth user id, or null for system/guest. */
export interface AuditActor {
  id: string | null;
  role: string;
}

export interface AuditEntry {
  id: string;
  actor_id: string | null;
  actor_role: string;
  action: string;
  entity_type: AuditEntityType;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface AuditFilter {
  entityType?: AuditEntityType;
  actorId?: string;
  q?: string;
  limit?: number;
}

export const AUDIT_LOCAL_KEY = 'cms_audit_log_v1';
export const AUDIT_LOG_CAP = 500;

const AUDIT_SCOPE = 'audit';

function newId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `audit-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Legacy tables reference auth.users(uuid); only forward uuid-shaped ids. */
function toServerActorId(value: string | null): string | null {
  return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

function readLocalAuditLog(): AuditEntry[] {
  try {
    const raw = localStorage.getItem(AUDIT_LOCAL_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is AuditEntry =>
        Boolean(entry) && typeof entry.action === 'string' && typeof entry.created_at === 'string'
    );
  } catch {
    return [];
  }
}

/**
 * Records one audit entry. Never throws — the audit trail must never break the
 * mutation that triggered it. Local write is synchronous and authoritative;
 * the cloud copy is best-effort and failure-tracked via syncHealth.
 */
export function recordAudit(
  actor: AuditActor,
  action: string,
  entityType: AuditEntityType,
  entityId: string | null,
  details?: Record<string, unknown>
): void {
  const entry: AuditEntry = {
    id: newId(),
    actor_id: actor.id,
    actor_role: actor.role,
    action,
    entity_type: entityType,
    entity_id: entityId,
    details: details ?? null,
    created_at: new Date().toISOString(),
  };

  // 1. localStorage first — newest first, capped at AUDIT_LOG_CAP entries.
  try {
    const list = [entry, ...readLocalAuditLog()];
    localStorage.setItem(AUDIT_LOCAL_KEY, JSON.stringify(list.slice(0, AUDIT_LOG_CAP)));
  } catch {
    /* storage unavailable — the local trail is best-effort only */
  }

  // 2. best-effort cloud copy, with explicit success/failure handlers.
  if (isSupabaseConfigured && supabase) {
    supabase
      .from('audit_log')
      .insert({
        actor_id: toServerActorId(entry.actor_id),
        actor_role: entry.actor_role,
        action: entry.action,
        entity_type: entry.entity_type,
        entity_id: entry.entity_id,
        details: entry.details,
        created_at: entry.created_at,
      })
      .then(
        (result) => {
          recordWriteOutcome(AUDIT_SCOPE, result);
        },
        (err) => {
          recordWriteError(AUDIT_SCOPE, err);
        }
      );
  }
}

/**
 * Reads the local audit trail (newest first) with optional filtering.
 * Returns at most `limit` entries (default 100).
 */
export function listAuditLog(filter: AuditFilter = {}): AuditEntry[] {
  let entries = readLocalAuditLog();
  if (filter.entityType) {
    entries = entries.filter((entry) => entry.entity_type === filter.entityType);
  }
  if (filter.actorId) {
    entries = entries.filter((entry) => entry.actor_id === filter.actorId);
  }
  if (filter.q) {
    const needle = filter.q.toLowerCase();
    entries = entries.filter((entry) => JSON.stringify(entry).toLowerCase().includes(needle));
  }
  const limit = Math.max(1, filter.limit ?? 100);
  return entries.slice(0, limit);
}

/** Removes the local trail (e.g. privacy purge). The cloud copy is unaffected. */
export function clearLocalAuditLog(): void {
  try {
    localStorage.removeItem(AUDIT_LOCAL_KEY);
  } catch {
    /* storage unavailable — nothing to clear */
  }
}
