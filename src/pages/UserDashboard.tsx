import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Flame,
  BookOpen,
  Heart,
  Trophy,
  TrendingUp,
  Star,
  Bookmark,
  Bell,
  Clock,
  Award,
  PenLine,
  Target,
  Settings2,
  Settings,
  Type,
  Monitor,
} from 'lucide-react'
import type { LibraryItem, UserStats, PrayerAlert } from '@/types/library-news'
import { getUserStats, getLibraryItems, getPrayerAlerts, syncFaithDataFromServer } from '@/data/mockFaithData'
import {
  computeStreak,
  activeDaysThisWeek,
  last7DayActivity,
  countCompletedDevotionals,
  countJournalEntries,
  countTotalPrayed,
  countTotalAnsweredPrayers,
  countReadingHistoryEntries,
  type DayActivity,
} from '@/lib/activity'
import { getJournalEntries, syncPersonalJournalFromServer } from '@/data/journalData'
import {
  getSpiritualGoals,
  saveSpiritualGoals,
  type SpiritualGoals,
  READING_PLANS,
  getReadingPlansProgress,
  getDailyReminderPrefs,
  saveDailyReminderPrefs,
} from '@/data/readingPlans'
import { getFavoriteHymnIds } from '@/data/mockDevotionalHymnData'
import { ThemeSettings } from '@/components/settings/ThemeSettings'
import {
  READING_FONT_STYLES,
  getFontFamily,
  type ReadingFontStyleId,
} from '@/lib/readingFonts'
import {
  getDeviceFontSize,
  setDeviceFontSize,
  getDeviceFontStyle,
  setDeviceFontStyle,
  getKeepScreenOn,
  setKeepScreenOn,
  isWakeLockSupported,
} from '@/lib/devicePreferences'
import { requestNotificationPermission } from '@/lib/notifications'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'

const HERO_IMAGES = [
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1474511320723-9a56873867b5?auto=format&fit=crop&w=1400&q=80',
]

export function UserDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [items, setItems] = useState<LibraryItem[]>(() => getLibraryItems())
  const [stats, setStats] = useState<UserStats>(() => getUserStats())
  const [prayers, setPrayers] = useState<PrayerAlert[]>(() => getPrayerAlerts())
  const [weeklyActivity, setWeeklyActivity] = useState<DayActivity[]>(() => last7DayActivity())
  const [weekSummary, setWeekSummary] = useState(() => activeDaysThisWeek())
  const [streak, setStreak] = useState(() => computeStreak())
  const [goals, setGoals] = useState<SpiritualGoals>(() => getSpiritualGoals())
  const [showGoals, setShowGoals] = useState(false)
  const [editGoals, setEditGoals] = useState<SpiritualGoals>(() => getSpiritualGoals())
  const [journalCount, setJournalCount] = useState(() => getJournalEntries().length)
  const [hymnFavCount, setHymnFavCount] = useState(() => getFavoriteHymnIds().length)
  const [heroIndex, setHeroIndex] = useState(0)
  const [planProgress, setPlanProgress] = useState(() => getReadingPlansProgress())
  const [showSettings, setShowSettings] = useState(false)
  const [fontStyle, setFontStyle] = useState<ReadingFontStyleId>(() => getDeviceFontStyle())
  const [fontSize, setFontSize] = useState<number>(() => getDeviceFontSize())
  const [reminderPrefs, setReminderPrefs] = useState(() => getDailyReminderPrefs())
  const [keepScreenOn, setKeepScreenOnState] = useState<boolean>(() => getKeepScreenOn())

  useEffect(() => {
    const id = window.setInterval(() => setHeroIndex((i) => (i + 1) % HERO_IMAGES.length), 8000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    const refresh = () => {
      setItems(getLibraryItems())
      setStats(getUserStats())
      setPrayers(getPrayerAlerts())
      setWeeklyActivity(last7DayActivity())
      setWeekSummary(activeDaysThisWeek())
      setStreak(computeStreak())
      setGoals(getSpiritualGoals())
      setJournalCount(getJournalEntries().length)
      setHymnFavCount(getFavoriteHymnIds().length)
      setPlanProgress(getReadingPlansProgress())
    }

    refresh()
    void syncFaithDataFromServer().then((synced) => {
      setItems(synced.libraryItems || getLibraryItems())
      setPrayers(synced.prayerAlerts || getPrayerAlerts())
      setStats(getUserStats())
    })
    void syncPersonalJournalFromServer().then((synced) => {
      setJournalCount((synced.entries || getJournalEntries()).length)
    })

    const onUpdate = () => refresh()
    window.addEventListener('faith-data-updated', onUpdate)
    window.addEventListener('journal-updated', onUpdate)
    return () => {
      window.removeEventListener('faith-data-updated', onUpdate)
      window.removeEventListener('journal-updated', onUpdate)
    }
  }, [])

  const statsCards = useMemo(() => {
    const booksRead = countReadingHistoryEntries()
    const devotionalsDone = countCompletedDevotionals()
    const prayersMade = countTotalPrayed()
    const answered = countTotalAnsweredPrayers()
    return [
      { label: 'Books Read', value: booksRead, icon: BookOpen },
      { label: 'Devotionals', value: devotionalsDone, icon: Star },
      { label: 'Prayers Lifted', value: prayersMade, icon: Heart },
      { label: 'Answered', value: answered, icon: Trophy },
    ]
  }, [stats])

  const bookmarkedItems = useMemo(() => items.filter(i => stats.bookmarks?.includes(i.id)).slice(0, 4), [items, stats.bookmarks])
  const recentPrayers = useMemo(() => prayers.filter(p => p.status !== 'archived').slice(0, 3), [prayers])
  const activeReadingPlans = useMemo(() => {
    return READING_PLANS.map((plan) => ({ plan, progress: planProgress[plan.id] }))
      .filter(({ progress }) => progress && Object.keys(progress.completedDays || {}).length > 0)
      .slice(0, 3)
  }, [planProgress])

  const weeklyGoal = goals.weeklyDevotionalsTarget || 5
  const weeklyProgressPct = Math.min(100, Math.round((weekSummary.active / Math.max(1, weeklyGoal)) * 100))

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good Morning'
    if (h < 17) return 'Good Afternoon'
    return 'Good Evening'
  })()

  const saveGoals = () => {
    const normalized: SpiritualGoals = {
      ...editGoals,
      weeklyDevotionalsTarget: Math.max(1, Math.min(7, Number(editGoals.weeklyDevotionalsTarget) || 1)),
      weeklyChaptersTarget: Math.max(1, Math.min(50, Number(editGoals.weeklyChaptersTarget) || 1)),
      weeklyPrayersTarget: Math.max(1, Math.min(50, Number(editGoals.weeklyPrayersTarget) || 1)),
      focusTheme: String(editGoals.focusTheme || '').trim() || goals.focusTheme,
    }
    saveSpiritualGoals(normalized)
    setGoals(normalized)
    setShowGoals(false)
    toast.success('Spiritual goals updated')
  }

  return (
    <div className="space-y-6 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Image-rich hero with changing images */}
      <Card className="overflow-hidden border-none shadow-xl relative min-h-[230px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={heroIndex}
            initial={{ opacity: 0.25, scale: 1.03 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0.2 }}
            transition={{ duration: 1.1 }}
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url('${HERO_IMAGES[heroIndex]}')` }}
          />
        </AnimatePresence>
        <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/40 to-black/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" />
        <CardContent className="relative z-10 p-6 sm:p-7 text-white space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <Badge className="bg-white/20 text-white border-white/20 backdrop-blur-sm">Dashboard</Badge>
              <h1 className="text-2xl sm:text-3xl font-serif font-bold leading-tight">{greeting}, {user?.name || 'Friend'}</h1>
              <p className="text-sm text-white/85 leading-relaxed">Track your devotional consistency, prayers, reading, and spiritual growth.</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-2 bg-white/15 backdrop-blur-sm px-3 py-2 rounded-full border border-white/20">
                <Flame className="w-4 h-4 text-orange-300 fill-orange-300" />
                <span className="text-sm font-bold">{streak}</span>
                <span className="text-xs text-white/85">day streak</span>
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setShowSettings(true)}
                className="h-9 rounded-full bg-white/20 hover:bg-white/30 text-white border border-white/25 backdrop-blur-sm gap-1.5"
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline text-xs font-semibold">Settings</span>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            {statsCards.map((s) => (
              <div key={s.label} className="rounded-xl bg-white/12 backdrop-blur-sm border border-white/15 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <s.icon className="w-4 h-4 text-white/90" />
                  <span className="text-[10px] uppercase tracking-wide text-white/80 font-semibold leading-tight">{s.label}</span>
                </div>
                <p className="text-xl font-bold">{s.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Weekly goal progress */}
      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-semibold text-primary flex items-center gap-2"><Target className="w-4 h-4" /> Weekly Devotional Goal</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{weekSummary.active} active day{weekSummary.active === 1 ? '' : 's'} in the last 7 days • Target: {weeklyGoal}/week</p>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">Focus: {goals.focusTheme}</p>
            </div>
            <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={() => { setEditGoals(goals); setShowGoals(true) }}>
              <Settings2 className="w-4 h-4" /> Goals
            </Button>
          </div>
          <div className="h-2.5 rounded-full bg-secondary/40 overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${weeklyProgressPct}%` }} />
          </div>
          <div className="flex gap-1.5 justify-between">
            {weeklyActivity.map((d) => (
              <div key={d.key} className="flex flex-col items-center gap-1 flex-1">
                <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[10px] font-bold ${d.count > 0 ? 'bg-emerald-500 text-white' : 'bg-secondary/40 text-muted-foreground'}`}>
                  {d.label}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-primary flex items-center gap-2"><Bookmark className="w-4 h-4" /> Bookmarked</h3>
              <Button size="sm" variant="ghost" onClick={() => navigate('/library')}>View library</Button>
            </div>
            {bookmarkedItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">No bookmarks yet. Save books and resources from the library.</p>
            ) : (
              <div className="space-y-2">
                {bookmarkedItems.map((item) => (
                  <button key={item.id} className="w-full text-left p-3 rounded-xl bg-secondary/20 hover:bg-secondary/30 transition-colors" onClick={() => navigate('/library')}>
                    <p className="text-sm font-medium text-foreground line-clamp-1">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.author} • {item.type}</p>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-primary flex items-center gap-2"><Bell className="w-4 h-4" /> Prayer & News</h3>
              <Button size="sm" variant="ghost" onClick={() => navigate('/prayer-news')}>Open</Button>
            </div>
            {recentPrayers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active prayer alerts right now.</p>
            ) : (
              <div className="space-y-2">
                {recentPrayers.map((p) => (
                  <div key={p.id} className="p-3 rounded-xl bg-secondary/20">
                    <p className="text-sm font-medium text-foreground line-clamp-1">{p.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{p.description}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-primary flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Reading Plans</h3>
              <Button size="sm" variant="ghost" onClick={() => navigate('/devotional')}>Devotional</Button>
            </div>
            {activeReadingPlans.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active reading plans yet. Start a plan from the Devotional page.</p>
            ) : (
              <div className="space-y-2">
                {activeReadingPlans.map(({ plan, progress }) => {
                  const done = Object.keys(progress?.completedDays || {}).length
                  const pct = Math.round((done / Math.max(1, plan.days.length)) * 100)
                  return (
                    <div key={plan.id} className="p-3 rounded-xl bg-secondary/20 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-foreground line-clamp-1">{plan.title}</p>
                        <span className="text-xs font-semibold text-primary">{pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-secondary/50 overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} /></div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-4 space-y-3">
            <h3 className="font-semibold text-primary flex items-center gap-2"><Award className="w-4 h-4" /> Highlights</h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-secondary/20 p-3">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><PenLine className="w-3.5 h-3.5" /> Journal</p>
                <p className="text-lg font-bold text-primary">{journalCount}</p>
              </div>
              <div className="rounded-xl bg-secondary/20 p-3">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Star className="w-3.5 h-3.5" /> Favorite Hymns</p>
                <p className="text-lg font-bold text-primary">{hymnFavCount}</p>
              </div>
              <div className="rounded-xl bg-secondary/20 p-3">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Active (7 days)</p>
                <p className="text-lg font-bold text-primary">{weekSummary.active}</p>
              </div>
              <div className="rounded-xl bg-secondary/20 p-3">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Flame className="w-3.5 h-3.5" /> Streak</p>
                <p className="text-lg font-bold text-primary">{streak}</p>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button size="sm" className="flex-1" onClick={() => navigate('/journal')}>Journal</Button>
              <Button size="sm" variant="outline" className="flex-1" onClick={() => navigate('/hymns')}>Hymns</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showGoals} onOpenChange={setShowGoals}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Spiritual Goals</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase">Focus theme</label>
              <Input value={editGoals.focusTheme} onChange={(e) => setEditGoals((g) => ({ ...g, focusTheme: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase">Weekly devotionals target</label>
              <Input type="number" min={1} max={7} value={editGoals.weeklyDevotionalsTarget} onChange={(e) => setEditGoals((g) => ({ ...g, weeklyDevotionalsTarget: Number(e.target.value) }))} className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase">Weekly chapters target</label>
              <Input type="number" min={1} max={50} value={editGoals.weeklyChaptersTarget} onChange={(e) => setEditGoals((g) => ({ ...g, weeklyChaptersTarget: Number(e.target.value) }))} className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase">Weekly prayers target</label>
              <Input type="number" min={1} max={50} value={editGoals.weeklyPrayersTarget} onChange={(e) => setEditGoals((g) => ({ ...g, weeklyPrayersTarget: Number(e.target.value) }))} className="mt-1" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowGoals(false)}>Cancel</Button>
              <Button onClick={saveGoals}>Save Goals</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-md rounded-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-serif text-primary">
              <Settings className="w-5 h-5" />
              Settings
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-1">
            <p className="text-[11px] text-muted-foreground">
              All preferences below are saved locally on this device.
            </p>

            {/* Font Style & Size */}
            <div className="space-y-3 p-3.5 rounded-xl bg-secondary/25 border border-border/50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-primary flex items-center gap-1.5">
                  <Type className="w-3.5 h-3.5" /> Reading Font
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    onClick={() => {
                      const next = Math.max(14, fontSize - 1)
                      setFontSize(next)
                      setDeviceFontSize(next)
                    }}
                  >
                    A-
                  </Button>
                  <span className="text-xs font-semibold w-10 text-center tabular-nums">{fontSize}px</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    onClick={() => {
                      const next = Math.min(26, fontSize + 1)
                      setFontSize(next)
                      setDeviceFontSize(next)
                    }}
                  >
                    A+
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {READING_FONT_STYLES.map((s) => (
                  <Button
                    key={s.id}
                    type="button"
                    size="sm"
                    variant={fontStyle === s.id ? 'default' : 'outline'}
                    className="h-8 text-[11px] px-1.5 truncate"
                    style={{ fontFamily: s.family }}
                    onClick={() => {
                      setFontStyle(s.id)
                      setDeviceFontStyle(s.id)
                    }}
                  >
                    {s.label}
                  </Button>
                ))}
              </div>
              <p
                className="text-muted-foreground leading-relaxed p-2.5 rounded-lg bg-background/80 border border-border/40"
                style={{ fontFamily: getFontFamily(fontStyle), fontSize: Math.min(20, fontSize) }}
              >
                Thy word is a lamp unto my feet, and a light unto my path.
              </p>
            </div>

            {/* Theme Color & Mode */}
            <ThemeSettings />

            {/* Daily Reminder */}
            <div className="space-y-2.5 p-3.5 rounded-xl bg-secondary/25 border border-border/50">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase text-primary flex items-center gap-1.5">
                    <Bell className="w-3.5 h-3.5" /> Daily Reminder
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Receive a daily reading &amp; prayer reminder on this device.
                  </p>
                </div>
                <Switch
                  checked={reminderPrefs.enabled}
                  onCheckedChange={async (checked) => {
                    if (checked) {
                      const perm = await requestNotificationPermission()
                      if (perm === 'denied') {
                        toast.error('Notifications are blocked in your browser settings')
                      }
                    }
                    const next = { ...reminderPrefs, enabled: checked }
                    setReminderPrefs(next)
                    saveDailyReminderPrefs(next)
                    toast.success(checked ? 'Daily reminder enabled' : 'Daily reminder paused')
                  }}
                />
              </div>
              {reminderPrefs.enabled && (
                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-xs text-muted-foreground">Reminder time</span>
                  <Input
                    type="time"
                    value={reminderPrefs.time}
                    onChange={(e) => {
                      const next = { ...reminderPrefs, time: e.target.value || '08:00' }
                      setReminderPrefs(next)
                      saveDailyReminderPrefs(next)
                    }}
                    className="h-8 w-32 text-xs"
                  />
                </div>
              )}
            </div>

            {/* Keep Screen On */}
            <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-secondary/25 border border-border/50">
              <div>
                <p className="text-xs font-bold uppercase text-primary flex items-center gap-1.5">
                  <Monitor className="w-3.5 h-3.5" /> Keep Screen On
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {isWakeLockSupported()
                    ? 'Prevent your screen from sleeping while reading.'
                    : 'Saved locally (your browser may limit screen wake lock).'}
                </p>
              </div>
              <Switch
                checked={keepScreenOn}
                onCheckedChange={(checked) => {
                  setKeepScreenOnState(checked)
                  setKeepScreenOn(checked)
                  toast.success(checked ? 'Screen will stay awake while reading' : 'Screen sleep restored')
                }}
              />
            </div>

            <div className="flex justify-end">
              <Button size="sm" onClick={() => setShowSettings(false)}>Done</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
