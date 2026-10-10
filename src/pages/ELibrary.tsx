import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BookOpen, Headphones, Video, FileText, Search, Upload, Play, Pause, Bookmark, Download, X, Filter, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { LibraryItem, MediaType } from '@/types/library-news'
import { getLibraryItems, saveLibraryItems, toggleBookmark, getUserStats, saveUserStats } from '@/data/mockFaithData'
import { cn } from '@/lib/utils'

const typeIcons: Record<MediaType, React.ElementType> = {
  book: BookOpen, audio: Headphones, video: Video, material: FileText,
}

const typeColors: Record<MediaType, string> = {
  book: 'bg-blue-100 text-blue-700', audio: 'bg-purple-100 text-purple-700',
  video: 'bg-rose-100 text-rose-700', material: 'bg-emerald-100 text-emerald-700',
}

export function ELibrary() {
  const [items, setItems] = useState<LibraryItem[]>([])
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | MediaType>('all')
  const [selectedItem, setSelectedItem] = useState<LibraryItem | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [bookmarks, setBookmarks] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(false)
  const [category, setCategory] = useState('all')

  // Upload form state
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadAuthor, setUploadAuthor] = useState('')
  const [uploadType, setUploadType] = useState<MediaType>('book')
  const [uploadCategory, setUploadCategory] = useState('')
  const [uploadDesc, setUploadDesc] = useState('')

  useEffect(() => {
    setItems(getLibraryItems())
    setBookmarks(getUserStats().bookmarks)
  }, [])

  const categories = ['all', ...Array.from(new Set(items.map(i => i.category)))]

  const filtered = items.filter(item => {
    if (activeTab !== 'all' && item.type !== activeTab) return false
    if (category !== 'all' && item.category !== category) return false
    if (search && !item.title.toLowerCase().includes(search.toLowerCase()) && !item.author.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const handleBookmark = (id: string) => {
    const bm = toggleBookmark(id)
    setBookmarks(bm)
    toast.success(bm.includes(id) ? 'Added to bookmarks' : 'Removed from bookmarks')
  }

  const handleUpload = () => {
    if (!uploadTitle.trim() || !uploadAuthor.trim()) {
      toast.error('Please fill in title and author')
      return
    }
    const newItem: LibraryItem = {
      id: `lib-${Date.now()}`,
      title: uploadTitle,
      author: uploadAuthor,
      type: uploadType,
      category: uploadCategory || 'General',
      description: uploadDesc || 'User uploaded material.',
      uploadedAt: new Date().toISOString().split('T')[0],
    }
    const updated = [newItem, ...items]
    saveLibraryItems(updated)
    setItems(updated)
    setShowUpload(false)
    setUploadTitle('')
    setUploadAuthor('')
    setUploadCategory('')
    setUploadDesc('')
    toast.success('Material uploaded successfully!')
  }

  const openItem = (item: LibraryItem) => {
    setSelectedItem(item)
    setIsPlaying(false)
    setProgress(0)
  }

  const tabs: { key: 'all' | MediaType; label: string; icon: React.ElementType }[] = [
    { key: 'all', label: 'All', icon: Filter },
    { key: 'book', label: 'Books', icon: BookOpen },
    { key: 'audio', label: 'Audio', icon: Headphones },
    { key: 'video', label: 'Video', icon: Video },
    { key: 'material', label: 'Guides', icon: FileText },
  ]

  return (
    <div className="space-y-5 pb-24">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-serif text-primary">E-Library</h1>
          <p className="text-sm text-muted-foreground">Books, sermons, teachings & resources</p>
        </div>
        <Button size="sm" onClick={() => setShowUpload(true)} className="gap-1">
          <Upload className="w-4 h-4" /> Upload
        </Button>
      </header>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search titles, authors..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 rounded-xl bg-secondary/50 border-none" />
      </div>

      {/* Type Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={cn("flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all",
              activeTab === tab.key ? "bg-primary text-primary-foreground shadow-md" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            )}>
            <tab.icon className="w-3.5 h-3.5" /> {tab.label}
          </button>
        ))}
      </div>

      {/* Category Filter */}
      <div className="flex items-center gap-2">
        <button onClick={() => setShowFilters(!showFilters)} className="text-xs font-medium text-muted-foreground flex items-center gap-1">
          <Filter className="w-3 h-3" /> Category
        </button>
        <AnimatePresence>
          {showFilters && (
            <motion.div initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }} exit={{ opacity: 0, width: 0 }} className="overflow-hidden">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-40 h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{categories.map(c => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}</SelectContent>
              </Select>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Items Grid */}
      <motion.div layout className="grid grid-cols-1 gap-4">
        <AnimatePresence mode="popLayout">
          {filtered.map((item, idx) => {
            const Icon = typeIcons[item.type]
            return (
              <motion.div key={item.id} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ delay: idx * 0.05 }}>
                <Card className="border-none shadow-sm hover:shadow-lg transition-all cursor-pointer group overflow-hidden" onClick={() => openItem(item)}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", typeColors[item.type])}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-bold text-sm text-primary truncate">{item.title}</h3>
                          <button onClick={e => { e.stopPropagation(); handleBookmark(item.id) }} className={cn("p-1 rounded-full transition-colors", bookmarks.includes(item.id) ? "text-amber-500" : "text-muted-foreground hover:text-amber-500")}>
                            <Bookmark className={cn("w-4 h-4", bookmarks.includes(item.id) && "fill-amber-500")} />
                          </button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.author}</p>
                        <p className="text-xs text-muted-foreground/70 line-clamp-2 mt-1">{item.description}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{item.category}</Badge>
                          {item.duration && <span className="text-[10px] text-muted-foreground font-mono">{item.duration}</span>}
                          {item.pages && <span className="text-[10px] text-muted-foreground">{item.pages} pages</span>}
                        </div>
                        {item.progress !== undefined && (
                          <div className="mt-2">
                            <div className="h-1 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${item.progress}%` }} />
                            </div>
                            <span className="text-[10px] text-muted-foreground">{item.progress}% complete</span>
                          </div>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity self-center" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </AnimatePresence>
        {filtered.length === 0 && (
          <div className="text-center py-12">
            <BookOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No materials found matching your filters.</p>
          </div>
        )}
      </motion.div>

      {/* Media Preview Dialog */}
      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="max-w-sm rounded-2xl">
          {selectedItem && (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle className="text-lg font-serif">{selectedItem.title}</DialogTitle>
              </DialogHeader>
              <div className="aspect-video bg-gradient-to-br from-primary/10 to-emerald-500/10 rounded-xl flex items-center justify-center relative overflow-hidden">
                {selectedItem.type === 'audio' || selectedItem.type === 'video' ? (
                  <>
                    <motion.div animate={isPlaying ? { scale: [1, 1.1, 1] } : {}} transition={{ repeat: Infinity, duration: 1.5 }} className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                      <button onClick={() => setIsPlaying(!isPlaying)} className="w-full h-full flex items-center justify-center">
                        {isPlaying ? <Pause className="w-8 h-8 text-primary" /> : <Play className="w-8 h-8 text-primary ml-1" />}
                      </button>
                    </motion.div>
                    {isPlaying && (
                      <motion.div className="absolute bottom-4 left-4 right-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <div className="h-1 bg-muted rounded-full overflow-hidden">
                          <motion.div className="h-full bg-primary rounded-full" animate={{ width: `${progress}%` }} transition={{ duration: 0.5 }} />
                        </div>
                        <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                          <span>{Math.round(progress)}%</span>
                          <span>{selectedItem.duration}</span>
                        </div>
                      </motion.div>
                    )}
                  </>
                ) : (
                  <div className="p-6 text-center">
                    <BookOpen className="w-10 h-10 text-primary/50 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground max-w-[200px]">{selectedItem.content || selectedItem.description}</p>
                  </div>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{selectedItem.description}</p>
              <div className="flex gap-2">
                <Button size="sm" className="flex-1 gap-1" onClick={() => {
                  if (selectedItem.type === 'audio' || selectedItem.type === 'video') {
                    setIsPlaying(true)
                    setProgress(0)
                    const interval = setInterval(() => setProgress(p => { if (p >= 100) { clearInterval(interval); return 100 }; return p + 2 }), 300)
                  } else {
                    toast.success('Opening reader...')
                  }
                }}>
                  <Play className="w-4 h-4" /> {selectedItem.type === 'book' ? 'Read Now' : selectedItem.type === 'material' ? 'Open Guide' : 'Listen'}
                </Button>
                <Button size="sm" variant="outline" className="gap-1" onClick={() => toast.success('Download started')}>
                  <Download className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Upload Sheet */}
      <Sheet open={showUpload} onOpenChange={setShowUpload}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh] overflow-y-auto">
          <SheetHeader><SheetTitle>Upload New Material</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase">Title</label>
              <Input value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} placeholder="Material title" className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase">Author / Speaker</label>
              <Input value={uploadAuthor} onChange={e => setUploadAuthor(e.target.value)} placeholder="Author name" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase">Type</label>
                <Select value={uploadType} onValueChange={v => setUploadType(v as MediaType)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="book">Book</SelectItem>
                    <SelectItem value="audio">Audio</SelectItem>
                    <SelectItem value="video">Video</SelectItem>
                    <SelectItem value="material">Material</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase">Category</label>
                <Input value={uploadCategory} onChange={e => setUploadCategory(e.target.value)} placeholder="e.g. Theology" className="mt-1" />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase">Description</label>
              <Input value={uploadDesc} onChange={e => setUploadDesc(e.target.value)} placeholder="Brief description" className="mt-1" />
            </div>
            <Button className="w-full" onClick={handleUpload}>Upload Material</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
