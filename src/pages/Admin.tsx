/**
 * Admin CMS shell.
 *
 * A single page (no new routes): a home view with real stat cards, an honest
 * Device-local / Cloud banner and a 2-column grid of sections. Tapping a
 * section swaps the view in local state (with a back button):
 *
 *   Devotionals, Reading Plans, Hymns, Videos, Faith Resources → ContentTypeManager
 *   Library, Prayer Alerts, News, Moderation                  → legacy CRUD (unchanged)
 *   Users & Roles                                             → UserRolePanel
 *   Audit Log                                                 → AuditLogView
 *
 * Every action in the shell is gated by `can(role, …)` from
 * src/lib/permissions.ts (frontend UX only — RLS is the server boundary).
 */

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  LayoutDashboard,
  ArrowLeft,
  BookOpen,
  Bell,
  Newspaper,
  Users,
  ShieldCheck,
  ScrollText,
  Music2,
  Video,
  Sunrise,
  CalendarRange,
  HeartHandshake,
  HardDrive,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Database,
  HandHeart,
  BookMarked,
  BarChart3,
} from 'lucide-react'
import { getLibraryItems, getPrayerAlerts, getNewsItems, syncFaithDataFromServer } from '@/data/mockFaithData'
import { getModerationReports } from '@/data/communityData'
import { getRegisteredUsers } from '@/data/userRegistry'
import { listAuditLog } from '@/lib/auditLog'
import { listContent } from '@/lib/contentAdmin'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { checkBackendHealth, type BackendHealth } from '@/lib/backendHealth'
import { flushOutbox, getOutboxCount } from '@/lib/cmsOutbox'
import { getPendingSyncCount } from '@/lib/syncHealth'
import { can, ROLE_LABELS, type PermissionAction, type UserRole } from '@/lib/permissions'
import type { ContentEntityType } from '@/types/content'
import { useAuth } from '@/contexts/AuthContext'
import { ContentTypeManager } from '@/components/admin/ContentTypeManager'
import {
  LibrarySection,
  PrayerSection,
  NewsSection,
  ModerationSection,
} from '@/components/admin/LegacySections'
import { UserRolePanel } from '@/components/admin/UserRolePanel'
import { AuditLogView } from '@/components/admin/AuditLogView'
import { DonationSettingsSection } from '@/components/admin/DonationSettingsSection'
import { DailyVerseSection } from '@/components/admin/DailyVerseSection'
import { VisitorAnalyticsSection } from '@/components/admin/VisitorAnalyticsSection'
import { recordWriteOutcome, recordWriteError } from '@/lib/syncHealth'
import { cn } from '@/lib/utils'

/** The five CMS-managed content types. */
const CMS_TYPES: ContentEntityType[] = ['devotional', 'reading_plan', 'hymn', 'video', 'faith_resource']

type SectionKey =
  | ContentEntityType
  | 'library'
  | 'prayers'
  | 'news'
  | 'moderation'
  | 'users'
  | 'audit'
  | 'giving'
  | 'daily_verses'
  | 'analytics'

type SectionDef = {
  key: SectionKey
  label: string
  icon: React.ElementType
  /** Hidden when the current role lacks this permission. */
  action?: PermissionAction
}

const SECTIONS: SectionDef[] = [
  { key: 'devotional', label: 'Devotionals', icon: Sunrise },
  { key: 'daily_verses', label: 'Daily Verses', icon: BookMarked },
  { key: 'reading_plan', label: 'Reading Plans', icon: CalendarRange },
  { key: 'hymn', label: 'Hymns', icon: Music2 },
  { key: 'video', label: 'Videos', icon: Video },
  { key: 'faith_resource', label: 'Faith Resources', icon: HeartHandshake },
  { key: 'library', label: 'Library', icon: BookOpen },
  { key: 'prayers', label: 'Prayer Alerts', icon: Bell },
  { key: 'news', label: 'News', icon: Newspaper },
  { key: 'moderation', label: 'Moderation', icon: ShieldCheck },
  { key: 'giving', label: 'Giving / Donations', icon: HandHeart, action: 'users:manage' },
  { key: 'analytics', label: 'Users & Visitors', icon: BarChart3, action: 'analytics:view' },
  { key: 'users', label: 'Users & Roles', icon: Users, action: 'users:manage' },
  { key: 'audit', label: 'Audit Log', icon: ScrollText, action: 'audit:view' },
]

type Counts = Partial<Record<SectionKey, number>>

export function Admin() {
  const { user, isRemote } = useAuth()
  const role = user?.role

  const [activeSection, setActiveSection] = useState<SectionKey | null>(null)
  const [counts, setCounts] = useState<Counts>({})
  const [remoteUserCount, setRemoteUserCount] = useState<number | null>(null)
  const [health, setHealth] = useState<BackendHealth | null>(null)
  const [checkingHealth, setCheckingHealth] = useState(false)
  const [outboxCount, setOutboxCount] = useState(() => getOutboxCount())
  const [pendingSync, setPendingSync] = useState(() => getPendingSyncCount())

  /** Derives every home-view number from real data (stores + listContent). */
  const refreshCounts = useCallback(async () => {
    const next: Counts = {
      library: getLibraryItems().length,
      prayers: getPrayerAlerts().filter((a) => a.status === 'active').length,
      news: getNewsItems().length,
      moderation: getModerationReports().filter((r) => r.status === 'pending').length,
      users: remoteUserCount ?? getRegisteredUsers().length,
      audit: listAuditLog({ limit: 500 }).length,
    }
    try {
      // listContent also auto-publishes scheduled items that are now due.
      const results = await Promise.all(CMS_TYPES.map((type) => listContent(type, { pageSize: 1 })))
      CMS_TYPES.forEach((type, index) => {
        next[type] = results[index].total
      })
    } catch {
      /* fall back to the store-derived counts already in `next` */
    }
    setCounts(next)
  }, [remoteUserCount])

  useEffect(() => {
    void refreshCounts()
  }, [refreshCounts])

  const refreshHealth = useCallback(async () => {
    setCheckingHealth(true)
    try {
      const result = await checkBackendHealth()
      setHealth(result)
    } finally {
      setCheckingHealth(false)
    }
  }, [])

  const refreshSyncStatus = useCallback(() => {
    setOutboxCount(getOutboxCount())
    setPendingSync(getPendingSyncCount())
  }, [])

  // Background bootstrap: refresh stores, flush queued CMS writes, and monitor backend health.
  useEffect(() => {
    void (async () => {
      await flushOutbox()
      refreshSyncStatus()
      await syncFaithDataFromServer()
      await refreshCounts()
    })()
    void refreshHealth()
    if (supabase) {
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .then(({ count, error }) => {
          if (!error && typeof count === 'number') setRemoteUserCount(count)
        })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep sync/health checks running quietly in the background.
  useEffect(() => {
    const tick = () => {
      void (async () => {
        await flushOutbox()
        refreshSyncStatus()
        await refreshHealth()
      })()
    }
    const id = window.setInterval(tick, 60000)
    return () => window.clearInterval(id)
  }, [refreshHealth, refreshSyncStatus])

  // Returning home re-derives the numbers and sync status.
  useEffect(() => {
    if (activeSection === null) {
      void refreshCounts()
      refreshSyncStatus()
      void refreshHealth()
    }
  }, [activeSection, refreshCounts, refreshSyncStatus, refreshHealth])

  useEffect(() => {
    const onChange = () => refreshSyncStatus()
    window.addEventListener('online', onChange)
    window.addEventListener('cms:content-changed', onChange as EventListener)
    return () => {
      window.removeEventListener('online', onChange)
      window.removeEventListener('cms:content-changed', onChange as EventListener)
    }
  }, [refreshSyncStatus])

  const visibleSections = SECTIONS.filter((s) => !s.action || can(role, s.action))

  const sectionDef = activeSection ? SECTIONS.find((s) => s.key === activeSection) : undefined

  const totalCmsContent = CMS_TYPES.reduce((sum, type) => sum + (counts[type] ?? 0), 0)

  const stats: Array<{ label: string; value: number | string; sub?: string; icon: React.ElementType; className: string }> = [
    {
      label: 'CMS Content',
      value: totalCmsContent,
      sub: 'Devotionals · Plans · Hymns · Videos · Resources',
      icon: ScrollText,
      className: 'bg-primary text-primary-foreground',
    },
    {
      label: 'Library Items',
      value: counts.library ?? 0,
      icon: BookOpen,
      className: 'bg-blue-600 text-white',
    },
    {
      label: 'Active Alerts',
      value: counts.prayers ?? 0,
      icon: Bell,
      className: 'bg-emerald-600 text-white',
    },
    {
      label: 'News Articles',
      value: counts.news ?? 0,
      icon: Newspaper,
      className: 'bg-violet-600 text-white',
    },
    {
      label: 'Pending Reports',
      value: counts.moderation ?? 0,
      icon: ShieldCheck,
      className: 'bg-amber-600 text-white',
    },
    {
      label: isRemote ? 'Registered Users' : 'Users (this device)',
      value: counts.users ?? 0,
      icon: Users,
      className: 'bg-rose-600 text-white',
    },
  ]

  const renderSection = () => {
    switch (activeSection) {
      case 'devotional':
      case 'reading_plan':
      case 'hymn':
      case 'video':
      case 'faith_resource':
        return <ContentTypeManager type={activeSection} onChanged={refreshCounts} />
      case 'library':
        return <LibrarySection onChanged={refreshCounts} />
      case 'prayers':
        return <PrayerSection onChanged={refreshCounts} />
      case 'news':
        return <NewsSection onChanged={refreshCounts} />
      case 'moderation':
        return <ModerationSection onChanged={refreshCounts} />
      case 'giving':
        return <DonationSettingsSection />
      case 'daily_verses':
        return <DailyVerseSection />
      case 'analytics':
        return <VisitorAnalyticsSection />
      case 'users':
        return <UserRolePanel />
      case 'audit':
        return <AuditLogView />
      default:
        return null
    }
  }

  // -------------------------------------------------------------------------
  // Section view (opened from the grid)
  // -------------------------------------------------------------------------
  if (activeSection && sectionDef) {
    const SectionIcon = sectionDef.icon
    return (
      <div className="space-y-5 pb-24">
        <header className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => setActiveSection(null)}
            aria-label="Back to Admin home"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl font-serif text-primary truncate flex items-center gap-2">
              <SectionIcon className="w-4 h-4" /> {sectionDef.label}
            </h1>
            <p className="text-[10px] text-muted-foreground font-bold uppercase">
              {counts[activeSection] !== undefined ? `${counts[activeSection]} item${counts[activeSection] === 1 ? '' : 's'}` : 'CMS section'}
            </p>
          </div>
        </header>
        {renderSection()}
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Home view
  // -------------------------------------------------------------------------
  return (
    <div className="space-y-6 pb-24">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-serif text-primary">Admin Control</h1>
          <p className="text-xs text-muted-foreground font-bold uppercase">
            Management Dashboard
            {user ? ` • ${ROLE_LABELS[(role as UserRole) ?? 'user']}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {can(role, 'analytics:view') && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9 gap-1.5 text-xs font-semibold"
              onClick={() => setActiveSection('analytics')}
            >
              <BarChart3 className="w-4 h-4 text-primary" />
              Users &amp; Visitors
            </Button>
          )}
          <div className="p-2 bg-primary/10 rounded-xl">
            <LayoutDashboard className="w-5 h-5 text-primary" />
          </div>
        </div>
      </header>

      {/* Background sync/health status — only surface issues (hidden when connected & healthy). */}
      {(() => {
        const state = health?.state ?? (isSupabaseConfigured ? null : 'local')
        const hasIssues = outboxCount > 0 || pendingSync > 0
        if (state === 'connected' && !hasIssues) return null
        if (!state && !hasIssues) return null

        const tone =
          state === 'connected'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
            : state === 'schema_missing'
              ? 'bg-orange-50 border-orange-200 text-orange-900'
              : state === 'unreachable'
                ? 'bg-red-50 border-red-200 text-red-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
        const Icon =
          state === 'connected'
            ? CheckCircle2
            : state === 'schema_missing'
              ? Database
              : state === 'unreachable'
                ? AlertTriangle
                : HardDrive
        const title =
          state === 'schema_missing'
            ? 'Content service needs setup'
            : state === 'unreachable'
              ? 'Content service unavailable'
              : state === 'local'
                ? 'Saved on this device'
                : 'Updating content'

        return (
          <div className={`p-3 rounded-xl border text-[11px] leading-relaxed space-y-2 ${tone}`}>
            <div className="flex gap-2">
              <Icon className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-bold">{title}</p>
                {state === 'unreachable' && (
                  <p className="mt-0.5">
                    Updates are running in the background. Check your internet connection and try again shortly.
                  </p>
                )}
                {state === 'schema_missing' && (
                  <p className="mt-0.5">
                    Some content features need to be completed before updates can be saved online.
                  </p>
                )}
                {state === 'local' && (
                  <p className="mt-0.5">
                    Your changes are saved on this device. Sign in with your account to keep content available everywhere.
                  </p>
                )}
                {(outboxCount > 0 || pendingSync > 0) && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {outboxCount > 0 && (
                      <Badge variant="secondary" className="text-[10px] bg-white/60">
                        {outboxCount} change{outboxCount === 1 ? '' : 's'} waiting to update
                      </Badge>
                    )}
                    {pendingSync > 0 && (
                      <Badge variant="secondary" className="text-[10px] bg-white/60">
                        {pendingSync} update{pendingSync === 1 ? '' : 's'} pending
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Overview stats (all derived from real data) */}
      <div className="grid grid-cols-2 gap-3">
        {stats.map((stat) => (
          <Card key={stat.label} className={cn(stat.className, 'border-none shadow-lg')}>
            <CardContent className="p-4 space-y-1">
              <stat.icon className="w-5 h-5 opacity-80" />
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="text-[10px] font-bold uppercase opacity-80">{stat.label}</div>
              {stat.sub && <div className="text-[9px] opacity-70 leading-tight">{stat.sub}</div>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Section grid */}
      <div>
        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest pl-1 mb-3">
          CMS Sections
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {visibleSections.map((section) => {
            const SectionIcon = section.icon
            const count = counts[section.key]
            const pending = section.key === 'moderation' && (count ?? 0) > 0
            return (
              <Card
                key={section.key}
                role="button"
                tabIndex={0}
                onClick={() => setActiveSection(section.key)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setActiveSection(section.key)
                  }
                }}
                className="border-none shadow-sm hover:shadow-md transition-all cursor-pointer bg-card hover:bg-primary/5"
              >
                <CardContent className="p-3.5 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <SectionIcon className="w-4 h-4 text-primary" />
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-primary leading-tight">{section.label}</p>
                    <div className="flex items-center gap-1.5">
                      <Badge
                        variant="secondary"
                        className={cn(
                          'text-[9px] px-1.5 py-0',
                          pending && 'bg-amber-100 text-amber-800'
                        )}
                      >
                        {count ?? '—'}
                      </Badge>
                      {pending && (
                        <span className="text-[9px] font-bold text-amber-700 uppercase">pending</span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {visibleSections.length < SECTIONS.length && (
        <p className="text-[10px] text-muted-foreground text-center">
          Some sections are hidden because your role lacks the required permission.
        </p>
      )}
    </div>
  )
}
