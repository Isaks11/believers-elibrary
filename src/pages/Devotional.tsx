import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  ChevronLeft, Calendar, CalendarDays, CheckCircle2,
  Lock, Play, Pause, Square, Music2, Share2, Bookmark, BookmarkCheck, Type,
  Heart, NotebookPen, Flame, Mic, BookOpen, Clock, GitBranch, Bell, Compass, ChevronRight
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  BIBLE_VERSIONS, BIBLE_VERSION_LABELS, MONTHS, DEVOTIONAL_YEARS
} from '@/types/devotional-hymn'
import type { DevotionalEntry, BibleVersion } from '@/types/devotional-hymn'
import {
  getDevotionals, updateDevotional,
  getBookmarkedDevotionalIds, getCompletedDevotionalMap,
  saveBookmarkedDevotionalIds, saveCompletedDevotionalMap,
} from '@/data/mockDevotionalHymnData'
import { cmsDevotionalToPageDevotional, loadPublishedDevotionals } from '@/lib/contentSource'
import { computeStreak } from '@/lib/activity'
import { addJournalEntry, getJournalEntries, updateJournalEntry } from '@/data/journalData'
import {
  READING_PLANS,
  getReadingPlansProgress,
  toggleReadingPlanDay,
  getDailyReminderPrefs,
  saveDailyReminderPrefs,
} from '@/data/readingPlans'
import {
  requestNotificationPermission,
  checkAndFireDailyReminder,
  showLocalNotification,
  isStandalonePwa,
} from '@/lib/notifications'

const WEEK_ABBR = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function Devotional() {
  const navigate = useNavigate()
  const [devotionals, setDevotionals] = useState<DevotionalEntry[]>(() => getDevotionals())
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(MONTHS[new Date().getMonth()])
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [planProgress, setPlanProgress] = useState(() => getReadingPlansProgress())
  const [activePlanId, setActivePlanId] = useState<string>(READING_PLANS[0].id)
  const [reminderPrefs, setReminderPrefs] = useState(() => getDailyReminderPrefs())
  const [cmsDevotionals, setCmsDevotionals] = useState<DevotionalEntry[]>([])
  const [cmsDetailId, setCmsDetailId] = useState<string | null>(null)

  // Church-published devotionals for today (CMS). Fetched on mount and again
  // whenever the browsed date changes; contentSource memoizes the result for
  // 5 minutes, and when none exist nothing extra is rendered.
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const rows = await loadPublishedDevotionals()
      if (!cancelled) setCmsDevotionals(rows.map(cmsDevotionalToPageDevotional))
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [year, month, selectedDay])

  const yearMatches = DEVOTIONAL_YEARS.includes(year) ? year : DEVOTIONAL_YEARS[DEVOTIONAL_YEARS.length - 1]

  const monthEntries = useMemo(() => {
    const entries: Record<number, { entry?: DevotionalEntry }> = {}
    const daysInMonth = new Date(year, MONTHS.indexOf(month) + 1, 0).getDate()
    for (let d = 1; d <= daysInMonth; d += 1) {
      entries[d] = { entry: devotionals.find(e => e.year === yearMatches && e.month === month && e.day === d) }
    }
    return entries
  }, [devotionals, year, yearMatches, month])

  const completedCount = Object.values(monthEntries).filter(({ entry }) => entry?.isCompleted).length
  const totalCompletedAllTime = useMemo(() => devotionals.filter(d => d.isCompleted), [devotionals])
  const bookmarkedCount = devotionals.filter(d => d.year === yearMatches && d.month === month && d.isBookmarked).length
  const streak = useMemo(() => computeStreak(), [devotionals, planProgress])

  const selectedEntry = selectedDay ? monthEntries[selectedDay]?.entry : undefined

  const openTodayDevotional = () => {
    const now = new Date()
    const targetYear = DEVOTIONAL_YEARS.includes(now.getFullYear())
      ? now.getFullYear()
      : DEVOTIONAL_YEARS[DEVOTIONAL_YEARS.length - 1]
    setYear(targetYear)
    setMonth(MONTHS[now.getMonth()])
    setSelectedDay(now.getDate())
  }

  // Progress stores are purely id-based (completed: id → date, bookmarks: id[]),
  // so `cms:`-prefixed ids work as keys. updateDevotional() only persists
  // completion for entries known to the local devotional store, so CMS entries
  // write through the shared helpers directly and keep local state in sync.
  const toggleCmsCompletion = (entry: DevotionalEntry) => {
    const completedMap = { ...getCompletedDevotionalMap() }
    if (completedMap[entry.id]) delete completedMap[entry.id]
    else completedMap[entry.id] = new Date().toISOString().slice(0, 10)
    saveCompletedDevotionalMap(completedMap)
    setCmsDevotionals((prev) =>
      prev.map((d) => (d.id === entry.id ? { ...d, isCompleted: Boolean(completedMap[entry.id]) } : d))
    )
  }

  const toggleCmsBookmark = (entry: DevotionalEntry) => {
    const bookmarks = new Set(getBookmarkedDevotionalIds())
    if (bookmarks.has(entry.id)) bookmarks.delete(entry.id)
    else bookmarks.add(entry.id)
    saveBookmarkedDevotionalIds(Array.from(bookmarks))
    const isBookmarked = bookmarks.has(entry.id)
    setCmsDevotionals((prev) =>
      prev.map((d) => (d.id === entry.id ? { ...d, isBookmarked } : d))
    )
    toast.success(isBookmarked ? 'Bookmarked devotional' : 'Removed from favorites')
  }

  const handleTogglePlanDay = (planId: string, dayNumber: number) => {
    const next = toggleReadingPlanDay(planId, dayNumber)
    setPlanProgress({ ...next })
    const done = Boolean(next[planId]?.completedDays?.[dayNumber])
    toast.success(done ? `Day ${dayNumber} completed!` : `Day ${dayNumber} unmarked`)
  }

  const handleToggleReminder = async (enabled: boolean) => {
    if (enabled) {
      const permission = await requestNotificationPermission()
      if (permission === 'granted') {
        const updated = saveDailyReminderPrefs({ ...reminderPrefs, enabled: true })
        setReminderPrefs(updated)
        // Fire immediately if today's scheduled time has already passed,
        // otherwise show a one-off confirmation that reminders are active.
        if (!checkAndFireDailyReminder()) {
          void showLocalNotification(
            'Believers Library Daily Reminder',
            `Daily devotional reminder set for ${updated.time} (${updated.timezone}).`,
            { tag: 'daily-reminder-confirm', url: '/devotional' }
          )
        }
        toast.success(`Reminder enabled for ${updated.time} (${updated.timezone})`)
      } else {
        const updated = saveDailyReminderPrefs({ ...reminderPrefs, enabled: false })
        setReminderPrefs(updated)
        toast.info(
          permission === 'denied'
            ? 'Notifications are blocked for this app. Allow them in your browser/site settings to receive the daily reminder' +
                (isStandalonePwa() ? ' — on iPhone, open Settings ▸ Notifications and enable this app.' : '.')
            : 'Notification permission was not granted, so the reminder was not enabled. You can allow notifications in your browser/site settings' +
                (isStandalonePwa() ? ' — on iPhone, allow them in Settings ▸ Notifications for this app.' : '.')
        )
      }
    } else {
      const updated = saveDailyReminderPrefs({ ...reminderPrefs, enabled: false })
      setReminderPrefs(updated)
      toast.info('Daily reminder paused')
    }
  }

  const handleReminderTimeChange = (time: string) => {
    const updated = saveDailyReminderPrefs({ ...reminderPrefs, time })
    setReminderPrefs(updated)
    toast.success(`Reminder time updated to ${time}`)
  }

  if (selectedDay && selectedEntry) {
    return (
      <DevotionalDetail
        entry={selectedEntry}
        onBack={() => setSelectedDay(null)}
        onToggleComplete={() => {
          const updated = updateDevotional(selectedEntry.id, { isCompleted: !selectedEntry.isCompleted })
          setDevotionals(updated)
        }}
        onToggleBookmark={() => {
          const updated = updateDevotional(selectedEntry.id, { isBookmarked: !selectedEntry.isBookmarked })
          setDevotionals(updated)
          toast.success(selectedEntry.isBookmarked ? 'Removed from favorites' : 'Bookmarked devotional')
        }}
      />
    )
  }

  // Full-screen reading view for a church-published (CMS) devotional — same
  // detail UI as the daily entries, with id-based progress write-through.
  const cmsSelectedEntry = cmsDetailId
    ? cmsDevotionals.find((entry) => entry.id === cmsDetailId)
    : undefined

  if (cmsDetailId && cmsSelectedEntry) {
    return (
      <DevotionalDetail
        entry={cmsSelectedEntry}
        onBack={() => setCmsDetailId(null)}
        onToggleComplete={() => toggleCmsCompletion(cmsSelectedEntry)}
        onToggleBookmark={() => toggleCmsBookmark(cmsSelectedEntry)}
      />
    )
  }

  const activePlan = READING_PLANS.find((p) => p.id === activePlanId) || READING_PLANS[0]
  const activePlanCompletedMap = planProgress[activePlan.id]?.completedDays || {}
  const activePlanDoneCount = Object.keys(activePlanCompletedMap).length

  return (
    <div className="space-y-6 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif text-primary">Spiritual Growth</h1>
          <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">
            Devotionals • Reading Plans • Reminders
          </p>
        </div>
        <div className="flex items-center gap-2 bg-accent/20 px-3 py-1.5 rounded-full border border-accent/30">
          <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
          <span className="text-sm font-bold text-primary">{streak}</span>
          <span className="text-[10px] text-muted-foreground font-medium">streak</span>
        </div>
      </header>

      <Tabs defaultValue="calendar" className="w-full">
        <TabsList className="w-full bg-muted/50 p-1 rounded-xl grid grid-cols-3">
          <TabsTrigger value="calendar" className="text-xs rounded-lg">Daily Word</TabsTrigger>
          <TabsTrigger value="plans" className="text-xs rounded-lg">Reading Plans</TabsTrigger>
          <TabsTrigger value="reminders" className="text-xs rounded-lg">Reminders</TabsTrigger>
        </TabsList>

        {/* TAB 1: DAILY CALENDAR */}
        <TabsContent value="calendar" className="pt-4 space-y-5">
          {/* Church-published (CMS) devotionals for today — rendered only when
              the CMS actually has content, so an empty CMS looks unchanged. */}
          {cmsDevotionals.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  From your church
                </h3>
                <Badge variant="secondary" className="text-[9px] px-1.5 py-0">Today</Badge>
              </div>
              {cmsDevotionals.map((entry) => (
                <Card
                  key={entry.id}
                  onClick={() => setCmsDetailId(entry.id)}
                  className="border-none shadow-sm bg-primary/5 hover:shadow-md cursor-pointer transition-all"
                >
                  <CardContent className="p-4 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-accent">
                        {entry.scriptureRef}
                      </span>
                      {entry.isCompleted && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      )}
                    </div>
                    <h4 className="text-sm font-bold text-primary">{entry.title}</h4>
                    <p className="text-xs text-muted-foreground line-clamp-2">{entry.keyThought}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Button
            onClick={openTodayDevotional}
            className="w-full justify-between h-12 rounded-2xl bg-primary text-primary-foreground shadow-md"
          >
            <span className="flex items-center gap-2 font-bold text-sm">
              <BookOpen className="w-4 h-4" /> Open Today’s Devotional
            </span>
            <ChevronRight className="w-4 h-4" />
          </Button>

          {/* Year Selector */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> Year
            </span>
            {DEVOTIONAL_YEARS.map(y => (
              <button
                key={y}
                onClick={() => setYear(y)}
                className={cn(
                  'px-4 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95',
                  year === y ? 'bg-primary text-primary-foreground shadow-lg' : 'bg-secondary/40 text-primary hover:bg-secondary/60'
                )}
              >
                {y}
              </button>
            ))}
          </div>

          {/* Month Scroller */}
          <div className="flex overflow-x-auto gap-2 no-scrollbar pb-2 -mx-4 px-4">
            {MONTHS.map(m => (
              <button
                key={m}
                onClick={() => setMonth(m)}
                className={cn(
                  'px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-all active:scale-95 border',
                  month === m ? 'bg-primary text-primary-foreground border-primary shadow-lg' : 'bg-card text-primary border-border/40 hover:border-primary/30'
                )}
              >
                {m.slice(0, 3)}
              </button>
            ))}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="bg-secondary/30 border-none shadow-sm">
              <CardContent className="p-3 flex flex-col items-center gap-0.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="text-lg font-bold text-primary">{completedCount}</span>
                <span className="text-[9px] uppercase font-bold text-muted-foreground">This Month</span>
              </CardContent>
            </Card>
            <Card className="bg-accent/10 border-none shadow-sm">
              <CardContent className="p-3 flex flex-col items-center gap-0.5">
                <Bookmark className="w-4 h-4 text-accent" />
                <span className="text-lg font-bold text-primary">{bookmarkedCount}</span>
                <span className="text-[9px] uppercase font-bold text-muted-foreground">Saved</span>
              </CardContent>
            </Card>
            <Card className="bg-primary text-primary-foreground border-none shadow-sm">
              <CardContent className="p-3 flex flex-col items-center gap-0.5">
                <Flame className="w-4 h-4 fill-orange-400 text-orange-400" />
                <span className="text-lg font-bold">{streak}</span>
                <span className="text-[9px] uppercase font-bold opacity-80">Day Streak</span>
              </CardContent>
            </Card>
          </div>

          {/* Weekday header */}
          <div className="grid grid-cols-7 gap-1.5">
            {WEEK_ABBR.map(d => (
              <span key={d} className="text-center text-[10px] font-bold uppercase text-muted-foreground">{d}</span>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="space-y-2">
            {Array.from({
              length: Math.ceil(((new Date(year, MONTHS.indexOf(month), 1).getDay() + 6) % 7 + Object.keys(monthEntries).length) / 7)
            }).map((_, w) => {
              const startOffset = (new Date(year, MONTHS.indexOf(month), 1).getDay() + 6) % 7
              const today = new Date()
              const isCurrentMonth = today.getFullYear() === year && today.getMonth() === MONTHS.indexOf(month)
              return (
                <div key={w} className="grid grid-cols-7 gap-1.5">
                  {Array.from({ length: 7 }, (_, i) => {
                    const dayNum = w * 7 + i - startOffset + 1
                    const slot = monthEntries[dayNum]
                    const isToday = isCurrentMonth && today.getDate() === dayNum
                    if (!slot) return <div key={i} />
                    const isCompleted = slot.entry?.isCompleted
                    const hasEntry = Boolean(slot.entry)
                    const isFuture = new Date(year, MONTHS.indexOf(month), dayNum).getTime() > today.getTime()
                    return (
                      <button
                        key={i}
                        onClick={() => hasEntry && setSelectedDay(dayNum)}
                        className={cn(
                          'aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 border transition-all relative',
                          hasEntry ? 'cursor-pointer hover:scale-105 active:scale-95' : 'opacity-30',
                          isToday
                            ? 'border-primary bg-primary text-primary-foreground shadow-lg'
                            : isCompleted
                              ? 'border-secondary/50 bg-secondary/40 text-primary'
                              : 'border-border/40 bg-card text-primary',
                          isFuture && hasEntry ? 'opacity-70' : ''
                        )}
                      >
                        {isCompleted && <CheckCircle2 className="w-3 h-3 text-emerald-500 absolute top-1 right-1" />}
                        {!hasEntry && isFuture && <Lock className="w-3 h-3 text-muted-foreground absolute top-1 right-1" />}
                        <span className="text-sm font-bold">{dayNum}</span>
                        {hasEntry && <span className="text-[7px] uppercase font-bold opacity-60 leading-none">Dev</span>}
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-4 text-[10px] text-muted-foreground font-medium">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-secondary/40 border border-secondary/50 inline-block" /> Completed</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-primary inline-block" /> Today</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-card border border-border/40 inline-block" /> Available</span>
          </div>
        </TabsContent>

        {/* TAB 2: READING PLANS */}
        <TabsContent value="plans" className="pt-4 space-y-5">
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {READING_PLANS.map((plan) => {
              const done = Object.keys(planProgress[plan.id]?.completedDays || {}).length
              const active = plan.id === activePlan.id
              return (
                <button
                  key={plan.id}
                  onClick={() => setActivePlanId(plan.id)}
                  className={cn(
                    'p-3 rounded-2xl border text-left min-w-[210px] transition-all shrink-0',
                    active
                      ? 'bg-primary text-primary-foreground border-primary shadow-lg'
                      : 'bg-card text-primary border-border/50 hover:border-primary/40'
                  )}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                      {plan.category}
                    </Badge>
                    <span className="text-[10px] font-bold opacity-80">
                      {done}/{plan.days.length} days
                    </span>
                  </div>
                  <h4 className="text-xs font-bold line-clamp-1">{plan.title}</h4>
                </button>
              )
            })}
          </div>

          <Card className="border-none shadow-sm bg-secondary/20">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-serif font-bold text-primary text-base">{activePlan.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{activePlan.subtitle}</p>
                </div>
                <Badge className="bg-emerald-100 text-emerald-800 border-none text-[10px] shrink-0">
                  {Math.round((activePlanDoneCount / activePlan.days.length) * 100)}%
                </Badge>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${(activePlanDoneCount / activePlan.days.length) * 100}%` }}
                />
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            {activePlan.days.map((d) => {
              const isDone = Boolean(activePlanCompletedMap[d.dayNumber])
              return (
                <Card
                  key={d.dayNumber}
                  className={cn(
                    'border-none shadow-sm transition-all',
                    isDone ? 'bg-emerald-50/40 border-l-4 border-l-emerald-500' : 'bg-card'
                  )}
                >
                  <CardContent className="p-4 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleTogglePlanDay(activePlan.id, d.dayNumber)}
                          className={cn(
                            'w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors shrink-0',
                            isDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-muted-foreground/40'
                          )}
                          aria-label={`Mark Day ${d.dayNumber} complete`}
                        >
                          {isDone && <CheckCircle2 className="w-4 h-4" />}
                        </button>
                        <div>
                          <span className="text-[10px] font-bold uppercase text-muted-foreground block">
                            Day {d.dayNumber} • {d.scriptureRef}
                          </span>
                          <h4 className={cn('text-sm font-bold text-primary', isDone && 'line-through opacity-80')}>
                            {d.title}
                          </h4>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1"
                        onClick={() => {
                          localStorage.setItem('bible_target_jump', JSON.stringify({ book: d.book, chapter: d.chapter }))
                          navigate('/bible')
                        }}
                      >
                        <BookOpen className="w-3 h-3" /> Read
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground pl-8 leading-relaxed">
                      <strong className="text-primary">Application:</strong> {d.applicationPrompt}
                    </p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        {/* TAB 3: REMINDERS & COMPLETED HISTORY */}
        <TabsContent value="reminders" className="pt-4 space-y-5">
          <Card className="border-none shadow-sm">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-primary">Daily Devotional Reminder</h3>
                    <p className="text-[10px] text-muted-foreground">
                      Time zone: {reminderPrefs.timezone}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={reminderPrefs.enabled}
                  onCheckedChange={handleToggleReminder}
                />
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <label className="text-xs font-semibold text-muted-foreground">Preferred Time</label>
                <Input
                  type="time"
                  value={reminderPrefs.time}
                  onChange={(e) => handleReminderTimeChange(e.target.value)}
                  className="w-32 h-9 text-xs"
                />
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <h3 className="text-sm font-bold text-primary uppercase flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4" /> Completed Devotionals ({totalCompletedAllTime.length})
            </h3>
            {totalCompletedAllTime.length === 0 ? (
              <Card className="border-none shadow-sm bg-secondary/20">
                <CardContent className="p-6 text-center text-xs text-muted-foreground">
                  No devotionals marked completed yet. Open today’s devotional to begin!
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {totalCompletedAllTime.slice(0, 15).map((d) => (
                  <Card
                    key={d.id}
                    onClick={() => {
                      setYear(d.year)
                      setMonth(d.month)
                      setSelectedDay(d.day)
                    }}
                    className="border-none shadow-sm hover:shadow-md cursor-pointer transition-all"
                  >
                    <CardContent className="p-3 flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-primary">{d.title}</h4>
                        <p className="text-[10px] text-muted-foreground">
                          {d.month} {d.day}, {d.year} • {d.scriptureRef}
                        </p>
                      </div>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function DevotionalDetail({ entry, onBack, onToggleComplete, onToggleBookmark }: {
  entry: DevotionalEntry
  onBack: () => void
  onToggleComplete: () => void
  onToggleBookmark: () => void
}) {
  const [version, setVersion] = useState<BibleVersion>('KJV')
  const [isPlaying, setIsPlaying] = useState(false)
  const [speechRate, setSpeechRate] = useState(1.0)
  const [fontSize, setFontSize] = useState(17)
  const [reflection, setReflection] = useState('')
  const [prayersChecked, setPrayersChecked] = useState<boolean[]>(() => entry.prayerPoints.map(() => false))
  const [completedLocal, setCompletedLocal] = useState(entry.isCompleted ?? false)

  useEffect(() => {
    setVersion('KJV')
    const existing = getJournalEntries().find((j) => j.devotionalId === entry.id)
    setReflection(existing?.body ?? localStorage.getItem(`reflection-${entry.id}`) ?? '')
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [entry.id])

  const toggleAudioNarration = () => {
    if (!('speechSynthesis' in window)) {
      toast.error('Audio narration is not supported on this browser')
      return
    }
    if (isPlaying) {
      window.speechSynthesis.cancel()
      setIsPlaying(false)
      return
    }
    window.speechSynthesis.cancel()
    const scriptureText = entry.bibleVersions[version] ?? entry.bibleVersions.KJV ?? ''
    const fullText = `${entry.title}. Scripture reading from ${entry.scriptureRef}: ${scriptureText}. ${entry.mainBody}. Key thought: ${entry.keyThought}. Prayer: ${entry.prayer}`
    const utterance = new SpeechSynthesisUtterance(fullText)
    utterance.rate = speechRate
    utterance.onend = () => setIsPlaying(false)
    utterance.onerror = () => setIsPlaying(false)
    setIsPlaying(true)
    window.speechSynthesis.speak(utterance)
    toast.success('Playing spoken devotional narration')
  }

  const togglePrayer = (i: number) => {
    setPrayersChecked(prev => prev.map((v, idx) => (idx === i ? !v : v)))
  }

  const saveReflection = () => {
    if (!reflection.trim()) {
      toast.error('Please write a reflection before saving')
      return
    }
    try {
      localStorage.setItem(`reflection-${entry.id}`, reflection)
      const existing = getJournalEntries().find((j) => j.devotionalId === entry.id)
      if (existing) {
        updateJournalEntry(existing.id, {
          title: `Devotional Reflection: ${entry.title}`,
          body: reflection.trim(),
          type: 'Notes',
          scriptureRef: entry.scriptureRef,
        })
      } else {
        addJournalEntry({
          title: `Devotional Reflection: ${entry.title}`,
          body: reflection.trim(),
          type: 'Notes',
          scriptureRef: entry.scriptureRef,
          devotionalId: entry.id,
        })
      }
      toast.success('Reflection saved to your journal!')
    } catch {
      toast.error('Could not save reflection')
    }
  }

  const share = async () => {
    try {
      await navigator.share({ title: entry.title, text: `${entry.scriptureRef}\n${entry.bibleVersions[version] ?? ''}` })
    } catch {
      toast.info(`${entry.scriptureRef}`)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed inset-0 z-[60] bg-background overflow-y-auto"
    >
      {/* Hero */}
      <div className="relative h-[36vh]">
        <img
          src="https://storage.googleapis.com/dala-prod-public-storage/generated-images/f095a220-d4e4-4a6a-8aec-8a5aa9c8ce04/devotional-cover-1-cb4ac9fc-1782601932817.webp"
          className="w-full h-full object-cover"
          alt="Devotional cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
        <Button
          variant="secondary"
          size="icon"
          onClick={onBack}
          className="absolute top-6 left-6 rounded-full bg-white/20 backdrop-blur-md border-none text-white hover:bg-white/40"
        >
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <div className="absolute bottom-6 left-6 right-6 space-y-2">
          <div className="flex items-center gap-2">
            <Badge className="bg-accent text-accent-foreground">{entry.month} {entry.day}, {entry.year}</Badge>
            <Badge className="bg-white/20 text-white border-none">{entry.dayOfWeek}</Badge>
          </div>
          <h1 className="text-3xl font-serif text-primary font-bold leading-tight">{entry.title}</h1>
          <div className="flex items-center gap-3 text-sm text-muted-foreground font-medium">
            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {entry.readTimeMinutes} min</span>
            <span className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" /> {entry.theme}</span>
            <span className="flex items-center gap-1"><GitBranch className="w-3.5 h-3.5" /> {entry.author}</span>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 space-y-7 pb-32">
        {/* Quick actions */}
        <div className="flex justify-between items-center py-2 border-y border-border/50">
          <div className="flex gap-3">
            <Button variant="ghost" size="icon" className={cn('text-muted-foreground', entry.isBookmarked && 'text-amber-500')} onClick={onToggleBookmark}>
              {entry.isBookmarked ? <BookmarkCheck className="w-5 h-5 fill-current" /> : <Bookmark className="w-5 h-5" />}
            </Button>
            <Button variant="ghost" size="icon" className={cn('text-muted-foreground', completedLocal && 'text-emerald-600')} onClick={() => { setCompletedLocal(!completedLocal); onToggleComplete() }}>
              <CheckCircle2 className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-muted-foreground" onClick={share}><Share2 className="w-5 h-5" /></Button>
            <Button variant="ghost" size="icon" className="text-muted-foreground" onClick={() => setFontSize(f => (f === 17 ? 21 : 17))}>
              <Type className="w-5 h-5" />
            </Button>
          </div>
          <div className="flex items-center gap-1.5">
            <Button size="icon" variant="ghost" className={cn('w-8 h-8', isPlaying && 'text-rose-500')} onClick={toggleAudioNarration}>
              {isPlaying ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
            </Button>
            <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
              <Mic className="w-3 h-3" /> {isPlaying ? 'Speaking' : 'Listen'}
            </span>
          </div>
        </div>

        {/* Spoken Audio Narration Control Bar */}
        {isPlaying && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="rounded-2xl bg-primary/5 border border-primary/10 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground">
                <Music2 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h4 className="text-xs font-bold text-primary">{entry.title} — Voice Narration</h4>
                <p className="text-[10px] text-muted-foreground">Reading in {BIBLE_VERSION_LABELS[version]} • Speed {speechRate}x</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[10px] px-2"
                onClick={() => {
                  const next = speechRate === 1.0 ? 1.15 : speechRate === 1.15 ? 0.9 : 1.0
                  setSpeechRate(next)
                }}
              >
                {speechRate}x
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-[10px] text-rose-500" onClick={toggleAudioNarration}>
                Stop
              </Button>
            </div>
          </motion.div>
        )}

        {/* Verse + versions */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-accent uppercase tracking-widest">Scripture</h3>
            <div className="flex gap-1">
              {BIBLE_VERSIONS.map(v => (
                <button
                  key={v}
                  onClick={() => setVersion(v)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all active:scale-95',
                    version === v ? 'bg-primary text-primary-foreground shadow' : 'bg-secondary/40 text-primary hover:bg-secondary/60'
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
          <AnimatePresence mode="wait">
            <motion.blockquote
              key={version}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="text-xl font-serif italic text-primary leading-relaxed border-l-4 border-accent pl-4"
            >
              "{entry.bibleVersions[version] ?? entry.bibleVersions.KJV}"
              <footer className="mt-2 text-sm not-italic font-bold text-muted-foreground">
                {entry.scriptureRef} ({version})
              </footer>
            </motion.blockquote>
          </AnimatePresence>
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <BookOpen className="w-3 h-3" /> {BIBLE_VERSION_LABELS[version]}. Switch versions above to compare translations.
          </p>
        </section>

        {/* Reading */}
        <section className="space-y-4">
          <h3 className="text-xs font-bold text-accent uppercase tracking-widest">Daily Reading</h3>
          <div className="space-y-4 text-foreground/90 font-serif leading-relaxed" style={{ fontSize }}>
            {entry.mainBody.split(String.fromCharCode(10, 10)).map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
          <div className="rounded-xl bg-primary/5 border border-primary/10 p-4 space-y-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-accent mb-1">Key Thought</p>
              <p className="text-sm italic font-serif text-primary leading-relaxed">{entry.keyThought}</p>
            </div>
            <div className="pt-2 border-t border-primary/10">
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 flex items-center gap-1 mb-1">
                <Compass className="w-3 h-3" /> Today’s Application
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Pause before your next task today to meditate on <strong>{entry.scriptureRef}</strong> and practice <em>{entry.theme.toLowerCase()}</em> in one concrete interaction.
              </p>
            </div>
          </div>
        </section>

        {/* Tabs: Reflection / Prayer */}
        <Tabs defaultValue="reflection" className="w-full">
          <TabsList className="w-full bg-muted/50 p-1 rounded-xl">
            <TabsTrigger value="reflection" className="flex-1 rounded-lg">Reflection</TabsTrigger>
            <TabsTrigger value="prayer" className="flex-1 rounded-lg">Prayer</TabsTrigger>
          </TabsList>
          <TabsContent value="reflection" className="pt-4 space-y-4">
            <p className="text-muted-foreground italic font-medium text-sm">
              {entry.theme}: what is God speaking to you today through this passage, and how will you apply it?
            </p>
            <textarea
              value={reflection}
              onChange={e => setReflection(e.target.value)}
              placeholder="Write your journal reflection and application step here..."
              className="w-full min-h-[140px] rounded-2xl bg-card border border-border/50 p-4 text-sm font-serif leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
            <Button className="w-full h-12 rounded-2xl gap-2" onClick={saveReflection}>
              <NotebookPen className="w-4 h-4" /> Save to Journal
            </Button>
          </TabsContent>
          <TabsContent value="prayer" className="pt-4 space-y-4">
            {/* CMS devotionals carry no prayer text — hide the empty box
                (seeded entries always have a prayer, so they render as before). */}
            {entry.prayer && (
              <div className="rounded-xl bg-primary/5 border border-primary/10 p-4">
                <h4 className="font-bold text-primary mb-1.5">Today's Prayer</h4>
                <p className="text-foreground/80 leading-relaxed italic text-sm">{entry.prayer}</p>
              </div>
            )}
            <div className="space-y-2">
              <h5 className="text-xs font-bold text-accent uppercase tracking-widest flex items-center gap-1"><Heart className="w-3.5 h-3.5" /> Prayer Points</h5>
              {entry.prayerPoints.map((point, i) => (
                <button
                  key={i}
                  onClick={() => togglePrayer(i)}
                  className={cn(
                    'w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all active:scale-[0.98]',
                    prayersChecked[i] ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-card border-border/40 hover:border-primary/30'
                  )}
                >
                  <span className={cn(
                    'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors',
                    prayersChecked[i] ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-muted-foreground/40'
                  )}>
                    {prayersChecked[i] && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </span>
                  <span className={cn('text-sm font-medium', prayersChecked[i] ? 'text-emerald-700 line-through' : 'text-primary')}>{point}</span>
                </button>
              ))}
            </div>
            {prayersChecked.every(Boolean) && prayersChecked.length > 0 && (
              <p className="text-center text-xs font-bold text-emerald-600">All prayer points lifted up today. Amen! 🙏</p>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-background via-background to-transparent">
        <div className="flex gap-3">
          <Button
            onClick={() => { setCompletedLocal(true); onToggleComplete(); toast.success('Devotional completed, keep the streak alive!') }}
            className={cn(
              'flex-1 h-14 rounded-2xl text-lg font-bold transition-all shadow-xl',
              completedLocal ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-primary hover:bg-primary/90'
            )}
          >
            {completedLocal ? (
              <span className="flex items-center gap-2"><CheckCircle2 className="w-6 h-6" /> Completed!</span>
            ) : 'Complete Daily Devotional'}
          </Button>
        </div>
      </div>
    </motion.div>
  )
}