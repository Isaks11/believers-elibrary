import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Bell, AlertTriangle, Newspaper, Clock, Heart, Share2, Megaphone, X, ChevronRight, Zap, Bookmark } from 'lucide-react'
import { toast } from 'sonner'
import { PrayerAlert, NewsItem, UrgencyLevel, NewsCategory } from '@/types/library-news'
import { getPrayerAlerts, savePrayerAlerts, getNewsItems, saveNewsItems, toggleBookmark, getUserStats } from '@/data/mockFaithData'
import { cn } from '@/lib/utils'

const urgencyConfig: Record<UrgencyLevel, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  critical: { label: 'URGENT', color: 'text-red-700', bg: 'bg-red-100 border-red-200', icon: AlertTriangle },
  daily: { label: 'DAILY', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: Clock },
  community: { label: 'COMMUNITY', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: Heart },
}

const categoryColors: Record<NewsCategory, string> = {
  global: 'bg-violet-100 text-violet-700', church: 'bg-emerald-100 text-emerald-700',
  youth: 'bg-orange-100 text-orange-700', outreach: 'bg-cyan-100 text-cyan-700',
}

export function PrayerAlertsNews() {
  const [activeTab, setActiveTab] = useState<'prayers' | 'news'>('prayers')
  const [alerts, setAlerts] = useState<PrayerAlert[]>([])
  const [news, setNews] = useState<NewsItem[]>([])
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null)
  const [showPrayerForm, setShowPrayerForm] = useState(false)
  const [prayerTitle, setPrayerTitle] = useState('')
  const [prayerDesc, setPrayerDesc] = useState('')
  const [prayerUrgency, setPrayerUrgency] = useState<UrgencyLevel>('community')
  const [newsFilter, setNewsFilter] = useState<'all' | NewsCategory>('all')
  const [bookmarks, setBookmarks] = useState<string[]>([])

  useEffect(() => {
    setAlerts(getPrayerAlerts())
    setNews(getNewsItems())
    setBookmarks(getUserStats().bookmarks)
  }, [])

  const handlePray = (id: string) => {
    const updated = alerts.map(a => {
      if (a.id === id) {
        const newCount = a.userPrayed ? a.prayerCount - 1 : a.prayerCount + 1
        return { ...a, userPrayed: !a.userPrayed, prayerCount: newCount }
      }
      return a
    })
    setAlerts(updated)
    savePrayerAlerts(updated)
    const alert = updated.find(a => a.id === id)
    toast.success(alert?.userPrayed ? 'Prayer counted. God bless you!' : 'Prayer removed')
  }

  const handleReminder = (id: string) => {
    const updated = alerts.map(a => a.id === id ? { ...a, reminderEnabled: !a.reminderEnabled } : a)
    setAlerts(updated)
    savePrayerAlerts(updated)
    const alert = updated.find(a => a.id === id)
    toast.success(alert?.reminderEnabled ? 'Reminder enabled' : 'Reminder disabled')
  }

  const handleSubmitPrayer = () => {
    if (!prayerTitle.trim() || !prayerDesc.trim()) {
      toast.error('Please fill in all fields')
      return
    }
    const newAlert: PrayerAlert = {
      id: `pr-${Date.now()}`, title: prayerTitle, description: prayerDesc,
      urgency: prayerUrgency, prayerCount: 0, userPrayed: false, status: 'active',
      createdAt: new Date().toISOString(), reminderEnabled: false, submittedBy: 'You',
    }
    const updated = [newAlert, ...alerts]
    setAlerts(updated)
    savePrayerAlerts(updated)
    setShowPrayerForm(false)
    setPrayerTitle('')
    setPrayerDesc('')
    toast.success('Prayer request submitted!')
  }

  const filteredNews = newsFilter === 'all' ? news : news.filter(n => n.category === newsFilter)

  return (
    <div className="space-y-5 pb-24">
      <header>
        <h1 className="text-2xl font-serif text-primary">Prayer & News</h1>
        <p className="text-sm text-muted-foreground">Stay connected through prayer and updates</p>
      </header>

      {/* Breaking News Ticker */}
      {news.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 flex items-center gap-2 overflow-hidden">
          <Zap className="w-4 h-4 text-red-600 shrink-0" />
          <div className="overflow-hidden flex-1">
            <motion.div animate={{ x: [0, -300] }} transition={{ duration: 12, repeat: Infinity, ease: 'linear' }} className="whitespace-nowrap text-xs font-medium text-red-700">
              {news[0].title} • {news[1]?.title} • {news[2]?.title}
            </motion.div>
          </div>
        </div>
      )}

      {/* Tab Switcher */}
      <div className="flex gap-1 bg-secondary/50 rounded-xl p-1">
        <button onClick={() => setActiveTab('prayers')} className={cn("flex-1 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all", activeTab === 'prayers' ? "bg-card shadow-sm text-primary" : "text-muted-foreground")}>
          <Bell className="w-4 h-4" /> Prayer Alerts
        </button>
        <button onClick={() => setActiveTab('news')} className={cn("flex-1 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all", activeTab === 'news' ? "bg-card shadow-sm text-primary" : "text-muted-foreground")}>
          <Newspaper className="w-4 h-4" /> Ministry News
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'prayers' ? (
          <motion.div key="prayers" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-primary uppercase">Active Alerts ({alerts.filter(a => a.status === 'active').length})</h3>
              <Button size="sm" variant="outline" onClick={() => setShowPrayerForm(true)} className="gap-1">
                <Megaphone className="w-3.5 h-3.5" /> Submit Request
              </Button>
            </div>

            {alerts.filter(a => a.status === 'active').map((alert, idx) => {
              const config = urgencyConfig[alert.urgency]
              const UrgIcon = config.icon
              return (
                <motion.div key={alert.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.08 }}>
                  <Card className={cn("border-l-4 shadow-sm hover:shadow-md transition-shadow", alert.urgency === 'critical' ? "border-l-red-500" : alert.urgency === 'daily' ? "border-l-amber-500" : "border-l-blue-500")}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className={cn("flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border", config.bg, config.color)}>
                          <UrgIcon className="w-3 h-3" /> {config.label}
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch checked={alert.reminderEnabled} onCheckedChange={() => handleReminder(alert.id)} className="scale-75" />
                          <Bell className={cn("w-3.5 h-3.5", alert.reminderEnabled ? "text-primary" : "text-muted-foreground")} />
                        </div>
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-primary">{alert.title}</h4>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{alert.description}</p>
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{alert.prayerCount} prayed</span>
                          <span className="text-[10px] text-muted-foreground/60">by {alert.submittedBy}</span>
                        </div>
                        <Button size="sm" onClick={() => handlePray(alert.id)}
                          className={cn("gap-1.5 h-8 text-xs", alert.userPrayed ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-primary hover:bg-primary/90")}>
                          <Heart className={cn("w-3.5 h-3.5", alert.userPrayed && "fill-emerald-600 text-emerald-600")} />
                          {alert.userPrayed ? 'Prayed' : 'I Prayed'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}

            {/* Answered Prayers */}
            {alerts.filter(a => a.status === 'answered').length > 0 && (
              <div className="pt-4 border-t border-border/50">
                <h4 className="text-xs font-bold text-emerald-700 uppercase mb-3 flex items-center gap-1">
                  <Heart className="w-3 h-3 fill-emerald-500 text-emerald-500" /> Answered Prayers
                </h4>
                {alerts.filter(a => a.status === 'answered').map(a => (
                  <div key={a.id} className="text-xs text-muted-foreground py-2 border-b border-border/30 last:border-0">
                    <span className="font-medium text-emerald-700">{a.title}</span> - {a.prayerCount} prayed
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div key="news" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
            {/* News Category Filter */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {(['all', 'global', 'church', 'youth', 'outreach'] as const).map(cat => (
                <button key={cat} onClick={() => setNewsFilter(cat)}
                  className={cn("px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all capitalize",
                    newsFilter === cat ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                  )}>
                  {cat}
                </button>
              ))}
            </div>

            {filteredNews.map((item, idx) => (
              <motion.div key={item.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.06 }}>
                <Card className="border-none shadow-sm hover:shadow-lg transition-all cursor-pointer group overflow-hidden" onClick={() => setSelectedNews(item)}>
                  {item.featured && (
                    <div className="h-32 bg-gradient-to-r from-primary/80 to-emerald-600/80 flex items-center justify-center">
                      <Newspaper className="w-8 h-8 text-white/80" />
                    </div>
                  )}
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={cn("text-[10px] capitalize", categoryColors[item.category])}>{item.category}</Badge>
                      <span className="text-[10px] text-muted-foreground">{item.readTime} min read</span>
                      {item.featured && <Badge className="text-[10px] bg-amber-100 text-amber-700">Featured</Badge>}
                    </div>
                    <h3 className="font-bold text-sm text-primary group-hover:text-primary/80 transition-colors">{item.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.excerpt}</p>
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-[10px] text-muted-foreground">{item.publishDate} • {item.author}</span>
                      <div className="flex gap-1">
                        <button onClick={e => { e.stopPropagation(); const bm = toggleBookmark(item.id); setBookmarks(bm) }}
                          className={cn("p-1.5 rounded-full hover:bg-secondary", bookmarks.includes(item.id) ? "text-amber-500" : "text-muted-foreground")}>
                          <Bookmark className={cn("w-3.5 h-3.5", bookmarks.includes(item.id) && "fill-amber-500")} />
                        </button>
                        <button onClick={e => { e.stopPropagation(); toast.success('Link copied to clipboard') }} className="p-1.5 rounded-full hover:bg-secondary text-muted-foreground">
                          <Share2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* News Article Dialog */}
      <Dialog open={!!selectedNews} onOpenChange={() => setSelectedNews(null)}>
        <DialogContent className="max-w-sm rounded-2xl max-h-[80vh] overflow-y-auto">
          {selectedNews && (
            <div className="space-y-4">
              <DialogHeader>
                <Badge className={cn("w-fit text-[10px] capitalize", categoryColors[selectedNews.category])}>{selectedNews.category}</Badge>
                <DialogTitle className="text-lg font-serif leading-tight">{selectedNews.title}</DialogTitle>
              </DialogHeader>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{selectedNews.author}</span>
                <span>•</span>
                <span>{selectedNews.publishDate}</span>
                <span>•</span>
                <span>{selectedNews.readTime} min read</span>
              </div>
              <div className="h-32 bg-gradient-to-br from-primary/10 to-emerald-500/10 rounded-xl flex items-center justify-center">
                <Newspaper className="w-10 h-10 text-primary/30" />
              </div>
              <p className="text-sm text-foreground leading-relaxed">{selectedNews.content}</p>
              <div className="flex gap-2 pt-2">
                <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => toast.success('Link copied!')}>
                  <Share2 className="w-3.5 h-3.5" /> Share
                </Button>
                <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => {
                  const bm = toggleBookmark(selectedNews.id)
                  setBookmarks(bm)
                  toast.success('Bookmark updated')
                }}>
                  <Bookmark className="w-3.5 h-3.5" /> {bookmarks.includes(selectedNews.id) ? 'Saved' : 'Save'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Prayer Submit Dialog */}
      <Dialog open={showPrayerForm} onOpenChange={setShowPrayerForm}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader><DialogTitle>Submit Prayer Request</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase">Title</label>
              <Input value={prayerTitle} onChange={e => setPrayerTitle(e.target.value)} placeholder="Brief title" className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase">Description</label>
              <Textarea value={prayerDesc} onChange={e => setPrayerDesc(e.target.value)} placeholder="Describe the prayer need..." className="mt-1 min-h-[80px]" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase">Urgency</label>
              <div className="flex gap-2 mt-2">
                {(['critical', 'daily', 'community'] as UrgencyLevel[]).map(u => (
                  <button key={u} onClick={() => setPrayerUrgency(u)}
                    className={cn("px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-all",
                      prayerUrgency === u ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                    )}>
                    {u}
                  </button>
                ))}
              </div>
            </div>
            <Button className="w-full" onClick={handleSubmitPrayer}>Submit Prayer Request</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
