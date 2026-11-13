/**
 * Users & Roles panel — professionally designed and honest about storage mode.
 *
 * Cloud mode (Supabase configured + real Supabase session):
 * - Lists profiles from Postgres (RLS: admins can read all).
 * - Creates users via the `admin-users` Edge Function (needs service-role key).
 * - Assigns roles through the Edge Function with a direct, RLS-guarded fallback.
 *   PostgreSQL RLS/triggers remain the authoritative boundary.
 *
 * Device-local mode (no Supabase session, e.g. demo/guest/local-only):
 * - Lists and manages accounts in the local registry on this browser.
 * - Role changes and user creation are recorded in the audit trail.
 *
 * Safety: nobody may grant a role above their own unless they hold
 * `roles:manage` (super_admin). Self-escalation is blocked by the UI and by
 * server-side policy/trigger when running against Supabase.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Users,
  UserPlus,
  ShieldAlert,
  HardDrive,
  Cloud,
  Search,
  RefreshCw,
  Trash2,
  Loader2,
  Shield,
  Crown,
  AlertCircle,
} from 'lucide-react'
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
import {
  createServerUser,
  deleteServerUser,
  listServerUsers,
  setServerUserRole,
  type AdminUser,
} from '@/lib/adminUsers'
import { registerUser } from '@/data/userRegistry'

/** Registry key shared with src/data/userRegistry.ts / AuthContext. */
const LOCAL_REGISTRY_KEY = 'believers_users'

type LocalAccount = {
  id?: unknown
  name?: unknown
  email?: unknown
  role?: unknown
  createdAt?: unknown
}

type ManagedUser = {
  id: string
  name: string
  email: string
  role: UserRole
  createdAt: string | null
  isSelf: boolean
}

const ROLE_HINTS: Record<UserRole, string> = {
  user: 'No CMS permissions',
  contributor: 'Create & edit drafts only',
  editor: 'Publish, schedule & archive',
  admin: 'Delete, users, moderation, audit',
  super_admin: 'Everything incl. roles & settings',
}

function roleBadgeClass(r: UserRole): string {
  switch (r) {
    case 'super_admin':
      return 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200'
    case 'admin':
      return 'bg-violet-100 text-violet-800 border-violet-200'
    case 'editor':
      return 'bg-sky-100 text-sky-800 border-sky-200'
    case 'contributor':
      return 'bg-amber-100 text-amber-800 border-amber-200'
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200'
  }
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

function deleteLocalAccount(id: string): boolean {
  try {
    const parsed = readLocalAccounts() as Array<Record<string, unknown>>
    const next = parsed.filter((entry) => entry.id !== id)
    if (next.length === parsed.length) return false
    localStorage.setItem(LOCAL_REGISTRY_KEY, JSON.stringify(next))
    return true
  } catch {
    return false
  }
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString() : '—'
}

function initials(name: string, email: string): string {
  const source = (name || email || '?').trim()
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return source.slice(0, 2).toUpperCase()
}

const emptyCreate = { name: '', email: '', password: '', role: 'user' as UserRole }

export function UserRolePanel() {
  const { user, isRemote, updateProfile } = useAuth()
  const role = user?.role
  const allowed = can(role, 'users:manage')
  const myRole: UserRole = normalizeRole(role, 'user')

  // "Cloud mode" means a real Supabase session that can read/write server data.
  // Demo/local sessions stay in device-local mode even if Supabase is configured.
  const cloudMode = isSupabaseConfigured && Boolean(supabase) && isRemote

  const [localTick, setLocalTick] = useState(0)
  const [serverUsers, setServerUsers] = useState<AdminUser[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all')

  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createForm, setCreateForm] = useState(emptyCreate)

  const [deleteTarget, setDeleteTarget] = useState<ManagedUser | null>(null)
  const [deleting, setDeleting] = useState(false)

  const localAccounts = useMemo(() => (cloudMode ? [] : readLocalAccounts()), [cloudMode, localTick])

  const loadUsers = useCallback(async () => {
    if (!cloudMode) return
    setLoading(true)
    try {
      const res = await listServerUsers()
      if (!res.ok) {
        setError(res.message ?? 'Could not load profiles.')
        setServerUsers(null)
      } else {
        setError(null)
        setServerUsers(res.users ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [cloudMode])

  useEffect(() => {
    if (allowed && cloudMode) void loadUsers()
  }, [allowed, cloudMode, loadUsers])

  const users: ManagedUser[] = useMemo(() => {
    if (cloudMode) {
      return (serverUsers ?? []).map((u) => ({
        id: u.id,
        name: u.name || '',
        email: u.email || '',
        role: normalizeRole(u.role, 'user'),
        createdAt: u.createdAt,
        isSelf: u.id === user?.id,
      }))
    }
    return localAccounts.map((entry) => {
      const id = String(entry.id || '')
      const email = String(entry.email || '')
      const name = String(entry.name || '') || email
      return {
        id,
        name,
        email,
        role: normalizeRole(entry.role, 'user'),
        createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : null,
        isSelf: Boolean(user && id === user.id),
      }
    })
  }, [cloudMode, serverUsers, localAccounts, user?.id])

  const stats = useMemo(() => {
    const total = users.length
    const admins = users.filter((u) => u.role === 'admin' || u.role === 'super_admin').length
    const staff = users.filter((u) => u.role === 'editor' || u.role === 'contributor').length
    const members = users.filter((u) => u.role === 'user').length
    return { total, admins, staff, members }
  }, [users])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false
      if (!q) return true
      return `${u.name} ${u.email} ${u.role}`.toLowerCase().includes(q)
    })
  }, [users, search, roleFilter])

  const changeLocalRole = async (target: ManagedUser, next: UserRole) => {
    let fromRole: UserRole
    if (target.isSelf) {
      fromRole = myRole
      const res = await updateProfile({ role: next })
      if (!res.ok) {
        toast.error(res.message || 'Could not update your role')
        return
      }
    } else {
      const existing = localAccounts.find((entry) => String(entry.id) === target.id)
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
    if (target.isSelf && next !== fromRole) {
      toast.info('Your own session role changed — admin sections re-lock to your new role.')
    }
  }

  const changeRole = async (target: ManagedUser, next: UserRole) => {
    if (next === target.role) return
    if (!can(role, 'roles:manage') && isHigherRole(next, myRole)) {
      toast.error(`You cannot grant a role higher than your own (${ROLE_LABELS[myRole]})`)
      return
    }
    if (cloudMode) {
      if (target.isSelf) {
        toast.error('You cannot change your own role from this panel.')
        return
      }
      const res = await setServerUserRole(target.id, next, { id: user?.id ?? null, role: myRole })
      if (!res.ok) {
        toast.error(res.message || 'Could not update the role')
        return
      }
      recordAudit(
        { id: user?.id ?? null, role: role ?? 'user' },
        'role_change',
        'role',
        target.id,
        { from: target.role, to: next, email: target.email }
      )
      toast.success(res.message || `${target.name || target.email} is now ${ROLE_LABELS[next]}`)
      await loadUsers()
      return
    }
    await changeLocalRole(target, next)
  }

  const submitCreate = async () => {
    const name = createForm.name.trim()
    const email = createForm.email.trim().toLowerCase()
    const password = createForm.password
    const chosenRole = createForm.role

    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      toast.error('Enter a valid email address.')
      return
    }
    const minLen = cloudMode ? 8 : 6
    if (password.length < minLen) {
      toast.error(`Password must be at least ${minLen} characters.`)
      return
    }
    if (!can(role, 'roles:manage') && isHigherRole(chosenRole, myRole)) {
      toast.error(`You cannot grant a role higher than your own (${ROLE_LABELS[myRole]})`)
      return
    }

    setCreating(true)
    try {
      if (cloudMode) {
        const res = await createServerUser({ name, email, password, role: chosenRole })
        if (!res.ok) {
          toast.error(res.message || 'Could not create the user.')
          return
        }
        recordAudit(
          { id: user?.id ?? null, role: role ?? 'user' },
          'create',
          'auth',
          res.user?.id ?? null,
          { email, role: chosenRole, mode: 'cloud' }
        )
        toast.success(res.message || `Account created for ${email}.`)
        await loadUsers()
      } else {
        const id =
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `usr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
        const registered = registerUser({
          id,
          name: name || email.split('@')[0],
          email,
          password,
          role: chosenRole,
        })
        if (!registered) {
          toast.error('Could not create the account on this device.')
          return
        }
        recordAudit(
          { id: user?.id ?? null, role: role ?? 'user' },
          'create',
          'auth',
          registered.id,
          { email, role: chosenRole, mode: 'device-local' }
        )
        toast.success(`Account created on this device for ${email}.`)
        setLocalTick((t) => t + 1)
      }
      setCreateOpen(false)
      setCreateForm(emptyCreate)
    } finally {
      setCreating(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    if (deleteTarget.isSelf) {
      toast.error('You cannot delete your own account.')
      return
    }
    setDeleting(true)
    try {
      if (cloudMode) {
        const res = await deleteServerUser(deleteTarget.id, { id: user?.id ?? null, role: myRole })
        if (!res.ok) {
          toast.error(res.message || 'Could not delete the user.')
          return
        }
        recordAudit(
          { id: user?.id ?? null, role: role ?? 'user' },
          'delete',
          'auth',
          deleteTarget.id,
          { email: deleteTarget.email, mode: 'cloud' }
        )
        toast.success(res.message || 'User deleted.')
        await loadUsers()
      } else {
        if (!deleteLocalAccount(deleteTarget.id)) {
          toast.error('That account was not found.')
          return
        }
        recordAudit(
          { id: user?.id ?? null, role: role ?? 'user' },
          'delete',
          'auth',
          deleteTarget.id,
          { email: deleteTarget.email, mode: 'device-local' }
        )
        toast.success('Local account removed from this device.')
        setLocalTick((t) => t + 1)
      }
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
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

  const renderRoleSelect = (target: ManagedUser) => {
    const selfLocked = cloudMode && target.isSelf
    return (
      <Select
        value={target.role}
        onValueChange={(next) => void changeRole(target, next as UserRole)}
        disabled={selfLocked}
      >
        <SelectTrigger
          className="h-8 text-[11px] w-[160px]"
          title={selfLocked ? 'You cannot change your own role here.' : undefined}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ROLE_ORDER.map((r) => {
            const locked = !can(role, 'roles:manage') && isHigherRole(r, myRole)
            return (
              <SelectItem key={r} value={r} disabled={locked}>
                {ROLE_LABELS[r]}
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>
    )
  }

  return (
    <div className="space-y-4">
      {/* Mode banner */}
      {cloudMode ? (
        <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-sky-900 text-[11px] leading-relaxed flex gap-2">
          <Cloud className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            <strong>Cloud CMS — roles are server-managed.</strong> Profiles come from Supabase and
            permissions are enforced by PostgreSQL Row Level Security. Creating a user requires the{' '}
            <code>admin-users</code> Edge Function (service role). Role changes are verified
            server-side; only Super Administrators can grant or manage the Super Administrator role.
          </span>
        </div>
      ) : (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-relaxed flex gap-2">
          <HardDrive className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            <strong>Device-local mode.</strong> Accounts and roles below apply to this browser’s
            registry only ({users.length} found). Sign in with a Supabase Editor/Admin account to
            manage server users. All changes are recorded in the audit trail.
          </span>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2">
        <Card className="border-none shadow-sm">
          <CardContent className="p-3 text-center">
            <Users className="w-4 h-4 mx-auto text-primary mb-1" />
            <div className="text-lg font-bold text-primary leading-none">{stats.total}</div>
            <div className="text-[9px] uppercase font-semibold text-muted-foreground mt-0.5">Total</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-3 text-center">
            <Crown className="w-4 h-4 mx-auto text-violet-600 mb-1" />
            <div className="text-lg font-bold text-primary leading-none">{stats.admins}</div>
            <div className="text-[9px] uppercase font-semibold text-muted-foreground mt-0.5">Admins</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-3 text-center">
            <Shield className="w-4 h-4 mx-auto text-sky-600 mb-1" />
            <div className="text-lg font-bold text-primary leading-none">{stats.staff}</div>
            <div className="text-[9px] uppercase font-semibold text-muted-foreground mt-0.5">Staff</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-3 text-center">
            <Users className="w-4 h-4 mx-auto text-slate-500 mb-1" />
            <div className="text-lg font-bold text-primary leading-none">{stats.members}</div>
            <div className="text-[9px] uppercase font-semibold text-muted-foreground mt-0.5">Members</div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, or role…"
              className="pl-8 h-9 text-xs"
            />
          </div>
          <Button
            size="sm"
            className="h-9 gap-1.5 shrink-0"
            onClick={() => setCreateOpen(true)}
          >
            <UserPlus className="w-3.5 h-3.5" /> Add user
          </Button>
        </div>
        <div className="flex gap-2 items-center">
          <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as 'all' | UserRole)}>
            <SelectTrigger className="h-8 text-xs flex-1">
              <SelectValue placeholder="Filter by role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              {ROLE_ORDER.map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 shrink-0"
            onClick={() => (cloudMode ? void loadUsers() : setLocalTick((t) => t + 1))}
            disabled={loading}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Role legend */}
      <div className="flex flex-wrap gap-1.5">
        {ROLE_ORDER.map((r) => (
          <div
            key={r}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border bg-background text-[10px]"
            title={ROLE_HINTS[r]}
          >
            <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${roleBadgeClass(r)}`}>
              {ROLE_LABELS[r]}
            </Badge>
            <span className="text-muted-foreground hidden sm:inline">{ROLE_HINTS[r]}</span>
          </div>
        ))}
      </div>

      {/* States */}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading users…
        </div>
      )}

      {error && !loading && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">Could not load users</p>
            <p className="text-[11px] leading-relaxed">{error}</p>
            <p className="text-[10px] text-red-700">
              {cloudMode
                ? 'Check that the database schema/migrations are applied and your account has an admin profile role.'
                : 'Try refreshing or check browser storage permissions.'}
            </p>
          </div>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center space-y-2">
            <Users className="w-8 h-8 mx-auto text-muted-foreground/50" />
            <p className="text-sm font-semibold text-primary">No users found</p>
            <p className="text-xs text-muted-foreground">
              {users.length === 0
                ? cloudMode
                  ? 'No profiles exist yet. Use “Add user” to create the first account.'
                  : 'No accounts are registered on this device yet.'
                : 'Try adjusting your search or role filter.'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Users table */}
      {!loading && filtered.length > 0 && (
        <Card className="border-none shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/30">
                  <TableHead className="text-[10px] uppercase font-bold">User</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold">Role</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold">Joined</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((target) => (
                  <TableRow key={target.id} className={target.isSelf ? 'bg-primary/5' : undefined}>
                    <TableCell className="py-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                          {initials(target.name, target.email)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-primary truncate">
                            {target.name || '—'}
                            {target.isSelf && (
                              <span className="ml-1 text-[10px] font-normal text-muted-foreground">(you)</span>
                            )}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate">{target.email || '—'}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-2.5">
                      <div className="space-y-1">
                        {renderRoleSelect(target)}
                        <Badge variant="outline" className={`text-[9px] ${roleBadgeClass(target.role)}`}>
                          {ROLE_HINTS[target.role]}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="py-2.5 text-[11px] text-muted-foreground whitespace-nowrap">
                      {formatDate(target.createdAt)}
                    </TableCell>
                    <TableCell className="py-2.5 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
                        disabled={target.isSelf}
                        title={target.isSelf ? 'You cannot remove your own account' : 'Remove user'}
                        onClick={() => setDeleteTarget(target)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <p className="text-[10px] text-muted-foreground">
        Showing {filtered.length} of {users.length} user{users.length === 1 ? '' : 's'}. Role
        changes are audited as <code>role_change</code> on the <code>role</code> entity.
      </p>

      {/* Create user dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-4 h-4" /> Add user
            </DialogTitle>
            <DialogDescription>
              {cloudMode
                ? 'Creates a Supabase auth account and profile. Requires the admin-users Edge Function to be deployed with the service role key.'
                : 'Creates an account in this browser’s local registry only.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="new-user-name" className="text-xs">Full name</Label>
              <Input
                id="new-user-name"
                value={createForm.name}
                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Ada Okoro"
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-user-email" className="text-xs">Email address</Label>
              <Input
                id="new-user-email"
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="name@example.com"
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-user-password" className="text-xs">
                Password <span className="text-muted-foreground">(min {cloudMode ? 8 : 6} characters)</span>
              </Label>
              <Input
                id="new-user-password"
                type="password"
                value={createForm.password}
                onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="Set a secure password"
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Role</Label>
              <Select
                value={createForm.role}
                onValueChange={(v) => setCreateForm((f) => ({ ...f, role: v as UserRole }))}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_ORDER.map((r) => {
                    const locked = !can(role, 'roles:manage') && isHigherRole(r, myRole)
                    return (
                      <SelectItem key={r} value={r} disabled={locked}>
                        {ROLE_LABELS[r]} — {ROLE_HINTS[r]}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                You can assign roles up to <strong>{ROLE_LABELS[myRole]}</strong>
                {!can(role, 'roles:manage') ? ' (Super Administrator requires super_admin).' : '.'}
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={() => void submitCreate()} disabled={creating} className="gap-1.5">
              {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
              Create user
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove user?</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `This will remove ${deleteTarget.name || deleteTarget.email} (${deleteTarget.email}). ${
                    cloudMode
                      ? 'The Supabase auth account and profile will be deleted.'
                      : 'The account will be removed from this device’s registry.'
                  }`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void confirmDelete()} disabled={deleting} className="gap-1.5">
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
