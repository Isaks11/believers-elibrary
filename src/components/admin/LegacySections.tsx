/**
 * Legacy Admin sections (Library, Prayer Alerts, News, Moderation).
 *
 * These four sections predate the CMS contract — they keep using the
 * localStorage stores from `src/data/mockFaithData.ts` (plus best-effort
 * Supabase writes) exactly as before, but their inline `ensureAdmin()` checks
 * are replaced by the explicit permission model from `src/lib/permissions.ts`.
 * Behavior (dialogs, toasts, server writes) is unchanged.
 */

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BookOpen, Bell, Plus, Trash2, CheckCircle2, Megaphone, Newspaper, Video, Headphones, FileText, Star, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { LibraryItem, PrayerAlert, NewsItem, MediaType, UrgencyLevel, NewsCategory } from '@/types/library-news'
import {
  getLibraryItems,
  saveLibraryItems,
  addLibraryItem,
  removeLibraryItem,
  approveLibraryItem,
  getPrayerAlerts,
  savePrayerAlerts,
  getNewsItems,
  saveNewsItems,
  syncFaithDataFromServer,
} from '@/data/mockFaithData'
import {
  getModerationReports,
  resolveModerationReport,
  ModerationReport,
} from '@/data/communityData'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { recordWriteOutcome, recordWriteError } from '@/lib/syncHealth'
import { can, type PermissionAction, type UserRole } from '@/lib/permissions'
import { cn } from '@/lib/utils'

/** Shared props: report mutations so the shell can refresh its home stats. */
export type LegacySectionProps = { onChanged?: () => void }

/**
 * `communityData.ts` predates the 5-role model and only understands the legacy
 * 'user' | 'admin' pair — both administrative roles map to 'admin'.
 */
function legacyActorRole(role: UserRole | undefined | null): 'user' | 'admin' {
  return role === 'admin' || role === 'super_admin' ? 'admin' : 'user'
}

/** Permission check with the historical friendly toast. */
function useEnsurePermission() {
  const { user } = useAuth()
  return (action: PermissionAction): boolean => {
    if (!can(user?.role, action)) {
      toast.error('Administrator permissions required')
      return false
    }
    return true
  }
}

// ---------------------------------------------------------------------------
// Library
// ---------------------------------------------------------------------------

export function LibrarySection({ onChanged }: LegacySectionProps) {
  const ensure = useEnsurePermission()
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>(() => getLibraryItems())
  const [showAddMaterial, setShowAddMaterial] = useState(false)

  const [matTitle, setMatTitle] = useState('')
  const [matAuthor, setMatAuthor] = useState('')
  const [matType, setMatType] = useState<MediaType>('book')
  const [matCategory, setMatCategory] = useState('')
  const [matDesc, setMatDesc] = useState('')

  useEffect(() => {
    setLibraryItems(getLibraryItems())
    syncFaithDataFromServer().then((synced) => setLibraryItems(synced.libraryItems))
  }, [])

  const handleDeleteMaterial = (id: string) => {
    if (!ensure('content:delete')) return
    setLibraryItems(removeLibraryItem(id))
    toast.success('Material removed')
    onChanged?.()
  }

  const handleFeatureMaterial = (id: string) => {
    if (!ensure('content:edit')) return
    const updated = libraryItems.map(i => i.id === id ? { ...i, featured: !i.featured } : i)
    saveLibraryItems(updated)
    setLibraryItems(updated)
    const item = updated.find(i => i.id === id)
    if (supabase && item) {
      supabase.from('library_items').update({ featured: Boolean(item.featured) }).eq('id', id).then((res) => recordWriteOutcome('admin', res), (err) => recordWriteError('admin', err))
    }
    toast.success(item?.featured ? 'Marked as featured' : 'Unfeatured')
    onChanged?.()
  }

  const handleApproveMaterial = (id: string) => {
    if (!ensure('content:publish')) return
    setLibraryItems(approveLibraryItem(id, 'approved'))
    toast.success('Material approved and published to E-Library!')
    onChanged?.()
  }

  const handleAddMaterial = () => {
    if (!ensure('content:create')) return
    if (!matTitle.trim() || !matAuthor.trim()) { toast.error('Title and author required'); return }
    const newItem: LibraryItem = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `lib-${Date.now()}`,
      title: matTitle.trim(),
      author: matAuthor.trim(),
      type: matType,
      category: matCategory.trim() || 'General',
      description: matDesc.trim() || 'Admin uploaded material.',
      uploadedAt: new Date().toISOString().split('T')[0],
    }
    setLibraryItems(addLibraryItem(newItem))
    setShowAddMaterial(false)
    setMatTitle(''); setMatAuthor(''); setMatCategory(''); setMatDesc('')
    toast.success('Material added to library')
    onChanged?.()
  }

  const typeIconMap: Record<MediaType, React.ElementType> = { book: BookOpen, audio: Headphones, video: Video, material: FileText }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-bold text-primary uppercase">All Materials ({libraryItems.length})</h3>
        <Button size="sm" className="h-8 gap-1" onClick={() => setShowAddMaterial(true)}>
          <Plus className="w-3.5 h-3.5" /> Add
        </Button>
      </div>
      <div className="space-y-2">
        {libraryItems.map(item => {
          const Icon = typeIconMap[item.type]
          return (
            <Card key={item.id} className="border-none shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-3 flex items-center gap-3">
                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                  item.type === 'book' ? 'bg-blue-100 text-blue-700' : item.type === 'audio' ? 'bg-purple-100 text-purple-700' : item.type === 'video' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                )}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-xs font-bold text-primary truncate">{item.title}</h4>
                    {item.approvalStatus === 'pending' && (
                      <Badge className="bg-amber-100 text-amber-800 text-[9px] px-1.5 py-0">Pending</Badge>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground">{item.author} • {item.category}</p>
                </div>
                <div className="flex items-center gap-1">
                  {item.approvalStatus === 'pending' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[10px] px-2 text-emerald-700 border-emerald-300 bg-emerald-50 hover:bg-emerald-100"
                      onClick={() => handleApproveMaterial(item.id)}
                    >
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Approve
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className={cn("h-7 w-7 p-0", item.featured && "text-amber-500")} onClick={() => handleFeatureMaterial(item.id)}>
                    <Star className={cn("w-3.5 h-3.5", item.featured && "fill-amber-500")} />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" onClick={() => handleDeleteMaterial(item.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Add Material Dialog */}
      <Dialog open={showAddMaterial} onOpenChange={setShowAddMaterial}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader><DialogTitle>Add New Material</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <Input value={matTitle} onChange={e => setMatTitle(e.target.value)} placeholder="Title" />
            <Input value={matAuthor} onChange={e => setMatAuthor(e.target.value)} placeholder="Author/Speaker" />
            <div className="grid grid-cols-2 gap-2">
              <Select value={matType} onValueChange={v => setMatType(v as MediaType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="book">Book</SelectItem>
                  <SelectItem value="audio">Audio</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="material">Material</SelectItem>
                </SelectContent>
              </Select>
              <Input value={matCategory} onChange={e => setMatCategory(e.target.value)} placeholder="Category" />
            </div>
            <Textarea value={matDesc} onChange={e => setMatDesc(e.target.value)} placeholder="Description" className="min-h-[60px]" />
            <Button className="w-full" onClick={handleAddMaterial}>Add to Library</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Prayer Alerts
// ---------------------------------------------------------------------------

export function PrayerSection({ onChanged }: LegacySectionProps) {
  const { user } = useAuth()
  const ensure = useEnsurePermission()
  const [prayerAlerts, setPrayerAlerts] = useState<PrayerAlert[]>(() => getPrayerAlerts())
  const [showBroadcast, setShowBroadcast] = useState(false)

  const [bcTitle, setBcTitle] = useState('')
  const [bcDesc, setBcDesc] = useState('')
  const [bcUrgency, setBcUrgency] = useState<UrgencyLevel>('critical')

  useEffect(() => {
    setPrayerAlerts(getPrayerAlerts())
    syncFaithDataFromServer().then((synced) => setPrayerAlerts(synced.prayerAlerts))
  }, [])

  const handleBroadcast = () => {
    if (!ensure('content:publish')) return
    if (!bcTitle.trim() || !bcDesc.trim()) { toast.error('All fields required'); return }
    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `pr-${Date.now()}`
    const newAlert: PrayerAlert = {
      id,
      title: bcTitle.trim(),
      description: bcDesc.trim(),
      urgency: bcUrgency,
      prayerCount: 0,
      userPrayed: false,
      status: 'active',
      createdAt: new Date().toISOString(),
      reminderEnabled: false,
      submittedBy: user?.name || 'Admin',
    }
    const updated = [newAlert, ...prayerAlerts]
    savePrayerAlerts(updated)
    setPrayerAlerts(updated)
    if (supabase && user) {
      supabase
        .from('prayer_alerts')
        .insert({
          id,
          title: newAlert.title,
          description: newAlert.description,
          urgency: newAlert.urgency,
          status: 'active',
          submitted_by: newAlert.submittedBy,
          created_by: user.id,
        })
        .then((res) => recordWriteOutcome('admin', res), (err) => recordWriteError('admin', err))
    }
    setShowBroadcast(false)
    setBcTitle(''); setBcDesc('')
    toast.success('Prayer alert broadcast to all users!')
    onChanged?.()
  }

  const handleUpdateAlertStatus = (id: string, status: 'answered' | 'archived') => {
    if (!ensure('content:edit')) return
    const updated = prayerAlerts.map(a => a.id === id ? { ...a, status } : a)
    savePrayerAlerts(updated)
    setPrayerAlerts(updated)
    if (supabase) {
      supabase.from('prayer_alerts').update({ status }).eq('id', id).then((res) => recordWriteOutcome('admin', res), (err) => recordWriteError('admin', err))
    }
    toast.success(status === 'answered' ? 'Marked as answered prayer!' : 'Alert archived')
    onChanged?.()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-bold text-primary uppercase">Active Alerts</h3>
        <Button size="sm" className="h-8 gap-1" onClick={() => setShowBroadcast(true)}>
          <Megaphone className="w-3.5 h-3.5" /> Broadcast
        </Button>
      </div>
      <div className="space-y-2">
        {prayerAlerts.filter(a => a.status === 'active').map(alert => (
          <Card key={alert.id} className={cn("border-none shadow-sm border-l-4", alert.urgency === 'critical' ? "border-l-red-500" : alert.urgency === 'daily' ? "border-l-amber-500" : "border-l-blue-500")}>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-primary truncate">{alert.title}</h4>
                  <Badge className={cn("text-[9px] px-1.5 py-0", alert.urgency === 'critical' ? "bg-red-100 text-red-700" : alert.urgency === 'daily' ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700")}>
                    {alert.urgency}
                  </Badge>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">{alert.prayerCount} prayed • {alert.submittedBy}</p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-[10px] text-emerald-600 hover:text-emerald-700 px-2"
                  onClick={() => handleUpdateAlertStatus(alert.id, 'answered')}
                  title="Mark as Answered"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Answered
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-[10px] px-2" onClick={() => handleUpdateAlertStatus(alert.id, 'archived')}>
                  Archive
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Broadcast Prayer Alert Dialog */}
      <Dialog open={showBroadcast} onOpenChange={setShowBroadcast}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader><DialogTitle>Broadcast Prayer Alert</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <Input value={bcTitle} onChange={e => setBcTitle(e.target.value)} placeholder="Alert title" />
            <Textarea value={bcDesc} onChange={e => setBcDesc(e.target.value)} placeholder="Describe the prayer need..." className="min-h-[80px]" />
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase mb-2 block">Urgency Level</label>
              <div className="flex gap-2">
                {(['critical', 'daily', 'community'] as UrgencyLevel[]).map(u => (
                  <button key={u} onClick={() => setBcUrgency(u)}
                    className={cn("px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-all",
                      bcUrgency === u ? (u === 'critical' ? "bg-red-600 text-white" : u === 'daily' ? "bg-amber-500 text-white" : "bg-blue-600 text-white") : "bg-secondary text-secondary-foreground"
                    )}>
                    {u}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-secondary/50 border border-border/50">
              <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Push Preview</p>
              <p className="text-xs font-medium text-primary">{bcTitle || 'Alert title will appear here'}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{bcDesc ? bcDesc.slice(0, 80) + '...' : 'Description preview...'}</p>
            </div>
            <Button className="w-full bg-red-600 hover:bg-red-700" onClick={handleBroadcast}>
              <Megaphone className="w-4 h-4 mr-1" /> Broadcast Now
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// News
// ---------------------------------------------------------------------------

export function NewsSection({ onChanged }: LegacySectionProps) {
  const { user } = useAuth()
  const ensure = useEnsurePermission()
  const [newsItems, setNewsItems] = useState<NewsItem[]>(() => getNewsItems())
  const [showPublishNews, setShowPublishNews] = useState(false)
  const [previewNews, setPreviewNews] = useState<NewsItem | null>(null)

  const [newsTitle, setNewsTitle] = useState('')
  const [newsExcerpt, setNewsExcerpt] = useState('')
  const [newsContent, setNewsContent] = useState('')
  const [newsCategory, setNewsCategory] = useState<NewsCategory>('church')
  const [newsAuthor, setNewsAuthor] = useState('')

  useEffect(() => {
    setNewsItems(getNewsItems())
    syncFaithDataFromServer().then((synced) => setNewsItems(synced.newsItems))
  }, [])

  const handlePublishNews = () => {
    if (!ensure('content:publish')) return
    if (!newsTitle.trim() || !newsContent.trim()) { toast.error('Title and content required'); return }
    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `news-${Date.now()}`
    const newItem: NewsItem = {
      id,
      title: newsTitle.trim(),
      excerpt: newsExcerpt.trim() || newsContent.trim().slice(0, 100),
      content: newsContent.trim(),
      category: newsCategory,
      publishDate: new Date().toISOString().split('T')[0],
      readTime: Math.max(1, Math.ceil(newsContent.trim().split(' ').length / 200)),
      author: newsAuthor.trim() || user?.name || 'Admin',
    }
    const updated = [newItem, ...newsItems]
    saveNewsItems(updated)
    setNewsItems(updated)
    if (supabase && user) {
      supabase
        .from('news_items')
        .insert({
          id,
          title: newItem.title,
          excerpt: newItem.excerpt,
          content: newItem.content,
          category: newItem.category,
          author: newItem.author,
          read_time: newItem.readTime,
          publish_date: newItem.publishDate,
          created_by: user.id,
        })
        .then((res) => recordWriteOutcome('admin', res), (err) => recordWriteError('admin', err))
    }
    setShowPublishNews(false)
    setNewsTitle(''); setNewsExcerpt(''); setNewsContent(''); setNewsAuthor('')
    toast.success('News article published!')
    onChanged?.()
  }

  const handleDeleteNews = (id: string) => {
    if (!ensure('content:delete')) return
    const updated = newsItems.filter(n => n.id !== id)
    saveNewsItems(updated)
    setNewsItems(updated)
    if (supabase) {
      supabase.from('news_items').delete().eq('id', id).then((res) => recordWriteOutcome('admin', res), (err) => recordWriteError('admin', err))
    }
    toast.success('Article deleted')
    onChanged?.()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-bold text-primary uppercase">Published Articles</h3>
        <Button size="sm" className="h-8 gap-1" onClick={() => setShowPublishNews(true)}>
          <Plus className="w-3.5 h-3.5" /> Publish
        </Button>
      </div>
      <div className="space-y-2">
        {newsItems.map(item => (
          <Card key={item.id} className="border-none shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                <Newspaper className="w-4 h-4 text-violet-700" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-primary truncate">{item.title}</h4>
                <p className="text-[10px] text-muted-foreground">{item.category} • {item.publishDate} • {item.readTime}min</p>
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setPreviewNews(item)} aria-label="Preview article">
                  <Eye className="w-3.5 h-3.5" />
                </Button>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500" onClick={() => handleDeleteNews(item.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* News Preview Dialog */}
      <Dialog open={!!previewNews} onOpenChange={(open) => { if (!open) setPreviewNews(null) }}>
        <DialogContent className="max-w-sm rounded-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif leading-snug">{previewNews?.title}</DialogTitle>
          </DialogHeader>
          {previewNews && (
            <div className="space-y-3 mt-1">
              <p className="text-[10px] text-muted-foreground font-bold uppercase">
                {previewNews.category} • {previewNews.publishDate} • {previewNews.readTime} min read • {previewNews.author}
              </p>
              <p className="text-sm font-medium text-primary">{previewNews.excerpt}</p>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{previewNews.content}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Publish News Dialog */}
      <Dialog open={showPublishNews} onOpenChange={setShowPublishNews}>
        <DialogContent className="max-w-sm rounded-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Publish News Article</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <Input value={newsTitle} onChange={e => setNewsTitle(e.target.value)} placeholder="Article headline" />
            <Input value={newsAuthor} onChange={e => setNewsAuthor(e.target.value)} placeholder="Author name" />
            <div className="grid grid-cols-2 gap-2">
              <Select value={newsCategory} onValueChange={v => setNewsCategory(v as NewsCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Global</SelectItem>
                  <SelectItem value="church">Church</SelectItem>
                  <SelectItem value="youth">Youth</SelectItem>
                  <SelectItem value="outreach">Outreach</SelectItem>
                </SelectContent>
              </Select>
              <Input value={newsExcerpt} onChange={e => setNewsExcerpt(e.target.value)} placeholder="Short excerpt" />
            </div>
            <Textarea value={newsContent} onChange={e => setNewsContent(e.target.value)} placeholder="Full article content..." className="min-h-[120px]" />
            <Button className="w-full" onClick={handlePublishNews}>
              <Newspaper className="w-4 h-4 mr-1" /> Publish Article
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Community Moderation
// ---------------------------------------------------------------------------

export function ModerationSection({ onChanged }: LegacySectionProps) {
  const { user } = useAuth()
  const ensure = useEnsurePermission()
  const [modReports, setModReports] = useState<ModerationReport[]>(() => getModerationReports())

  useEffect(() => {
    setModReports(getModerationReports())
  }, [])

  const handleResolve = async (rep: ModerationReport, decision: 'resolved_dismissed' | 'resolved_removed') => {
    if (!ensure('moderation:manage')) return
    const res = await resolveModerationReport(rep.id, decision, legacyActorRole(user?.role))
    if (!res.ok) {
      toast.error(res.error || 'Action denied')
      return
    }
    setModReports(res.reports)
    toast.success(decision === 'resolved_dismissed' ? 'Report dismissed; content restored' : 'Flagged content removed')
    onChanged?.()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-bold text-primary uppercase">
          Community Safeguarding Queue ({modReports.length})
        </h3>
      </div>
      {modReports.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6 text-center">
          No community reports have been filed.
        </p>
      ) : (
        <div className="space-y-2.5">
          {modReports.map((rep) => (
            <Card key={rep.id} className="border-none shadow-sm">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-primary">
                    {rep.targetType.toUpperCase()} by {rep.targetAuthor}
                  </span>
                  <Badge
                    variant={rep.status === 'pending' ? 'default' : 'secondary'}
                    className="text-[9px]"
                  >
                    {rep.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground italic">“{rep.targetSnippet}”</p>
                <p className="text-[10px] text-muted-foreground">
                  Reason: <strong>{rep.reason.replace(/_/g, ' ')}</strong> • Reported by {rep.reporterEmail}
                </p>
                {rep.status === 'pending' && (
                  <div className="flex justify-end gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[10px]"
                      onClick={() => handleResolve(rep, 'resolved_dismissed')}
                    >
                      Dismiss Report
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7 text-[10px]"
                      onClick={() => handleResolve(rep, 'resolved_removed')}
                    >
                      Remove Content
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
