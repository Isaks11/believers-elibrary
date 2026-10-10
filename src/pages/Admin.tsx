import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LayoutDashboard, Users, BookOpen, Bell, BarChart3, Plus, Trash2, Check, Megaphone, Newspaper, FileText, Video, Headphones, Eye, Star, X } from 'lucide-react'
import { toast } from 'sonner'
import { LibraryItem, PrayerAlert, NewsItem, MediaType, UrgencyLevel, NewsCategory } from '@/types/library-news'
import { getLibraryItems, saveLibraryItems, removeLibraryItem, getPrayerAlerts, savePrayerAlerts, getNewsItems, saveNewsItems } from '@/data/mockFaithData'
import { cn } from '@/lib/utils'

export function Admin() {
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([])
  const [prayerAlerts, setPrayerAlerts] = useState<PrayerAlert[]>([])
  const [newsItems, setNewsItems] = useState<NewsItem[]>([])
  const [showAddMaterial, setShowAddMaterial] = useState(false)
  const [showBroadcast, setShowBroadcast] = useState(false)
  const [showPublishNews, setShowPublishNews] = useState(false)

  // Material form
  const [matTitle, setMatTitle] = useState('')
  const [matAuthor, setMatAuthor] = useState('')
  const [matType, setMatType] = useState<MediaType>('book')
  const [matCategory, setMatCategory] = useState('')
  const [matDesc, setMatDesc] = useState('')

  // Broadcast form
  const [bcTitle, setBcTitle] = useState('')
  const [bcDesc, setBcDesc] = useState('')
  const [bcUrgency, setBcUrgency] = useState<UrgencyLevel>('critical')

  // News form
  const [newsTitle, setNewsTitle] = useState('')
  const [newsExcerpt, setNewsExcerpt] = useState('')
  const [newsContent, setNewsContent] = useState('')
  const [newsCategory, setNewsCategory] = useState<NewsCategory>('church')
  const [newsAuthor, setNewsAuthor] = useState('')

  useEffect(() => {
    setLibraryItems(getLibraryItems())
    setPrayerAlerts(getPrayerAlerts())
    setNewsItems(getNewsItems())
  }, [])

  const handleDeleteMaterial = (id: string) => {
    const updated = removeLibraryItem(id)
    setLibraryItems(updated)
    toast.success('Material removed')
  }

  const handleFeatureMaterial = (id: string) => {
    const updated = libraryItems.map(i => i.id === id ? { ...i, featured: !i.featured } : i)
    saveLibraryItems(updated)
    setLibraryItems(updated)
    const item = updated.find(i => i.id === id)
    toast.success(item?.featured ? 'Marked as featured' : 'Unfeatured')
  }

  const handleAddMaterial = () => {
    if (!matTitle.trim() || !matAuthor.trim()) { toast.error('Title and author required'); return }
    const newItem: LibraryItem = {
      id: `lib-${Date.now()}`, title: matTitle, author: matAuthor, type: matType,
      category: matCategory || 'General', description: matDesc || 'Admin uploaded material.',
      uploadedAt: new Date().toISOString().split('T')[0],
    }
    const updated = [newItem, ...libraryItems]
    saveLibraryItems(updated)
    setLibraryItems(updated)
    setShowAddMaterial(false)
    setMatTitle(''); setMatAuthor(''); setMatCategory(''); setMatDesc('')
    toast.success('Material added to library')
  }

  const handleBroadcast = () => {
    if (!bcTitle.trim() || !bcDesc.trim()) { toast.error('All fields required'); return }
    const newAlert: PrayerAlert = {
      id: `pr-${Date.now()}`, title: bcTitle, description: bcDesc, urgency: bcUrgency,
      prayerCount: 0, userPrayed: false, status: 'active',
      createdAt: new Date().toISOString(), reminderEnabled: true, submittedBy: 'Admin',
    }
    const updated = [newAlert, ...prayerAlerts]
    savePrayerAlerts(updated)
    setPrayerAlerts(updated)
    setShowBroadcast(false)
    setBcTitle(''); setBcDesc('')
    toast.success('Prayer alert broadcast to all users!')
  }

  const handlePublishNews = () => {
    if (!newsTitle.trim() || !newsContent.trim()) { toast.error('Title and content required'); return }
    const newItem: NewsItem = {
      id: `news-${Date.now()}`, title: newsTitle, excerpt: newsExcerpt || newsContent.slice(0, 100),
      content: newsContent, category: newsCategory, publishDate: new Date().toISOString().split('T')[0],
      readTime: Math.max(1, Math.ceil(newsContent.split(' ').length / 200)), author: newsAuthor || 'Admin',
    }
    const updated = [newItem, ...newsItems]
    saveNewsItems(updated)
    setNewsItems(updated)
    setShowPublishNews(false)
    setNewsTitle(''); setNewsExcerpt(''); setNewsContent(''); setNewsAuthor('')
    toast.success('News article published!')
  }

  const handleArchiveAlert = (id: string) => {
    const updated = prayerAlerts.map(a => a.id === id ? { ...a, status: 'archived' as const } : a)
    savePrayerAlerts(updated)
    setPrayerAlerts(updated)
    toast.success('Alert archived')
  }

  const handleDeleteNews = (id: string) => {
    const updated = newsItems.filter(n => n.id !== id)
    saveNewsItems(updated)
    setNewsItems(updated)
    toast.success('Article deleted')
  }

  const typeIconMap: Record<MediaType, React.ElementType> = { book: BookOpen, audio: Headphones, video: Video, material: FileText }

  return (
    <div className="space-y-6 pb-24">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-serif text-primary">Admin Control</h1>
          <p className="text-xs text-muted-foreground font-bold uppercase">Management Dashboard</p>
        </div>
        <div className="p-2 bg-primary/10 rounded-xl">
          <LayoutDashboard className="w-5 h-5 text-primary" />
        </div>
      </header>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-primary text-primary-foreground border-none shadow-lg">
          <CardContent className="p-4 space-y-1">
            <BookOpen className="w-5 h-5 opacity-80" />
            <div className="text-2xl font-bold">{libraryItems.length}</div>
            <div className="text-[10px] font-bold uppercase opacity-80">Library Items</div>
          </CardContent>
        </Card>
        <Card className="bg-emerald-600 text-white border-none shadow-lg">
          <CardContent className="p-4 space-y-1">
            <Bell className="w-5 h-5 opacity-80" />
            <div className="text-2xl font-bold">{prayerAlerts.filter(a => a.status === 'active').length}</div>
            <div className="text-[10px] font-bold uppercase opacity-80">Active Alerts</div>
          </CardContent>
        </Card>
        <Card className="bg-violet-600 text-white border-none shadow-lg">
          <CardContent className="p-4 space-y-1">
            <Users className="w-5 h-5 opacity-80" />
            <div className="text-2xl font-bold">124.5k</div>
            <div className="text-[10px] font-bold uppercase opacity-80">Users</div>
          </CardContent>
        </Card>
        <Card className="bg-amber-600 text-white border-none shadow-lg">
          <CardContent className="p-4 space-y-1">
            <Newspaper className="w-5 h-5 opacity-80" />
            <div className="text-2xl font-bold">{newsItems.length}</div>
            <div className="text-[10px] font-bold uppercase opacity-80">Articles</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="library" className="w-full">
        <TabsList className="w-full bg-muted/50 p-1 rounded-xl grid grid-cols-3">
          <TabsTrigger value="library" className="text-xs rounded-lg">Library</TabsTrigger>
          <TabsTrigger value="prayers" className="text-xs rounded-lg">Prayers</TabsTrigger>
          <TabsTrigger value="news" className="text-xs rounded-lg">News</TabsTrigger>
        </TabsList>

        {/* Library Tab */}
        <TabsContent value="library" className="pt-4 space-y-4">
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
                      <h4 className="text-xs font-bold text-primary truncate">{item.title}</h4>
                      <p className="text-[10px] text-muted-foreground">{item.author} • {item.category}</p>
                    </div>
                    <div className="flex items-center gap-1">
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
        </TabsContent>

        {/* Prayers Tab */}
        <TabsContent value="prayers" className="pt-4 space-y-4">
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
                  <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => handleArchiveAlert(alert.id)}>
                    Archive
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* News Tab */}
        <TabsContent value="news" className="pt-4 space-y-4">
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
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => toast.info('Preview opened')}>
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
        </TabsContent>
      </Tabs>

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
