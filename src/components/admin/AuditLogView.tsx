/**
 * Audit trail viewer (admin+ only — gated by `can(role, 'audit:view')`).
 *
 * Reads the local trail via `listAuditLog` (localStorage-first, newest first)
 * with entity-type / actor / text filters, and is honest about where the data
 * lives: device-local only, or locally + best-effort synced to the `audit_log`
 * table when Supabase is configured.
 */

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ShieldAlert, Search, Cloud, HardDrive } from 'lucide-react'
import { listAuditLog, type AuditEntry, type AuditEntityType } from '@/lib/auditLog'
import { CONTENT_ENTITY_TYPES } from '@/types/content'
import { can } from '@/lib/permissions'
import { useAuth } from '@/contexts/AuthContext'
import { isSupabaseConfigured } from '@/lib/supabase'
import { relativeTime } from '@/components/admin/formatTime'
import { cn } from '@/lib/utils'

const ACTION_STYLES: Record<string, string> = {
  create: 'bg-blue-100 text-blue-800',
  update: 'bg-violet-100 text-violet-800',
  publish: 'bg-emerald-100 text-emerald-800',
  schedule: 'bg-sky-100 text-sky-800',
  unpublish: 'bg-amber-100 text-amber-800',
  archive: 'bg-slate-200 text-slate-700',
  restore: 'bg-teal-100 text-teal-800',
  delete: 'bg-red-100 text-red-800',
  restore_revision: 'bg-indigo-100 text-indigo-800',
  role_change: 'bg-rose-100 text-rose-800',
}

const ENTITY_OPTIONS: Array<'all' | AuditEntityType> = ['all', ...CONTENT_ENTITY_TYPES, 'auth', 'role']

export function AuditLogView() {
  const { user } = useAuth()
  const allowed = can(user?.role, 'audit:view')

  const [entityType, setEntityType] = useState<'all' | AuditEntityType>('all')
  const [actorId, setActorId] = useState('all')
  const [q, setQ] = useState('')
  const [entries, setEntries] = useState<AuditEntry[]>([])

  // Full trail (for the actor facet) — cheap local read.
  const allEntries = useMemo(() => (allowed ? listAuditLog({ limit: 500 }) : []), [allowed, entityType, actorId, q])

  const actorOptions = useMemo(() => {
    const ids = new Set<string>()
    allEntries.forEach((entry) => {
      if (entry.actor_id) ids.add(entry.actor_id)
    })
    return Array.from(ids).sort()
  }, [allEntries])

  useEffect(() => {
    if (!allowed) return
    setEntries(
      listAuditLog({
        entityType: entityType === 'all' ? undefined : entityType,
        actorId: actorId === 'all' ? undefined : actorId,
        q: q.trim() || undefined,
        limit: 100,
      })
    )
  }, [allowed, entityType, actorId, q])

  if (!allowed) {
    return (
      <Card className="border-none shadow-sm">
        <CardContent className="p-6 text-center space-y-3">
          <div className="w-10 h-10 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-bold text-primary">Audit trail restricted</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Viewing the audit log requires the Administrator or Super Administrator role.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Honesty note: where this data actually lives. */}
      <div
        className={cn(
          'p-3 rounded-xl border text-[11px] leading-relaxed flex gap-2',
          isSupabaseConfigured
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
            : 'bg-amber-50 border-amber-200 text-amber-900'
        )}
      >
        {isSupabaseConfigured ? (
          <Cloud className="w-4 h-4 shrink-0 mt-0.5" />
        ) : (
          <HardDrive className="w-4 h-4 shrink-0 mt-0.5" />
        )}
        <span>
          <strong>{isSupabaseConfigured ? 'Synced trail.' : 'Local trail only.'}</strong>{' '}
          {isSupabaseConfigured
            ? 'Entries are written to this device first, then synced best-effort to the audit_log table (RLS-guarded). This view reads the local copy; failed syncs appear in Profile → sync health.'
            : 'Entries live in this browser only (cms_audit_log_v1) and never leave the device. Configure Supabase and apply supabase/migrations/20261020_cms_content_and_roles.sql to sync the trail.'}
        </span>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 gap-2">
        <Select value={entityType} onValueChange={(v) => setEntityType(v as 'all' | AuditEntityType)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Entity" /></SelectTrigger>
          <SelectContent>
            {ENTITY_OPTIONS.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt === 'all' ? 'All entity types' : opt.replace(/_/g, ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={actorId} onValueChange={setActorId}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Actor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actors</SelectItem>
            {actorOptions.map((id) => (
              <SelectItem key={id} value={id}>{id.slice(0, 12)}…</SelectItem>
            ))}
            {actorOptions.length === 0 && (
              <SelectItem value="__none" disabled>No recorded actors</SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search actions, ids, details…"
          className="pl-8 h-9 text-xs"
        />
      </div>

      {/* Entries */}
      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">
          No audit entries match these filters.
        </p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <Card key={entry.id} className="border-none shadow-sm">
              <CardContent className="p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Badge className={cn('text-[9px] px-1.5 py-0', ACTION_STYLES[entry.action] || 'bg-secondary text-secondary-foreground')}>
                      {entry.action.replace(/_/g, ' ')}
                    </Badge>
                    <span className="text-[10px] font-bold text-primary truncate">
                      {entry.entity_type.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <span
                    className="text-[10px] text-muted-foreground shrink-0"
                    title={new Date(entry.created_at).toLocaleString()}
                  >
                    {relativeTime(entry.created_at)}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  by <span className="font-semibold text-foreground/70">{entry.actor_id ? `${entry.actor_id.slice(0, 12)}…` : 'system / guest'}</span>
                  {' • '}<span className="uppercase">{entry.actor_role}</span>
                  {entry.entity_id ? ` • ${entry.entity_id.slice(0, 12)}…` : ''}
                </p>
                {entry.details && (
                  <p className="text-[10px] text-muted-foreground break-all bg-secondary/40 rounded-lg px-2 py-1">
                    {JSON.stringify(entry.details)}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground text-center">
        Showing {entries.length} of {allEntries.length} local entries (max 500 stored on device).
      </p>
    </div>
  )
}
