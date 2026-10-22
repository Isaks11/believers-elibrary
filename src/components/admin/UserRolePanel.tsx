/**
 * Users & Roles panel — honest about what each storage mode can do.
 *
 * Device-local mode: lists the accounts registered on this device
 * (localStorage key `believers_users`, the registry AuthContext uses) and lets
 * an admin change roles through the raw registry + `recordAudit('role_change')`.
 *
 * Supabase mode: READ-ONLY. Roles are enforced server-side by PostgreSQL RLS
 * (`profiles.role`), so changes must be made in SQL — a client can never
 * escalate its own or anyone else's role.
 *
 * Self-promotion is impossible in the UI: any role ranked above the current
 * admin's own role is disabled (ROLE_ORDER defines the ranking).
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Users, ShieldAlert, HardDrive, Cloud, Info } from 'lucide-react'
import { toast } from 'sonner'
import { recordAudit } from '@/lib/auditLog'
import {
  can,
  isHigherRole,
  normalizeRole,
  ROLE_LABELS,
  ROLE_ORDER,
  type UserRole,
} from '@/lib/permissions'
import { useAuth } from '@/contexts/AuthContext'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

/** Registry key shared with src/data/userRegistry.ts / AuthContext. */
const LOCAL_REGISTRY_KEY = 'believers_users'

type LocalAccount = {
  id?: unknown
  name?: unknown
  email?: unknown
  role?: unknown
  createdAt?: unknown
}

type ProfileRow = { id: string; name: string | null; email: string | null; role: string | null }

const ROLE_HINTS: Record<UserRole, string> = {
  user: 'No CMS permissions',
  contributor: 'Create & edit drafts only',
  editor: 'Publish, schedule & archive',
  admin: 'Delete, users, moderation, audit',
  super_admin: 'Everything incl. roles & settings',
}

function readLocalAccounts(): LocalAccount[] {
  try {
    const raw = localStorage.getItem(LOCAL_REGISTRY_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (entry): entry is LocalAccount =>
        Boolean(entry) && typeof entry === 'object' && typeof (entry as LocalAccount).email === 'string'
    )
  } catch {
    return []
  }
}

/** Writes a role straight into the raw registry (the reader narrows roles). */
function writeLocalAccountRole(id: string, role: UserRole): boolean {
  try {
    const parsed = readLocalAccounts() as Array<Record<string, unknown>>
    const idx = parsed.findIndex((entry) => entry.id === id)
    if (idx === -1) return false
    parsed[idx] = { ...parsed[idx], role }
    localStorage.setItem(LOCAL_REGISTRY_KEY, JSON.stringify(parsed))
    return true
  } catch {
    return false
  }
}

export function UserRolePanel() {
  const { user, isRemote, updateProfile } = useAuth()
  const role = user?.role
  const allowed = can(role, 'users:manage')
  const myRole: UserRole = normalizeRole(role, 'user')

  const cloudMode = isSupabaseConfigured && Boolean(supabase)

  const [localTick, setLocalTick] = useState(0)
  const [profiles, setProfiles] = useState<ProfileRow[] | null>(null)
  const [profilesError, setProfilesError] = useState<string | null>(null)
  const [loadingProfiles, setLoadingProfiles] = useState(false)

  const localAccounts = useMemo(() => (cloudMode ? [] : readLocalAccounts()), [cloudMode, localTick])

  const loadProfiles = useCallback(() => {
    if (!cloudMode || !supabase) return
    setLoadingProfiles(true)
    supabase
      .from('profiles')
      .select('id, name, email, role')
      .order('created_at', { ascending: true })
      .limit(100)
      .then(
        ({ data, error }) => {
          setLoadingProfiles(false)
          if (error) {
            setProfilesError(error.message)
            setProfiles(null)
            return
          }
          setProfilesError(null)
          setProfiles((data ?? []) as unknown as ProfileRow[])
        },
        (err) => {
          setLoadingProfiles(false)
          setProfilesError(err instanceof Error ? err.message : 'Could not load profiles')
        }
      )
  }, [cloudMode])

  useEffect(() => {
    if (allowed && cloudMode) loadProfiles()
  }, [allowed, cloudMode, loadProfiles])

  const changeLocalRole = async (target: { id: string; email: string; name: string }, next: UserRole) => {
    if (!can(role, 'roles:manage') && isHigherRole(next, myRole)) {
      // Defense in depth: nobody may grant a role above their own.
      toast.error(`You cannot grant a role higher than your own (${ROLE_LABELS[myRole]})`)
      return
    }

    let fromRole: UserRole
    if (target.id === user?.id) {
      // Self change goes through updateProfile (local-mode-only by design).
      fromRole = myRole
      const res = await updateProfile({ role: next })
      if (!res.ok) {
        toast.error(res.message || 'Could not update your role')
        return
      }
    } else {
      const existing = localAccounts.find((entry) => entry.id === target.id)
      fromRole = normalizeRole(existing?.role, 'user')
      if (!writeLocalAccountRole(target.id, next)) {
        toast.error('That account was not found in the local registry')
        return
      }
    }

    recordAudit(
      { id: user?.id ?? null, role: role ?? 'user' },
      'role_change',
      'role',
      target.id,
      { from: fromRole, to: next, email: target.email }
    )
    setLocalTick((t) => t + 1)
    toast.success(`${target.name || target.email} is now ${ROLE_LABELS[next]}`)
    if (target.id === user?.id && next !== fromRole) {
      toast.info('Your own session role changed — admin sections re-lock to your new role.')
    }
  }

  if (!allowed) {
    return (
      <Card className="border-none shadow-sm">
        <CardContent className="p-6 text-center space-y-3">
          <div className="w-10 h-10 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-bold text-primary">Role management restricted</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Managing users and roles requires the Administrator or Super Administrator role.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Role legend */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold text-primary uppercase">Role Legend</h3>
        <div className="space-y-1.5">
          {ROLE_ORDER.map((r) => (
            <div
              key={r}
              className="flex items-center justify-between gap-2 p-2 rounded-lg bg-secondary/30 border border-border/40"
            >
              <Badge
                variant={r === myRole ? 'default' : 'outline'}
                className="text-[10px] shrink-0"
              >
                {ROLE_LABELS[r]}
                {r === myRole ? ' • you' : ''}
              </Badge>
              <span className="text-[10px] text-muted-foreground text-right">{ROLE_HINTS[r]}</span>
            </div>
          ))}
        </div>
      </div>

      {cloudMode ? (
        // ---------------- Cloud (read-only) ----------------
        <>
          <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-sky-900 text-[11px] leading-relaxed flex gap-2">
            <Cloud className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              <strong>Cloud CMS — roles are server-managed.</strong> Changes happen in SQL against{' '}
              <code>profiles.role</code> and are enforced by PostgreSQL Row Level Security; this
              client cannot escalate or edit roles. Apply{' '}
              <code>supabase/migrations/20261020_cms_content_and_roles.sql</code> for the 5-role
              model (super_admin | admin | editor | contributor | user).
            </span>
          </div>

          {loadingProfiles && <p className="text-xs text-muted-foreground text-center py-4">Loading profiles…</p>}

          {profilesError && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px]">
              Could not load the profiles table ({profilesError}). Roles can still be inspected via
              SQL — the server remains the boundary.
            </div>
          )}

          {profiles && profiles.length === 0 && !loadingProfiles && (
            <p className="text-xs text-muted-foreground text-center py-4">No profiles found.</p>
          )}

          {profiles && profiles.length > 0 && (
            <div className="rounded-xl border border-border/50 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px] uppercase">Name</TableHead>
                    <TableHead className="text-[10px] uppercase">Email</TableHead>
                    <TableHead className="text-[10px] uppercase text-right">Role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.map((profile) => (
                    <TableRow key={profile.id}>
                      <TableCell className="text-xs font-semibold py-2">
                        {profile.name || '—'}
                        {profile.id === user?.id && (
                          <span className="text-[9px] text-muted-foreground"> (you)</span>
                        )}
                      </TableCell>
                      <TableCell className="text-[10px] text-muted-foreground py-2 break-all">
                        {profile.email || '—'}
                      </TableCell>
                      <TableCell className="text-right py-2">
                        <Badge className="text-[9px]" variant="outline">
                          {ROLE_LABELS[normalizeRole(profile.role, 'user')]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1" onClick={loadProfiles}>
            <Info className="w-3.5 h-3.5" /> Refresh profiles
          </Button>
        </>
      ) : (
        // ---------------- Device-local ----------------
        <>
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-relaxed flex gap-2">
            <HardDrive className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              <strong>Device-local mode.</strong> Roles below apply to accounts registered on this
              browser only ({localAccounts.length} found) and are recorded in the audit trail. Roles
              above your own are locked — no admin can grant privileges they do not hold
              {isRemote ? ' (remote session: role edits only affect the local copy)' : ''}.
            </span>
          </div>

          {localAccounts.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              No accounts registered on this device yet.
            </p>
          ) : (
            <div className="space-y-2">
              {localAccounts.map((entry) => {
                const id = String(entry.id || '')
                const email = String(entry.email || '')
                const name = String(entry.name || '') || email
                const entryRole = normalizeRole(entry.role, 'user')
                const isSelf = Boolean(user && id === user.id)
                return (
                  <Card key={id} className="border-none shadow-sm">
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-primary truncate">
                          {name}
                          {isSelf && <span className="text-muted-foreground font-normal"> (you)</span>}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">{email}</p>
                      </div>
                      <Select
                        value={entryRole}
                        onValueChange={(next) =>
                          void changeLocalRole(
                            { id, email, name },
                            next as UserRole
                          )
                        }
                      >
                        <SelectTrigger className="h-8 text-[11px] w-[165px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLE_ORDER.map((r) => {
                            const locked = isHigherRole(r, myRole)
                            return (
                              <SelectItem
                                key={r}
                                value={r}
                                disabled={locked}
                                title={
                                  locked
                                    ? `Locked: you cannot grant a role higher than your own (${ROLE_LABELS[myRole]})`
                                    : undefined
                                }
                              >
                                {ROLE_LABELS[r]}
                              </SelectItem>
                            )
                          })}
                        </SelectContent>
                      </Select>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}

          <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 shrink-0" />
            Every change is recorded via recordAudit(actor, 'role_change', 'role', …) and syncs to
            the server trail when a cloud backend is available.
          </p>
        </>
      )}
    </div>
  )
}
