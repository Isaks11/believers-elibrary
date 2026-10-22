import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Flame,
  BookOpen,
  Headphones,
  Heart,
  Trophy,
  TrendingUp,
  Star,
  Bookmark,
  Bell,
  Clock,
  Award,
  Zap,
  PenLine,
  Target,
  Settings2,
} from 'lucide-react'
import { LibraryItem, UserStats, PrayerAlert } from '@/types/library-news'
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
} from '@/lib/activity'
import { getJournalEntries, syncPersonalJournalFromServer } from '@/data/journalData'
import {
  getSpiritualGoals,
  saveSpiritualGoals,
  SpiritualGoals,
  READING_PLANS,
  getReadingPlansProgress,
} from '@/data/readingPlans'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export function UserDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState<UserStats | null>(() => getUserStats())
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>(() => getLibraryItems())
  const [prayerAlerts, setPrayerAlerts] = useState<PrayerAlert[]>(() => getPrayerAlerts())
  const [goals, setGoals] = useState<SpiritualGoals>(() => getSpiritualGoals())
  const [goalsModalOpen, setGoalsModalOpen] = useState(false)
  const [refreshTick, setRefreshTick] = useState(0)

  useEffect(() => {
    setStats(getUserStats())
    setLibraryItems(getLibraryItems())
    setPrayerAlerts(getPrayerAlerts())
    setGoals(getSpiritualGoals())

    Promise.all([syncFaithDataFromServer(), syncPersonalJournalFromServer()]).then(([faithData]) => {
      setLibraryItems(faithData.libraryItems)
      setPrayerAlerts(faithData.prayerAlerts)
      setStats(getUserStats())
      setRefreshTick((t) => t + 1)
    })
  }, [])

  // All figures below are derived from real recorded activity — never constants.
  const streak = useMemo(() => computeStreak(), [refreshTick])
  const completedDevotionals = useMemo(() => countCompletedDevotionals(), [refreshTick])
  const journalCount = useMemo(() => countJournalEntries(), [refreshTick])
  const chaptersRead = useMemo(() => countReadingHistoryEntries(), [refreshTick])
  const week = useMemo(() => activeDaysThisWeek(), [refreshTick])
  const weekActivity = useMemo(() => last7DayActivity(), [refreshTick])
  const wroteAtNight = useMemo(
    () =>
      getJournalEntries().some((e) => {
        const h = new Date(e.createdAt).getHours()
        return h >= 22 || h < 5
      }),
    [refreshTick]
  )

  const lastBibleChapter = useMemo(() => {
    try {
      const raw = localStorage.getItem('bible_history')
      const arr = raw ? JSON.parse(raw) : []
      return Array.isArray(arr) && arr.length > 0 ? String(arr[0]) : null
    } catch {
      return null
    }
  }, [refreshTick])

  const planProgress = useMemo(() => getReadingPlansProgress(), [refreshTick])

  const prayedCount = useMemo(() => countTotalPrayed(), [prayerAlerts, refreshTick])
  const answeredCount = useMemo(() => countTotalAnsweredPrayers(), [prayerAlerts, refreshTick])
  const continueListening = libraryItems.filter(
    (i) => (i.type === 'audio' || i.type === 'video') && (i.progress || 0) > 0
  )
  const continueReading = libraryItems.filter(
    (i) => (i.type === 'book' || i.type === 'material') && (i.progress || 0) > 0
  )

  if (!stats)
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-32 bg-muted rounded-2xl" />
        <div className="h-20 bg-muted rounded-2xl" />
      </div>
    )

  const bookmarkedItems = libraryItems.filter((i) => stats.bookmarks.includes(i.id))

  const achievements = [
    { label: '7-Day Streak', icon: Flame, earned: streak >= 7, color: 'text-orange-500 bg-orange-50' },
    { label: 'First Prayer', icon: Heart, earned: prayedCount >= 1, color: 'text-rose-500 bg-rose-50' },
    { label: 'Bookworm', icon: BookOpen, earned: completedDevotionals >= 5, color: 'text-blue-500 bg-blue-50' },
    { label: 'Night Owl', icon: Clock, earned: wroteAtNight, color: 'text-indigo-500 bg-indigo-50' },
    { label: 'Intercessor', icon: Bell, earned: prayedCount >= 3, color: 'text-emerald-500 bg-emerald-50' },
  ]

  const quickLinks = [
    { label: 'Bible Reading', icon: BookOpen, path: '/bible', color: 'text-blue-600 bg-blue-50' },
    { label: 'Faith Guide', icon: Star, path: '/faithguide', color: 'text-purple-600 bg-purple-50' },
    { label: 'Devotional', icon: Zap, path: '/devotional', color: 'text-amber-600 bg-amber-50' },
    { label: 'Journal', icon: Heart, path: '/journal', color: 'text-rose-600 bg-rose-50' },
  ]

  const handleSaveGoals = () => {
    saveSpiritualGoals(goals)
    setGoalsModalOpen(false)
    toast.success('Spiritual growth goals saved!')
  }

  return (
    <div className="space-y-6 pb-24">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-serif text-primary">My Journey</h1>
          <p className="text-sm text-muted-foreground">Welcome back, {user?.name || 'Believer'}</p>
        </div>
        <button
          onClick={() => navigate('/profile')}
          className="w-10 h-10 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors flex items-center justify-center"
          aria-label="Open Profile"
        >
          <Award className="w-5 h-5 text-primary" />
        </button>
      </header>

      {/* Spiritual Streak Banner */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="bg-gradient-to-br from-primary via-indigo-700 to-emerald-700 text-white border-none shadow-xl overflow-hidden relative">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-4 right-4 w-24 h-24 rounded-full bg-white/20 blur-2xl" />
            <div className="absolute bottom-2 left-8 w-16 h-16 rounded-full bg-emerald-300/30 blur-xl" />
          </div>
          <CardContent className="p-5 relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium opacity-80 uppercase tracking-wider">Faith Streak</p>
                <div className="flex items-center gap-2 mt-1">
                  <Flame className="w-7 h-7 text-amber-300 fill-amber-300" />
                  <span className="text-3xl font-bold">{streak}</span>
                  <span className="text-sm opacity-80">days</span>
                </div>
                <p className="text-xs opacity-70 mt-1">
                  {streak > 0
                    ? 'Keep growing in faith daily!'
                    : 'Complete a devotional or write in your journal to start.'}
                </p>
              </div>
              <div className="text-right space-y-2">
                <div className="bg-white/15 rounded-lg px-3 py-1.5">
                  <p className="text-[10px] opacity-80 uppercase">Prayed</p>
                  <p className="text-lg font-bold">{prayedCount}</p>
                </div>
                <div className="bg-white/15 rounded-lg px-3 py-1.5">
                  <p className="text-[10px] opacity-80 uppercase">Answered</p>
                  <p className="text-lg font-bold">{answeredCount}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Resume Bible Chapter Banner */}
      {lastBibleChapter && (
        <Card className="border-border/50 bg-secondary/40 shadow-sm">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Continue Scripture Study</p>
                <p className="text-sm font-bold text-primary">{lastBibleChapter}</p>
              </div>
            </div>
            <Button
              size="sm"
              className="h-8 text-xs font-bold"
              onClick={() => {
                const lastSpace = lastBibleChapter.lastIndexOf(' ')
                if (lastSpace > 0) {
                  localStorage.setItem(
                    'bible_target_jump',
                    JSON.stringify({
                      book: lastBibleChapter.slice(0, lastSpace),
                      chapter: Number(lastBibleChapter.slice(lastSpace + 1)) || 1,
                    })
                  )
                }
                navigate('/bible')
              }}
            >
              Read Chapter →
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Personal Spiritual Goals & Milestones */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-primary uppercase flex items-center gap-1.5">
                  <Target className="w-4 h-4 text-accent" /> Spiritual Goals & Milestones
                </h3>
                <p className="text-[11px] text-muted-foreground italic">“{goals.focusTheme}”</p>
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setGoalsModalOpen(true)}>
                <Settings2 className="w-3.5 h-3.5" /> Edit
              </Button>
            </div>

            <div className="space-y-2.5">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-foreground">Devotionals Completed</span>
                  <span className="font-bold text-primary">
                    {completedDevotionals} / {goals.weeklyDevotionalsTarget}
                  </span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round((completedDevotionals / Math.max(1, goals.weeklyDevotionalsTarget)) * 100)
                      )}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-foreground">Bible Chapters Read</span>
                  <span className="font-bold text-primary">
                    {chaptersRead} / {goals.weeklyChaptersTarget}
                  </span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round((chaptersRead / Math.max(1, goals.weeklyChaptersTarget)) * 100)
                      )}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-foreground">Prayers Lifted</span>
                  <span className="font-bold text-primary">
                    {prayedCount} / {goals.weeklyPrayersTarget}
                  </span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-rose-500 rounded-full transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round((prayedCount / Math.max(1, goals.weeklyPrayersTarget)) * 100)
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Active Reading Plans quick progress */}
            <div className="pt-2 border-t border-border/30 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Active Reading Plans:{' '}
                <strong className="text-primary">
                  {READING_PLANS.filter((p) => Object.keys(planProgress[p.id]?.completedDays || {}).length > 0).length}{' '}
                  started
                </strong>
              </span>
              <button onClick={() => navigate('/devotional')} className="font-bold text-accent hover:underline">
                Open Plans →
              </button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Stats Grid */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="grid grid-cols-3 gap-3">
          <Card
            className="border-none shadow-sm bg-secondary/50 cursor-pointer hover:bg-secondary/70 transition-colors"
            onClick={() => navigate('/devotional')}
          >
            <CardContent className="p-3 text-center space-y-1">
              <BookOpen className="w-5 h-5 text-blue-600 mx-auto" />
              <p className="text-lg font-bold text-primary">{completedDevotionals}</p>
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Devotionals</p>
            </CardContent>
          </Card>
          <Card
            className="border-none shadow-sm bg-secondary/50 cursor-pointer hover:bg-secondary/70 transition-colors"
            onClick={() => navigate('/journal')}
          >
            <CardContent className="p-3 text-center space-y-1">
              <PenLine className="w-5 h-5 text-purple-600 mx-auto" />
              <p className="text-lg font-bold text-primary">{journalCount}</p>
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Journal</p>
            </CardContent>
          </Card>
          <Card
            className="border-none shadow-sm bg-secondary/50 cursor-pointer hover:bg-secondary/70 transition-colors"
            onClick={() => navigate('/prayer-news')}
          >
            <CardContent className="p-3 text-center space-y-1">
              <Heart className="w-5 h-5 text-rose-600 mx-auto" />
              <p className="text-lg font-bold text-primary">{prayedCount}</p>
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Prayed</p>
            </CardContent>
          </Card>
        </div>
      </motion.div>

      {/* Continue Listening */}
      {continueListening.length > 0 && (
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-primary uppercase flex items-center gap-1.5">
                <Headphones className="w-4 h-4" /> Continue Listening
              </h3>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
              {continueListening.map((item) => (
                <Card
                  key={item.id}
                  onClick={() => navigate('/library')}
                  className="min-w-[200px] border-none shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                >
                  <CardContent className="p-3 space-y-2">
                    <div className="w-full h-20 rounded-lg bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center">
                      <Headphones className="w-6 h-6 text-purple-600" />
                    </div>
                    <h4 className="text-xs font-bold text-primary line-clamp-1">{item.title}</h4>
                    <p className="text-[10px] text-muted-foreground">{item.author}</p>
                    <div className="h-1 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-purple-500 rounded-full" style={{ width: `${item.progress || 0}%` }} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Continue Reading */}
      {continueReading.length > 0 && (
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-primary uppercase flex items-center gap-1.5">
                <BookOpen className="w-4 h-4" /> Continue Reading
              </h3>
            </div>
            <div className="space-y-2">
              {continueReading.map((item) => (
                <Card
                  key={item.id}
                  onClick={() => navigate('/library')}
                  className="border-none shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                >
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                      <BookOpen className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-primary truncate">{item.title}</h4>
                      <p className="text-[10px] text-muted-foreground">{item.author}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${item.progress || 0}%` }} />
                        </div>
                        <span className="text-[10px] text-muted-foreground font-medium">{item.progress || 0}%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Bookmarks */}
      {bookmarkedItems.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-primary uppercase flex items-center gap-1.5">
              <Bookmark className="w-4 h-4" /> My Bookmarks
            </h3>
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
              {bookmarkedItems.map((item) => (
                <Badge
                  key={item.id}
                  onClick={() => navigate('/library')}
                  variant="outline"
                  className="whitespace-nowrap px-3 py-1.5 text-xs font-medium cursor-pointer hover:bg-primary/5"
                >
                  {item.title}
                </Badge>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Quick Links */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-primary uppercase">Quick Access</h3>
          <div className="grid grid-cols-2 gap-3">
            {quickLinks.map((link) => (
              <Button
                key={link.label}
                variant="outline"
                onClick={() => navigate(link.path)}
                className="h-auto py-4 flex flex-col items-center gap-2 border-border/40 hover:border-primary/40 hover:bg-primary/5 transition-all"
              >
                <div className={cn('p-2.5 rounded-xl', link.color)}>
                  <link.icon className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold text-primary">{link.label}</span>
              </Button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Weekly Progress (real activity) */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}>
        <Card className="border-none shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-primary uppercase flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-600" /> Weekly Activity
              </h3>
              <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">
                {week.active} of {week.total} days active
              </Badge>
            </div>
            {week.active === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                No activity yet this week. Complete a devotional or write a journal entry to start your streak.
              </p>
            ) : (
              <div className="flex items-end gap-1.5 h-20">
                {weekActivity.map((day, i) => (
                  <div key={day.key} className="flex-1 flex flex-col items-center gap-1">
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: day.count > 0 ? '100%' : '8%' }}
                      transition={{ delay: 0.4 + i * 0.05, duration: 0.4 }}
                      className={cn('w-full rounded-t-sm', day.count > 0 ? 'bg-emerald-500' : 'bg-primary/10')}
                    />
                    <span className="text-[9px] text-muted-foreground">{day.label}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Achievements */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-primary uppercase flex items-center gap-1.5">
            <Trophy className="w-4 h-4 text-amber-500" /> Achievements
          </h3>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
            {achievements.map((ach) => (
              <div
                key={ach.label}
                className={cn(
                  'flex flex-col items-center gap-1.5 min-w-[72px] p-3 rounded-xl border',
                  ach.earned ? 'border-border bg-card shadow-sm' : 'border-dashed border-border/50 bg-muted/30 opacity-50'
                )}
              >
                <div className={cn('p-2 rounded-full', ach.color)}>
                  <ach.icon className="w-4 h-4" />
                </div>
                <span className="text-[9px] font-medium text-center text-muted-foreground">{ach.label}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Edit Spiritual Goals Dialog */}
      <Dialog open={goalsModalOpen} onOpenChange={setGoalsModalOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Personal Spiritual Goals</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-xs font-bold uppercase text-muted-foreground">Personal Focus Theme</label>
              <Input
                value={goals.focusTheme}
                onChange={(e) => setGoals({ ...goals, focusTheme: e.target.value })}
                placeholder="e.g. Walking in daily prayer & Scripture"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-muted-foreground">Devotionals Milestone Target</label>
              <Input
                type="number"
                min={1}
                max={365}
                value={goals.weeklyDevotionalsTarget}
                onChange={(e) => setGoals({ ...goals, weeklyDevotionalsTarget: Math.max(1, Number(e.target.value)) })}
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-muted-foreground">Bible Chapters Target</label>
              <Input
                type="number"
                min={1}
                max={1189}
                value={goals.weeklyChaptersTarget}
                onChange={(e) => setGoals({ ...goals, weeklyChaptersTarget: Math.max(1, Number(e.target.value)) })}
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-muted-foreground">Prayers Target</label>
              <Input
                type="number"
                min={1}
                max={500}
                value={goals.weeklyPrayersTarget}
                onChange={(e) => setGoals({ ...goals, weeklyPrayersTarget: Math.max(1, Number(e.target.value)) })}
              />
            </div>
            <Button onClick={handleSaveGoals} className="w-full rounded-xl">
              Save Spiritual Goals
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}