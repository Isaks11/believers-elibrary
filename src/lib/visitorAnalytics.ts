import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { getRegisteredUsers } from '@/data/userRegistry'

const LOCAL_VISITS_KEY = 'believers_visitor_analytics_v1'
const SESSION_VISIT_KEY = 'believers_visit_recorded_date'

export interface MonthlyBucket {
  month: number // 1..12
  visitors: number
  users: number
}

export interface YearAnalytics {
  year: number
  totalVisitors: number
  totalUsers: number
  months: MonthlyBucket[]
}

export interface VisitorAnalyticsSummary {
  source: 'cloud' | 'local'
  years: number[]
  byYear: Record<number, YearAnalytics>
  totalUsersAllTime: number
  totalVisitorsAllTime: number
}

type LocalVisitStore = Record<string, { visitors: number; userVisits?: number }>

function readLocalVisits(): LocalVisitStore {
  try {
    const raw = localStorage.getItem(LOCAL_VISITS_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeLocalVisits(store: LocalVisitStore): void {
  try {
    localStorage.setItem(LOCAL_VISITS_KEY, JSON.stringify(store))
  } catch {
    /* ignore quota errors */
  }
}

function emptyYear(year: number): YearAnalytics {
  return {
    year,
    totalVisitors: 0,
    totalUsers: 0,
    months: Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      visitors: 0,
      users: 0,
    })),
  }
}

function parseYearMonth(isoOrDate: string | null | undefined): { year: number; month: number } | null {
  if (!isoOrDate) return null
  const ms = Date.parse(isoOrDate)
  if (!Number.isFinite(ms)) return null
  const d = new Date(ms)
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

/**
 * Records one visit per browser session per calendar day locally and (best-effort)
 * increments the monthly counter in Supabase.
 */
export async function recordAppVisit(isSignedInUser: boolean): Promise<void> {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const todayKey = `${y}-${m}-${d}`
  const ymKey = `${y}-${m}`

  try {
    if (sessionStorage.getItem(SESSION_VISIT_KEY) === todayKey) return
    sessionStorage.setItem(SESSION_VISIT_KEY, todayKey)
  } catch {
    /* sessionStorage unavailable */
  }

  const store = readLocalVisits()
  const prev = store[ymKey] ?? { visitors: 0, userVisits: 0 }
  store[ymKey] = {
    visitors: (prev.visitors || 0) + 1,
    userVisits: (prev.userVisits || 0) + (isSignedInUser ? 1 : 0),
  }
  writeLocalVisits(store)

  if (isSupabaseConfigured && supabase && navigator.onLine) {
    try {
      await supabase.rpc('record_site_visit', { p_is_authenticated: isSignedInUser })
    } catch {
      /* migration may not be applied yet; local stats still recorded */
    }
  }
}

/**
 * Loads registered user counts and visitor counts grouped by year and month.
 */
export async function loadVisitorAndUserAnalytics(): Promise<VisitorAnalyticsSummary> {
  const currentYear = new Date().getFullYear()
  const byYear: Record<number, YearAnalytics> = {
    [currentYear]: emptyYear(currentYear),
  }

  const ensureYear = (year: number): YearAnalytics => {
    if (!byYear[year]) byYear[year] = emptyYear(year)
    return byYear[year]
  }

  let source: 'cloud' | 'local' = 'local'
  let cloudVisitorsLoaded = false
  let cloudUsersLoaded = false

  if (isSupabaseConfigured && supabase) {
    try {
      const { data: visitRows, error: visitErr } = await supabase
        .from('site_visit_monthly')
        .select('year, month, visitor_count')
      if (!visitErr && Array.isArray(visitRows)) {
        cloudVisitorsLoaded = true
        source = 'cloud'
        for (const row of visitRows) {
          const yr = Number(row.year)
          const mo = Number(row.month)
          if (!Number.isFinite(yr) || mo < 1 || mo > 12) continue
          const bucket = ensureYear(yr).months[mo - 1]
          bucket.visitors += Number(row.visitor_count) || 0
        }
      }
    } catch {
      /* fallback to local visits below */
    }

    try {
      const { data: profileRows, error: profileErr } = await supabase
        .from('profiles')
        .select('id, created_at')
      if (!profileErr && Array.isArray(profileRows)) {
        cloudUsersLoaded = true
        source = 'cloud'
        for (const row of profileRows) {
          const ym = parseYearMonth(row.created_at)
          const targetYear = ym?.year ?? currentYear
          const targetMonth = ym?.month ?? 1
          ensureYear(targetYear).months[targetMonth - 1].users += 1
        }
      }
    } catch {
      /* fallback to local users below */
    }
  }

  if (!cloudVisitorsLoaded) {
    const localStore = readLocalVisits()
    for (const [ym, counts] of Object.entries(localStore)) {
      const match = /^(\d{4})-(\d{2})$/.exec(ym)
      if (!match) continue
      const yr = Number(match[1])
      const mo = Number(match[2])
      if (mo < 1 || mo > 12) continue
      ensureYear(yr).months[mo - 1].visitors += Number(counts?.visitors) || 0
    }
  }

  if (!cloudUsersLoaded) {
    for (const u of getRegisteredUsers()) {
      const ym = parseYearMonth(u.createdAt)
      const targetYear = ym?.year ?? currentYear
      const targetMonth = ym?.month ?? 1
      ensureYear(targetYear).months[targetMonth - 1].users += 1
    }
  }

  let totalUsersAllTime = 0
  let totalVisitorsAllTime = 0

  for (const yearData of Object.values(byYear)) {
    yearData.totalVisitors = yearData.months.reduce((sum, m) => sum + m.visitors, 0)
    yearData.totalUsers = yearData.months.reduce((sum, m) => sum + m.users, 0)
    totalVisitorsAllTime += yearData.totalVisitors
    totalUsersAllTime += yearData.totalUsers
  }

  const years = Object.keys(byYear)
    .map(Number)
    .sort((a, b) => b - a)

  return {
    source,
    years,
    byYear,
    totalUsersAllTime,
    totalVisitorsAllTime,
  }
}
