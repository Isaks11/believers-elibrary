import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  ChevronLeft, ChevronDown, Calendar, CalendarDays, CheckCircle2,
  Lock, Play, Pause, Music2, Share2, Bookmark, BookmarkCheck, Type,
  Heart, NotebookPen, Flame, Mic, BookOpen, Clock, GitBranch
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  BIBLE_VERSIONS, BIBLE_VERSION_LABELS, MONTHS, DAYS_OF_WEEK, DEVOTIONAL_YEARS
} from '@/types/devotional-hymn'
import type { DevotionalEntry, BibleVersion } from '@/types/devotional-hymn'
import {
  getDevotionals, saveDevotionals, updateDevotional
} from '@/data/mockDevotionalHymnData'

const WEEK_ABBR = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function Devotional() {
  const [devotionals, setDevotionals] = useState<DevotionalEntry[]>(() => getDevotionals())
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(MONTHS[new Date().getMonth()])
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

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
  const bookmarkedCount = devotionals.filter(d => d.year === yearMatches && d.month === month && d.isBookmarked).length

  const selectedEntry = selectedDay ? monthEntries[selectedDay]?.entry : undefined

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

  return (
    <div className="space-y-6 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif text-primary">Daily Devotional</h1>
          <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">{month} {year}</p>
        </div>
        <div className="flex items-center gap-2 bg-accent/20 px-3 py-1.5 rounded-full border border-accent/30">
          <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
          <span className="text-sm font-bold text-primary">{completedCount}</span>
          <span className="text-[10px] text-muted-foreground font-medium">done</span>
        </div>
      </header>

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
            <span className="text-[9px] uppercase font-bold text-muted-foreground">Completed</span>
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
            <span className="text-lg font-bold">{Math.min(30, completedCount + 3)}</span>
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
      <div className="space-y-3">
        {Array.from({ length: Math.ceil((new Date(year, MONTHS.indexOf(month), 1).getDay() + 6) % 7 + Object.keys(monthEntries).length) / 7 }).concat(Array.from({ length: Math.ceil((new Date(year, MONTHS.indexOf(month), 1).getDay() + 6) % 7 + Object.keys(monthEntries).length) / 7 })).slice(0, Math.ceil((new Date(year, MONTHS.indexOf(month), 1).getDay() + 6) % 7 + Object.keys(monthEntries).length) / 7).map((_, w) => {
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
                      isFuture && hasEntry ? 'opacity-60' : ''
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

      {!selectedDay && (
        <div className="py-10 text-center space-y-2">
          <CalendarDays className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="text-sm font-medium text-muted-foreground">Tap any day to open its devotional</p>
        </div>
      )}
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
  const [fontSize, setFontSize] = useState(17)
  const [reflection, setReflection] = useState('')
  const [prayersChecked, setPrayersChecked] = useState<boolean[]>(() => entry.prayerPoints.map(() => false))
  const [completedLocal, setCompletedLocal] = useState(entry.isCompleted ?? false)

  useEffect(() => {
    setVersion('KJV')
    setReflection(localStorage.getItem(`reflection-${entry.id}`) ?? '')
  }, [entry.id])

  const togglePrayer = (i: number) => {
    setPrayersChecked(prev => prev.map((v, idx) => (idx === i ? !v : v)))
  }

  const saveReflection = () => {
    try {
      localStorage.setItem(`reflection-${entry.id}`, reflection)
      toast.success('Reflection saved to your journal')
    } catch {
      toast.error('Could not save reflection')
    }
  }

  const share = async () => {
    try {
      await navigator.share({ title: entry.title, text: `${entry.scriptureRef}
${entry.bibleVersions[version] ?? ''}` })
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
      <div className="relative h-[38vh]">
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
            <Button size="icon" variant="ghost" className={cn('w-8 h-8', isPlaying && 'text-primary')} onClick={() => setIsPlaying(!isPlaying)}>
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
            </Button>
            <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1"><Mic className="w-3 h-3" /> Audio</span>
          </div>
        </div>

        {/* Audio narration */}
        {isPlaying && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="rounded-2xl bg-primary/5 border border-primary/10 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground">
                <Music2 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h4 className="text-xs font-bold text-primary">{entry.title} - narration</h4>
                <p className="text-[10px] text-muted-foreground">Reading in {BIBLE_VERSION_LABELS[version]} • about {entry.readTimeMinutes} min</p>
              </div>
              <Button size="sm" variant="ghost" className="h-8 text-[10px]" onClick={() => setIsPlaying(false)}>Pause</Button>
            </div>
            <div className="mt-3 h-1.5 rounded-full bg-primary/10 overflow-hidden">
              <motion.div className="h-full bg-primary rounded-full" initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration: 180, ease: 'linear' }} />
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
            <BookOpen className="w-3 h-3" /> {BIBLE_VERSION_LABELS[version]}. Switch versions above to compare translations side by side.
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
          <div className="rounded-xl bg-primary/5 border border-primary/10 p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-accent mb-1">Key Thought</p>
            <p className="text-sm italic font-serif text-primary leading-relaxed">{entry.keyThought}</p>
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
              {entry.theme}: what is God speaking to you today through this passage?
            </p>
            <textarea
              value={reflection}
              onChange={e => setReflection(e.target.value)}
              placeholder="Write your journal entry here..."
              className="w-full min-h-[140px] rounded-2xl bg-card border border-border/50 p-4 text-sm font-serif leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
            <Button className="w-full h-12 rounded-2xl gap-2" onClick={saveReflection}>
              <NotebookPen className="w-4 h-4" /> Save to Journal
            </Button>
          </TabsContent>
          <TabsContent value="prayer" className="pt-4 space-y-4">
            <div className="rounded-xl bg-primary/5 border border-primary/10 p-4">
              <h4 className="font-bold text-primary mb-1.5">Today's Prayer</h4>
              <p className="text-foreground/80 leading-relaxed italic text-sm">{entry.prayer}</p>
            </div>
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