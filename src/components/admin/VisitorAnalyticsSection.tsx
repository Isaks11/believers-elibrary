import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Users, Eye, Calendar, RefreshCw, BarChart3 } from 'lucide-react'
import { loadVisitorAndUserAnalytics, type VisitorAnalyticsSummary } from '@/lib/visitorAnalytics'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export function VisitorAnalyticsSection() {
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  const [data, setData] = useState<VisitorAnalyticsSummary | null>(null)
  const [selectedYear, setSelectedYear] = useState<number>(currentYear)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const summary = await loadVisitorAndUserAnalytics()
      setData(summary)
      if (summary.years.length > 0 && !summary.years.includes(selectedYear)) {
        setSelectedYear(summary.years[0])
      }
    } finally {
      setLoading(false)
    }
  }, [selectedYear])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const yearStats = data?.byYear[selectedYear]
  const currentMonthBucket = yearStats?.months[currentMonth - 1]
  const maxMonthValue = Math.max(
    1,
    ...(yearStats?.months.map((m) => Math.max(m.visitors, m.users)) ?? [1])
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] uppercase">
            {data?.source === 'cloud' ? 'Cloud Analytics' : 'Device-local Tracking'}
          </Badge>
          <span className="text-xs text-muted-foreground">
            Monthly &amp; yearly users and visitors
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={String(selectedYear)}
            onValueChange={(v) => setSelectedYear(Number(v))}
          >
            <SelectTrigger className="h-8 w-28 text-xs">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {(data?.years ?? [currentYear]).map((yr) => (
                <SelectItem key={yr} value={String(yr)}>
                  {yr}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 px-2.5 gap-1 text-xs"
            onClick={() => void refresh()}
            disabled={loading}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-none shadow-sm bg-primary/10">
          <CardContent className="p-3.5 space-y-1">
            <div className="flex items-center justify-between text-primary">
              <span className="text-[10px] font-bold uppercase">Visitors ({selectedYear})</span>
              <Eye className="w-4 h-4 opacity-80" />
            </div>
            <p className="text-2xl font-bold text-primary">{yearStats?.totalVisitors ?? 0}</p>
            <p className="text-[10px] text-muted-foreground">
              All-time: {data?.totalVisitorsAllTime ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-emerald-500/10">
          <CardContent className="p-3.5 space-y-1">
            <div className="flex items-center justify-between text-emerald-700">
              <span className="text-[10px] font-bold uppercase">New Users ({selectedYear})</span>
              <Users className="w-4 h-4 opacity-80" />
            </div>
            <p className="text-2xl font-bold text-emerald-700">{yearStats?.totalUsers ?? 0}</p>
            <p className="text-[10px] text-muted-foreground">
              All-time: {data?.totalUsersAllTime ?? 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {selectedYear === currentYear && (
        <Card className="border-border/60 bg-secondary/20">
          <CardContent className="p-3 flex items-center justify-between text-xs">
            <span className="font-semibold text-primary flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              {MONTH_NAMES[currentMonth - 1]} {currentYear}
            </span>
            <span className="text-muted-foreground">
              <strong className="text-primary">{currentMonthBucket?.visitors ?? 0}</strong> visitors •{' '}
              <strong className="text-emerald-700">{currentMonthBucket?.users ?? 0}</strong> new users
            </span>
          </CardContent>
        </Card>
      )}

      {/* Monthly Breakdown */}
      <Card className="border-none shadow-sm">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase text-primary flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5" /> Monthly Breakdown ({selectedYear})
            </h3>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-primary inline-block" /> Visitors
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" /> Users
              </span>
            </div>
          </div>

          <div className="space-y-2.5">
            {(yearStats?.months ?? []).map((bucket) => {
              const visitorPct = Math.round((bucket.visitors / maxMonthValue) * 100)
              const userPct = Math.round((bucket.users / maxMonthValue) * 100)
              return (
                <div key={bucket.month} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">{MONTH_NAMES[bucket.month - 1]}</span>
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      <strong className="text-primary">{bucket.visitors}</strong> visitors ·{' '}
                      <strong className="text-emerald-700">{bucket.users}</strong> users
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${bucket.visitors > 0 ? Math.max(4, visitorPct) : 0}%` }}
                      />
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 rounded-full transition-all"
                        style={{ width: `${bucket.users > 0 ? Math.max(4, userPct) : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Yearly Summary */}
      {data && data.years.length > 0 && (
        <Card className="border-none shadow-sm">
          <CardContent className="p-4 space-y-2">
            <h3 className="text-xs font-bold uppercase text-primary">Yearly Summary</h3>
            <div className="divide-y divide-border/50 text-xs">
              {data.years.map((yr) => {
                const row = data.byYear[yr]
                return (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => setSelectedYear(yr)}
                    className="w-full py-2 flex items-center justify-between text-left hover:bg-secondary/30 px-2 rounded-lg transition-colors"
                  >
                    <span className="font-bold text-primary">{yr}</span>
                    <span className="text-muted-foreground tabular-nums">
                      <strong className="text-primary">{row.totalVisitors}</strong> visitors ·{' '}
                      <strong className="text-emerald-700">{row.totalUsers}</strong> users
                    </span>
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
