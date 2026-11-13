/**
 * Audit trail viewer (admin+ only — gated by `can(role, 'audit:view')`).
 *
 * Reads the local audit trail with entity/action/actor/time filters and a
 * professional, scannable presentation. Entries are written locally first and
 * synced best-effort to the `audit_log` table when Supabase is configured.
 */

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ShieldAlert, Search, Cloud, HardDrive, RefreshCw, Activity, User, Clock3, Filter } from 'lucide-react'
import { listAuditLog, type AuditEntry } from '@/lib/auditLog'
import { CONTENT_ENTITY_TYPES } from '@/types/content'
import { can } from '@/lib/permissions'
import { useAuth } from '@/contexts/AuthContext'
import { isSupabaseConfigured } from '@/lib/supabase'

type TimeRange = 'all' | '24h' | '7d' | '30d'

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return iso
  const diff = Date.now() - t
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

function actionTone(action: string): string {
  if (action.includes('delete') || action.includes('remove') || action.includes('fail')) return 'bg-red-50 text-red-700 border-red-200'
  if (action.includes('publish') || action.includes('create') || action.includes('import')) return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (action.includes('update') || action.includes('restore') || action.includes('role')) return 'bg-amber-50 text-amber-700 border-amber-200'
  return 'bg-secondary text-muted-foreground border-border'
}

function formatAction(action: string): string {
  return action.replace(/[._:]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function summarizeDetails(entry: AuditEntry): Array<{ key: string; value: string }> {
  if (!entry.details || typeof entry.details !== 'object') return []
  return Object.entries(entry.details)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .slice(0, 6)
    .map(([k, v]) => ({
      key: k.replace(/_/g, ' '),
      value: typeof v === 'string' ? v : Array.isArray(v) ? v.join(', ') : JSON.stringify(v),
    }))
}

export function AuditLogView() {
  const { user } = useAuth()
  const role = user?.role ?? 'user'
  const allowed = can(role, 'audit:view')
  const cloud = isSupabaseConfigured

  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [entity, setEntity] = useState<string>('all')
  const [actor, setActor] = useState<string>('all')
  const [action, setAction] = useState<string>('all')
  const [range, setRange] = useState<TimeRange>('all')
  const [query, setQuery] = useState('')

  const refresh = () => {
    if (!allowed) return
    setEntries(listAuditLog())
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed])

  const actors = useMemo(() => {
    const ids = Array.from(new Set(entries.map((e) => e.actor_id).filter(Boolean))) as string[]
    ids.sort()
    return ids
  }, [entries])

  const actions = useMemo(() => {
    const vals = Array.from(new Set(entries.map((e) => e.action).filter(Boolean)))
    vals.sort()
    return vals
  }, [entries])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const now = Date.now()
    const minTime =
      range === '24h' ? now - 24 * 60 * 60 * 1000 :
      range === '7d' ? now - 7 * 24 * 60 * 60 * 1000 :
      range === '30d' ? now - 30 * 24 * 60 * 60 * 1000 : 0
    return entries.filter((e) => {
      if (entity !== 'all' && e.entity_type !== entity) return false
      if (actor === '(system)' && e.actor_id) return false
      if (actor !== 'all' && actor !== '(system)' && e.actor_id !== actor) return false
      if (action !== 'all' && e.action !== action) return false
      if (minTime && new Date(e.created_at).getTime() < minTime) return false
      if (q) {
        const hay = `${e.action} ${e.entity_type} ${e.entity_id ?? ''} ${e.actor_id ?? ''} ${JSON.stringify(e.details ?? {})}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [entries, entity, actor, action, range, query])

  const stats = useMemo(() => {
    const now = Date.now()
    const dayAgo = now - 24 * 60 * 60 * 1000
    const uniqueActors = new Set(entries.map((e) => e.actor_id || 'system')).size
    const recent = entries.filter((e) => new Date(e.created_at).getTime() >= dayAgo).length
    return { total: entries.length, recent, uniqueActors, shown: filtered.length }
  }, [entries, filtered])

  if (!allowed) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="p-4 text-sm text-destructive flex items-center gap-2">
          <ShieldAlert className="w-4 h-4" /> You do not have permission to view the audit log.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" /> Audit Log
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Governance trail for content, users, and administrative actions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`text-[10px] gap-1 ${cloud ? 'border-emerald-200 text-emerald-700 bg-emerald-50' : 'border-amber-200 text-amber-700 bg-amber-50'}`}>
            {cloud ? <Cloud className="w-3 h-3" /> : <HardDrive className="w-3 h-3" />}
            {cloud ? 'Cloud-synced (best effort)' : 'Device-local trail'}
          </Badge>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={refresh}>
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <Card className="border-border/60"><CardContent className="p-3"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total entries</p><p className="text-xl font-semibold mt-1">{stats.total}</p></CardContent></Card>
        <Card className="border-border/60"><CardContent className="p-3"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Last 24 hours</p><p className="text-xl font-semibold mt-1">{stats.recent}</p></CardContent></Card>
        <Card className="border-border/60"><CardContent className="p-3"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Unique actors</p><p className="text-xl font-semibold mt-1">{stats.uniqueActors}</p></CardContent></Card>
        <Card className="border-border/60"><CardContent className="p-3"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Matching filters</p><p className="text-xl font-semibold mt-1">{stats.shown}</p></CardContent></Card>
      </div>

      <Card className="border-border/60">
        <CardContent className="p-3 space-y-3">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Filter className="w-3.5 h-3.5" /> Filters
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <div className="relative lg:col-span-2">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search action, entity, actor, details…" className="h-9 pl-8 text-xs" />
            </div>
            <Select value={entity} onValueChange={setEntity}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Entity type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All entities</SelectItem>
                {CONTENT_ENTITY_TYPES.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Action" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                {actions.map((a) => (<SelectItem key={a} value={a}>{formatAction(a)}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={range} onValueChange={(v) => setRange(v as TimeRange)}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Time range" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All time</SelectItem>
                <SelectItem value="24h">Last 24 hours</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
              </SelectContent>
            </Select>
            <Select value={actor} onValueChange={setActor}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Actor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actors</SelectItem>
                <SelectItem value="(system)">System</SelectItem>
                {actors.map((id) => (
                  <SelectItem key={id} value={id} className="font-mono text-[11px]">{id.length > 22 ? `${id.slice(0, 20)}…` : id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Showing {filtered.length} of {entries.length} entries (max 500 stored on device). Entries are written locally and synced to cloud best-effort when configured.
          </p>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <Card className="border-dashed border-border/70">
          <CardContent className="p-8 text-center space-y-1.5">
            <p className="text-sm font-medium text-foreground">No audit activity found</p>
            <p className="text-xs text-muted-foreground">Try adjusting filters or perform an admin action to generate entries.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2.5 max-h-[65vh] overflow-y-auto pr-1">
          {filtered.map((entry) => {
            const details = summarizeDetails(entry)
            return (
              <Card key={entry.id} className="border-border/60 hover:border-border transition-colors">
                <CardContent className="p-3.5">
                  <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 capitalize ${actionTone(entry.action)}`}>{formatAction(entry.action)}</Badge>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{entry.entity_type}</Badge>
                        <span className="text-[10px] font-mono text-muted-foreground truncate">ID: {entry.entity_id ?? '—'}</span>
                      </div>
                      {details.length > 0 && (
                        <div className="grid gap-1 sm:grid-cols-2">
                          {details.map((d) => (
                            <div key={d.key} className="text-[11px] text-muted-foreground bg-secondary/30 rounded-md px-2 py-1 border border-border/40">
                              <span className="font-medium text-foreground/80 capitalize">{d.key}:</span> <span className="break-words">{d.value}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><User className="w-3 h-3" /><span className="font-mono">{entry.actor_id ? `${entry.actor_id.slice(0, 16)}${entry.actor_id.length > 16 ? '…' : ''}` : 'system'}</span></span>
                        <span className="inline-flex items-center gap-1"><Clock3 className="w-3 h-3" />{relativeTime(entry.created_at)}</span>
                      </div>
                    </div>
                    <div className="text-[10px] text-muted-foreground whitespace-nowrap sm:text-right shrink-0">
                      {new Date(entry.created_at).toLocaleString()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
