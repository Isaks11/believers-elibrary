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
  Cloud,
  HardDrive,
  ChevronRight,
} from 'lucide-react'
import { getLibraryItems, getPrayerAlerts, getNewsItems, syncFaithDataFromServer } from '@/data/mockFaithData'
import { getModerationReports } from '@/data/communityData'
import { getRegisteredUsers } from '@/data/userRegistry'
import { listAuditLog } from '@/lib/auditLog'
import { listContent } from '@/lib/contentAdmin'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
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

type SectionDef = {
  key: SectionKey
  label: string
  icon: React.ElementType
  /** Hidden when the current role lacks this permission. */
  action?: PermissionAction
}

const SECTIONS: SectionDef[] = [
  { key: 'devotional', label: 'Devotionals', icon: Sunrise },
  { key: 'reading_plan', label: 'Reading Plans', icon: CalendarRange },
  { key: 'hymn', label: 'Hymns', icon: Music2 },
  { key: 'video', label: 'Videos', icon: Video },
  { key: 'faith_resource', label: 'Faith Resources', icon: HeartHandshake },
  { key: 'library', label: 'Library', icon: BookOpen },
  { key: 'prayers', label: 'Prayer Alerts', icon: Bell },
  { key: 'news', label: 'News', icon: Newspaper },
  { key: 'moderation', label: 'Moderation', icon: ShieldCheck },
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

  // Same bootstrap behaviour as the previous Admin: refresh local stores from
  // the server when possible and count remote profiles when available.
  useEffect(() => {
    syncFaithDataFromServer().then(() => refreshCounts())
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

  // Returning home re-derives the numbers.
  useEffect(() => {
    if (activeSection === null) void refreshCounts()
  }, [activeSection, refreshCounts])

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
        <div className="p-2 bg-primary/10 rounded-xl">
          <LayoutDashboard className="w-5 h-5 text-primary" />
        </div>
      </header>

      {/* Storage honesty banner */}
      {isSupabaseConfigured ? (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] leading-relaxed flex gap-2">
          <Cloud className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            <strong>Cloud CMS.</strong> Supabase is configured — edits are saved to this device
            first, then synced best-effort to Postgres. Apply
            supabase/migrations/20261020_cms_content_and_roles.sql if you have not yet, so the
            5-role model (super_admin · admin · editor · contributor · user) and CMS tables/RLS are
            live on the server.
          </span>
        </div>
      ) : (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-relaxed flex gap-2">
          <HardDrive className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            <strong>Device-local CMS.</strong> Content, revisions and the audit trail live in this
            browser only. Set VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY and apply
            supabase/migrations/20261020_cms_content_and_roles.sql to enable cloud sync, server
            roles and RLS.
          </span>
        </div>
      )}

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
