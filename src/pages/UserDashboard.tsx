import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Flame, BookOpen, Headphones, Heart, Trophy, TrendingUp, Star, Bookmark, ChevronRight, Bell, Clock, Award, Zap } from 'lucide-react'
import { LibraryItem, UserStats } from '@/types/library-news'
import { getUserStats, getLibraryItems, getPrayerAlerts } from '@/data/mockFaithData'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

export function UserDashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState<UserStats | null>(null)
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([])
  const [activePrayers, setActivePrayers] = useState(0)

  useEffect(() => {
    setStats(getUserStats())
    setLibraryItems(getLibraryItems())
    setActivePrayers(getPrayerAlerts().filter(a => a.status === 'active').length)
  }, [])

  if (!stats) return <div className="animate-pulse space-y-4"><div className="h-32 bg-muted rounded-2xl" /><div className="h-20 bg-muted rounded-2xl" /></div>

  const bookmarkedItems = libraryItems.filter(i => stats.bookmarks.includes(i.id))

  const quickLinks = [
    { label: 'Bible Reading', icon: BookOpen, path: '/bible', color: 'text-blue-600 bg-blue-50' },
    { label: 'Faith Guide', icon: Star, path: '/faithguide', color: 'text-purple-600 bg-purple-50' },
    { label: 'Devotional', icon: Zap, path: '/devotional', color: 'text-amber-600 bg-amber-50' },
    { label: 'Journal', icon: Heart, path: '/journal', color: 'text-rose-600 bg-rose-50' },
  ]

  return (
    <div className="space-y-6 pb-24">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-serif text-primary">My Journey</h1>
          <p className="text-sm text-muted-foreground">Welcome back, {user?.name || 'Believer'}</p>
        </div>
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Award className="w-5 h-5 text-primary" />
        </div>
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
                  <span className="text-3xl font-bold">{stats.streak}</span>
                  <span className="text-sm opacity-80">days</span>
                </div>
                <p className="text-xs opacity-70 mt-1">Keep growing in faith daily!</p>
              </div>
              <div className="text-right space-y-2">
                <div className="bg-white/15 rounded-lg px-3 py-1.5">
                  <p className="text-[10px] opacity-80 uppercase">Prayer Hours</p>
                  <p className="text-lg font-bold">{stats.prayerHours}h</p>
                </div>
                <div className="bg-white/15 rounded-lg px-3 py-1.5">
                  <p className="text-[10px] opacity-80 uppercase">Answered</p>
                  <p className="text-lg font-bold">{stats.answeredPrayers}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Stats Grid */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-none shadow-sm bg-secondary/50">
            <CardContent className="p-3 text-center space-y-1">
              <BookOpen className="w-5 h-5 text-blue-600 mx-auto" />
              <p className="text-lg font-bold text-primary">{stats.itemsRead}</p>
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Read</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm bg-secondary/50">
            <CardContent className="p-3 text-center space-y-1">
              <Headphones className="w-5 h-5 text-purple-600 mx-auto" />
              <p className="text-lg font-bold text-primary">{stats.itemsListened}</p>
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Heard</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm bg-secondary/50">
            <CardContent className="p-3 text-center space-y-1">
              <Heart className="w-5 h-5 text-rose-600 mx-auto" />
              <p className="text-lg font-bold text-primary">{activePrayers}</p>
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Prayers</p>
            </CardContent>
          </Card>
        </div>
      </motion.div>

      {/* Continue Listening */}
      {stats.continueListening.length > 0 && (
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-primary uppercase flex items-center gap-1.5">
                <Headphones className="w-4 h-4" /> Continue Listening
              </h3>
              <Button variant="ghost" size="sm" className="text-xs h-7">See All <ChevronRight className="w-3 h-3" /></Button>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
              {stats.continueListening.map(item => (
                <Card key={item.id} className="min-w-[200px] border-none shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-3 space-y-2">
                    <div className="w-full h-20 rounded-lg bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center">
                      <Headphones className="w-6 h-6 text-purple-600" />
                    </div>
                    <h4 className="text-xs font-bold text-primary line-clamp-1">{item.title}</h4>
                    <p className="text-[10px] text-muted-foreground">{item.author}</p>
                    <div className="h-1 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-purple-500 rounded-full" style={{ width: `${item.progress || 40}%` }} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Continue Reading */}
      {stats.continueReading.length > 0 && (
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-primary uppercase flex items-center gap-1.5">
                <BookOpen className="w-4 h-4" /> Continue Reading
              </h3>
              <Button variant="ghost" size="sm" className="text-xs h-7">See All <ChevronRight className="w-3 h-3" /></Button>
            </div>
            <div className="space-y-2">
              {stats.continueReading.map(item => (
                <Card key={item.id} className="border-none shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                      <BookOpen className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-primary truncate">{item.title}</h4>
                      <p className="text-[10px] text-muted-foreground">{item.author}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${item.progress || 20}%` }} />
                        </div>
                        <span className="text-[10px] text-muted-foreground font-medium">{item.progress || 20}%</span>
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
              {bookmarkedItems.map(item => (
                <Badge key={item.id} variant="outline" className="whitespace-nowrap px-3 py-1.5 text-xs font-medium">
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
            {quickLinks.map(link => (
              <Button key={link.label} variant="outline" className="h-auto py-4 flex flex-col items-center gap-2 border-border/40 hover:border-primary/40 hover:bg-primary/5 transition-all">
                <div className={cn("p-2.5 rounded-xl", link.color)}>
                  <link.icon className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold text-primary">{link.label}</span>
              </Button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Weekly Progress */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}>
        <Card className="border-none shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-primary uppercase flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-600" /> Weekly Progress
              </h3>
              <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">+15% this week</Badge>
            </div>
            <div className="flex items-end gap-1.5 h-20">
              {[40, 65, 50, 80, 70, 90, 60].map((h, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <motion.div initial={{ height: 0 }} animate={{ height: `${h}%` }} transition={{ delay: 0.4 + i * 0.05, duration: 0.4 }}
                    className={cn("w-full rounded-t-sm", i === 5 ? "bg-emerald-500" : "bg-primary/20")} />
                  <span className="text-[9px] text-muted-foreground">{['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}</span>
                </div>
              ))}
            </div>
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
            {[
              { label: '7-Day Streak', icon: Flame, earned: true, color: 'text-orange-500 bg-orange-50' },
              { label: 'First Prayer', icon: Heart, earned: true, color: 'text-rose-500 bg-rose-50' },
              { label: 'Bookworm', icon: BookOpen, earned: true, color: 'text-blue-500 bg-blue-50' },
              { label: 'Night Owl', icon: Clock, earned: false, color: 'text-gray-400 bg-gray-50' },
              { label: 'Intercessor', icon: Bell, earned: false, color: 'text-gray-400 bg-gray-50' },
            ].map(ach => (
              <div key={ach.label} className={cn("flex flex-col items-center gap-1.5 min-w-[72px] p-3 rounded-xl border", ach.earned ? "border-border bg-card shadow-sm" : "border-dashed border-border/50 bg-muted/30 opacity-50")}>
                <div className={cn("p-2 rounded-full", ach.color)}>
                  <ach.icon className="w-4 h-4" />
                </div>
                <span className="text-[9px] font-medium text-center text-muted-foreground">{ach.label}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  )
}