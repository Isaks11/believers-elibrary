import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { can } from '@/lib/permissions'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  BookOpen,
  Headphones,
  Video,
  FileText,
  Search,
  Upload,
  Play,
  Pause,
  Bookmark,
  Download,
  Filter,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  Volume2,
  Clock,
} from 'lucide-react'
import { toast } from 'sonner'
import { LibraryItem, MediaType } from '@/types/library-news'
import {
  getLibraryItems,
  addLibraryItem,
  setLibraryItemProgress,
  toggleBookmark,
  getUserStats,
  syncFaithDataFromServer,
} from '@/data/mockFaithData'
import { addJournalEntry } from '@/data/journalData'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

const typeIcons: Record<MediaType, React.ElementType> = {
  book: BookOpen,
  audio: Headphones,
  video: Video,
  material: FileText,
}

const typeColors: Record<MediaType, string> = {
  book: 'bg-blue-100 text-blue-700',
  audio: 'bg-purple-100 text-purple-700',
  video: 'bg-rose-100 text-rose-700',
  material: 'bg-emerald-100 text-emerald-700',
}

export function ELibrary() {
  const { user } = useAuth()
  const [items, setItems] = useState<LibraryItem[]>(() => getLibraryItems())
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | MediaType>('all')
  const [selectedItem, setSelectedItem] = useState<LibraryItem | null>(null)
  const [isReading, setIsReading] = useState(false)
  const [chapterIndex, setChapterIndex] = useState(0)
  const [showUpload, setShowUpload] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speechRate, setSpeechRate] = useState(1.0)
  const [progress, setProgress] = useState(0)
  const [bookmarks, setBookmarks] = useState<string[]>(() => getUserStats().bookmarks)
  const [showFilters, setShowFilters] = useState(false)
  const [category, setCategory] = useState('all')

  // Upload form state
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadAuthor, setUploadAuthor] = useState('')
  const [uploadPublisher, setUploadPublisher] = useState('')
  const [uploadLicense, setUploadLicense] = useState('Public Domain / Ministry Permission Granted')
  const [uploadType, setUploadType] = useState<MediaType>('book')
  const [uploadCategory, setUploadCategory] = useState('')
  const [uploadDesc, setUploadDesc] = useState('')
  const [uploadContent, setUploadContent] = useState('')
  const [uploadFileUrl, setUploadFileUrl] = useState<string | undefined>(undefined)
  const [uploadFileName, setUploadFileName] = useState<string | undefined>(undefined)

  const mediaRef = useRef<HTMLAudioElement | HTMLVideoElement | null>(null)

  useEffect(() => {
    setItems(getLibraryItems())
    setBookmarks(getUserStats().bookmarks)
    syncFaithDataFromServer().then((synced) => {
      setItems(synced.libraryItems)
      setBookmarks(synced.bookmarks)
    })
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  const stopAllAudio = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    if (mediaRef.current) {
      mediaRef.current.pause()
    }
    setIsPlaying(false)
  }

  const categories = ['all', ...Array.from(new Set(items.map((i) => i.category)))]

  const filtered = items.filter((item) => {
    // Show approved items, or pending items uploaded by current user / visible to admin
    if (item.approvalStatus === 'pending' && user?.role !== 'admin' && item.uploadedBy !== user?.email) {
      return false
    }
    if (activeTab !== 'all' && item.type !== activeTab) return false
    if (category !== 'all' && item.category !== category) return false
    if (
      search &&
      !item.title.toLowerCase().includes(search.toLowerCase()) &&
      !item.author.toLowerCase().includes(search.toLowerCase()) &&
      !item.description.toLowerCase().includes(search.toLowerCase())
    )
      return false
    return true
  })

  const handleBookmark = (id: string) => {
    const bm = toggleBookmark(id, 'library')
    setBookmarks(bm)
    toast.success(bm.includes(id) ? 'Added to bookmarks' : 'Removed from bookmarks')
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadFileName(file.name)
    if (!uploadTitle) {
      setUploadTitle(file.name.replace(/\.[^/.]+$/, ''))
    }

    if (file.name.endsWith('.txt') || file.name.endsWith('.md')) {
      const reader = new FileReader()
      reader.onload = () => {
        const text = String(reader.result || '')
        setUploadContent(text)
        toast.success(`Loaded text content from ${file.name}`)
      }
      reader.readAsText(file)
    } else if (file.size <= 4 * 1024 * 1024) {
      const reader = new FileReader()
      reader.onload = () => {
        setUploadFileUrl(String(reader.result || ''))
        toast.success(`Attached media file ${file.name}`)
      }
      reader.readAsDataURL(file)
    } else {
      const objUrl = URL.createObjectURL(file)
      setUploadFileUrl(objUrl)
      toast.success(`Attached ${file.name} for current session`)
    }
  }

  const handleUpload = () => {
    if (!uploadTitle.trim() || !uploadAuthor.trim()) {
      toast.error('Please fill in title and author')
      return
    }
    if (!uploadLicense.trim()) {
      toast.error('Please specify content license or distribution permission')
      return
    }

    const isAdmin = can(user?.role, 'content:publish')
    const rawBody = uploadContent.trim() || uploadDesc.trim() || 'User contributed Christian study material.'
    const paragraphs = rawBody.split(/\n\s*\n/).filter(Boolean)
    const generatedChapters =
      paragraphs.length > 1
        ? paragraphs.map((p, idx) => ({
            title: `Section ${idx + 1}`,
            content: p,
          }))
        : [{ title: 'Complete Text', content: rawBody }]

    const newItem: LibraryItem = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `lib-${Date.now()}`,
      title: uploadTitle.trim(),
      author: uploadAuthor.trim(),
      publisher: uploadPublisher.trim() || 'Community Contributor',
      license: uploadLicense.trim(),
      type: uploadType,
      category: uploadCategory.trim() || 'General',
      description: uploadDesc.trim() || rawBody.slice(0, 140),
      content: rawBody,
      chapters: generatedChapters,
      fileUrl: uploadFileUrl,
      fileName: uploadFileName,
      approvalStatus: isAdmin ? 'approved' : 'pending',
      uploadedBy: user?.email || 'local',
      uploadedAt: new Date().toISOString().split('T')[0],
    }
    const updated = addLibraryItem(newItem)
    setItems(updated)
    setShowUpload(false)
    setUploadTitle('')
    setUploadAuthor('')
    setUploadPublisher('')
    setUploadCategory('')
    setUploadDesc('')
    setUploadContent('')
    setUploadFileUrl(undefined)
    setUploadFileName(undefined)
    toast.success(
      isAdmin
        ? 'Material published directly to E-Library!'
        : 'Material uploaded! Marked as Pending Review for Admin approval.'
    )
  }

  const openItem = (item: LibraryItem) => {
    stopAllAudio()
    setSelectedItem(item)
    setIsReading(false)
    setChapterIndex(0)
    setProgress(item.progress ?? 0)
  }

  const updateProgress = (itemId: string, pct: number) => {
    setProgress(pct)
    const updated = setLibraryItemProgress(itemId, pct)
    setItems(updated)
    const refreshed = updated.find((i) => i.id === itemId)
    if (refreshed) setSelectedItem(refreshed)
  }

  const handleToggleSpokenAudio = (item: LibraryItem) => {
    // If real media element is present, toggle it
    if (item.fileUrl && mediaRef.current) {
      if (isPlaying) {
        mediaRef.current.pause()
        setIsPlaying(false)
      } else {
        mediaRef.current.play().catch(() => toast.error('Unable to play attached media file'))
        setIsPlaying(true)
      }
      return
    }

    if (!('speechSynthesis' in window)) {
      toast.error('Audio narration is not supported in this browser')
      return
    }

    if (isPlaying) {
      window.speechSynthesis.cancel()
      setIsPlaying(false)
      return
    }

    window.speechSynthesis.cancel()
    const script = `${item.title}, by ${item.author}. ${item.content || item.description}`
    const utter = new SpeechSynthesisUtterance(script)
    utter.rate = speechRate
    utter.onboundary = (ev) => {
      if (script.length > 0 && typeof ev.charIndex === 'number') {
        const pct = Math.min(98, Math.max(10, Math.round((ev.charIndex / script.length) * 100)))
        updateProgress(item.id, pct)
      }
    }
    utter.onend = () => {
      setIsPlaying(false)
      updateProgress(item.id, 100)
      toast.success(`Finished playing "${item.title}"`)
    }
    utter.onerror = () => setIsPlaying(false)
    setIsPlaying(true)
    if ((progress || 0) < 15) {
      updateProgress(item.id, 15)
    }
    window.speechSynthesis.speak(utter)
    toast.success(`Playing audio: ${item.title}`)
  }

  const handleDownloadStudySheet = (item: LibraryItem) => {
    const chaptersText = item.chapters
      ? item.chapters.map((c) => `\n--- ${c.title} ---\n${c.content}\n`).join('\n')
      : item.content || item.description
    const content = `${item.title}\nBy ${item.author}\nPublisher: ${item.publisher || 'Believers e-Library'}\nLicense: ${item.license || 'Public Domain / Approved Ministry Material'}\nCategory: ${item.category} (${item.type.toUpperCase()})\n\nOverview:\n${item.description}\n\nFull Study Text:\n${chaptersText}\n`
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.txt`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Full offline study edition downloaded (.txt)')
  }

  const tabs: { key: 'all' | MediaType; label: string; icon: React.ElementType }[] = [
    { key: 'all', label: 'All', icon: Filter },
    { key: 'book', label: 'Books', icon: BookOpen },
    { key: 'audio', label: 'Audio', icon: Headphones },
    { key: 'video', label: 'Video', icon: Video },
    { key: 'material', label: 'Guides', icon: FileText },
  ]

  const itemChapters =
    selectedItem?.chapters && selectedItem.chapters.length > 0
      ? selectedItem.chapters
      : selectedItem
      ? [{ title: selectedItem.title, content: selectedItem.content || selectedItem.description }]
      : []

  return (
    <div className="space-y-5 pb-24">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-serif text-primary">E-Library</h1>
          <p className="text-sm text-muted-foreground">Books, sermons, teachings & study guides</p>
        </div>
        <Button size="sm" onClick={() => setShowUpload(true)} className="gap-1">
          <Upload className="w-4 h-4" /> Contribute
        </Button>
      </header>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search titles, authors, topics..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 rounded-xl bg-secondary/50 border-none"
        />
      </div>

      {/* Type Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all',
              activeTab === tab.key
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            )}
          >
            <tab.icon className="w-3.5 h-3.5" /> {tab.label}
          </button>
        ))}
      </div>

      {/* Category Filter */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="text-xs font-medium text-muted-foreground flex items-center gap-1"
        >
          <Filter className="w-3 h-3" /> Category
        </button>
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              className="overflow-hidden"
            >
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-40 h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c} className="text-xs">
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
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
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: idx * 0.04 }}
              >
                <Card
                  className="border-none shadow-sm hover:shadow-lg transition-all cursor-pointer group overflow-hidden"
                  onClick={() => openItem(item)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          'w-12 h-12 rounded-xl flex items-center justify-center shrink-0',
                          typeColors[item.type]
                        )}
                      >
                        <Icon className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-bold text-sm text-primary truncate">{item.title}</h3>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleBookmark(item.id)
                            }}
                            className={cn(
                              'p-1 rounded-full transition-colors',
                              bookmarks.includes(item.id)
                                ? 'text-amber-500'
                                : 'text-muted-foreground hover:text-amber-500'
                            )}
                          >
                            <Bookmark className={cn('w-4 h-4', bookmarks.includes(item.id) && 'fill-amber-500')} />
                          </button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.author}</p>
                        <p className="text-xs text-muted-foreground/70 line-clamp-2 mt-1">{item.description}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {item.category}
                          </Badge>
                          {item.approvalStatus === 'pending' && (
                            <Badge className="bg-amber-100 text-amber-800 text-[9px] px-1.5 py-0 gap-1">
                              <Clock className="w-2.5 h-2.5" /> Pending Review
                            </Badge>
                          )}
                          {item.chapters && item.chapters.length > 1 && (
                            <span className="text-[10px] text-muted-foreground">
                              {item.chapters.length} chapters
                            </span>
                          )}
                          {item.duration && (
                            <span className="text-[10px] text-muted-foreground font-mono">{item.duration}</span>
                          )}
                          {item.pages && <span className="text-[10px] text-muted-foreground">{item.pages} pages</span>}
                        </div>
                        {item.progress !== undefined && item.progress > 0 && (
                          <div className="mt-2">
                            <div className="h-1 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full transition-all"
                                style={{ width: `${item.progress}%` }}
                              />
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

      {/* Media Player & Multi-Chapter Ebook Reader Dialog */}
      <Dialog
        open={!!selectedItem}
        onOpenChange={(open) => {
          if (!open) {
            stopAllAudio()
            setSelectedItem(null)
          }
        }}
      >
        <DialogContent className="max-w-md rounded-2xl max-h-[88vh] overflow-y-auto">
          {selectedItem && (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle className="text-lg font-serif">{selectedItem.title}</DialogTitle>
                <p className="text-xs text-muted-foreground">
                  {selectedItem.author} • {selectedItem.category}
                  {selectedItem.publisher ? ` • ${selectedItem.publisher}` : ''}
                </p>
                {selectedItem.license && (
                  <p className="text-[10px] text-emerald-700 flex items-center gap-1 pt-0.5">
                    <ShieldCheck className="w-3 h-3 shrink-0" /> {selectedItem.license}
                  </p>
                )}
              </DialogHeader>

              {isReading ? (
                <div className="space-y-4">
                  {/* Multi-chapter navigation */}
                  {itemChapters.length > 1 && (
                    <div className="flex items-center justify-between bg-secondary/40 px-3 py-2 rounded-xl">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={chapterIndex === 0}
                        onClick={() => {
                          const nextIdx = Math.max(0, chapterIndex - 1)
                          setChapterIndex(nextIdx)
                        }}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <div className="text-center">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground">
                          Chapter {chapterIndex + 1} of {itemChapters.length}
                        </p>
                        <p className="text-xs font-bold text-primary line-clamp-1">
                          {itemChapters[chapterIndex]?.title}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={chapterIndex >= itemChapters.length - 1}
                        onClick={() => {
                          const nextIdx = Math.min(itemChapters.length - 1, chapterIndex + 1)
                          setChapterIndex(nextIdx)
                          const pct = Math.round(((nextIdx + 1) / itemChapters.length) * 100)
                          updateProgress(selectedItem.id, pct)
                        }}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  )}

                  <div className="p-4 rounded-xl bg-secondary/30 border border-border/50 space-y-3 text-sm font-serif leading-relaxed text-foreground whitespace-pre-line max-h-[42vh] overflow-y-auto">
                    <h4 className="font-sans font-bold text-xs uppercase tracking-wider text-accent">
                      {itemChapters[chapterIndex]?.title}
                    </h4>
                    <p>{itemChapters[chapterIndex]?.content}</p>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-muted-foreground font-medium">
                      <span>Reading Progress</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-xs"
                      onClick={() => handleToggleSpokenAudio(selectedItem)}
                    >
                      <Volume2 className="w-3.5 h-3.5 mr-1" />
                      {isPlaying ? 'Stop Audio' : 'Read Aloud'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-xs"
                      onClick={() => {
                        addJournalEntry({
                          title: `Study Note: ${selectedItem.title}`,
                          body: `Notes from "${itemChapters[chapterIndex]?.title}" (${selectedItem.title} by ${selectedItem.author}):\n\n${itemChapters[chapterIndex]?.content}`,
                          type: 'Notes',
                        })
                        toast.success('Saved study note to your Journal!')
                      }}
                    >
                      Save to Journal
                    </Button>
                    <Button
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => {
                        updateProgress(selectedItem.id, 100)
                        toast.success('Marked as 100% completed!')
                      }}
                    >
                      Mark Book Completed (100%)
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="aspect-video bg-gradient-to-br from-primary/10 to-emerald-500/10 rounded-xl flex flex-col items-center justify-center relative overflow-hidden p-4">
                    {selectedItem.type === 'audio' || selectedItem.type === 'video' ? (
                      <>
                        {selectedItem.fileUrl ? (
                          selectedItem.type === 'video' ? (
                            <video
                              ref={mediaRef as React.RefObject<HTMLVideoElement>}
                              src={selectedItem.fileUrl}
                              controls
                              className="w-full h-full rounded-lg"
                              onTimeUpdate={(e) => {
                                const el = e.currentTarget
                                if (el.duration) {
                                  updateProgress(selectedItem.id, Math.round((el.currentTime / el.duration) * 100))
                                }
                              }}
                            />
                          ) : (
                            <audio
                              ref={mediaRef as React.RefObject<HTMLAudioElement>}
                              src={selectedItem.fileUrl}
                              controls
                              className="w-full"
                              onTimeUpdate={(e) => {
                                const el = e.currentTarget
                                if (el.duration) {
                                  updateProgress(selectedItem.id, Math.round((el.currentTime / el.duration) * 100))
                                }
                              }}
                            />
                          )
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            <motion.div
                              animate={isPlaying ? { scale: [1, 1.08, 1] } : {}}
                              transition={{ repeat: Infinity, duration: 1.5 }}
                              className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center"
                            >
                              <button
                                onClick={() => handleToggleSpokenAudio(selectedItem)}
                                className="w-full h-full flex items-center justify-center"
                                aria-label={isPlaying ? 'Pause narration' : 'Play narration'}
                              >
                                {isPlaying ? (
                                  <Pause className="w-8 h-8 text-primary" />
                                ) : (
                                  <Play className="w-8 h-8 text-primary ml-1" />
                                )}
                              </button>
                            </motion.div>
                            <div className="flex items-center gap-1.5">
                              {[0.9, 1.0, 1.15].map((r) => (
                                <button
                                  key={r}
                                  onClick={() => setSpeechRate(r)}
                                  className={cn(
                                    'px-2 py-0.5 rounded text-[10px] font-bold',
                                    speechRate === r ? 'bg-primary text-primary-foreground' : 'bg-secondary/60'
                                  )}
                                >
                                  {r}x
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {(isPlaying || progress > 0) && !selectedItem.fileUrl && (
                          <div className="w-full mt-3">
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full transition-all"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                              <span>{Math.round(progress)}% listened</span>
                              <span>{selectedItem.duration || 'Spoken Audio'}</span>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="p-4 text-center">
                        <BookOpen className="w-10 h-10 text-primary/50 mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground max-w-[240px] line-clamp-3">
                          {selectedItem.content || selectedItem.description}
                        </p>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{selectedItem.description}</p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 gap-1"
                      onClick={() => {
                        if (selectedItem.type === 'audio' || selectedItem.type === 'video') {
                          handleToggleSpokenAudio(selectedItem)
                        } else {
                          setIsReading(true)
                          const initPct = Math.round((1 / Math.max(1, itemChapters.length)) * 100)
                          updateProgress(selectedItem.id, Math.max(progress || 0, initPct))
                        }
                      }}
                    >
                      <Play className="w-4 h-4" />{' '}
                      {selectedItem.type === 'book'
                        ? `Read Book (${itemChapters.length} ch.)`
                        : selectedItem.type === 'material'
                        ? `Open Study Guide (${itemChapters.length} s.)`
                        : isPlaying
                        ? 'Pause Audio'
                        : 'Play Sermon Audio'}
                    </Button>
                    {(selectedItem.type === 'audio' || selectedItem.type === 'video') && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIsReading(true)}
                        title="Read Transcript"
                      >
                        Transcript
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() => handleDownloadStudySheet(selectedItem)}
                      aria-label="Download study summary"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Upload / Contribute Sheet */}
      <Sheet open={showUpload} onOpenChange={setShowUpload}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Contribute Christian Study Material</SheetTitle>
          </SheetHeader>
          <div className="space-y-3 mt-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase">
                Attach File (.txt, .md, .mp3, .wav, .mp4)
              </label>
              <Input
                type="file"
                accept=".txt,.md,.mp3,.wav,.mp4,.pdf,.epub"
                onChange={handleFileChange}
                className="mt-1 text-xs"
              />
              {uploadFileName && (
                <p className="text-[11px] text-emerald-600 font-medium mt-1">Attached: {uploadFileName}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase">Title</label>
                <Input
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="Material title"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase">Author / Speaker</label>
                <Input
                  value={uploadAuthor}
                  onChange={(e) => setUploadAuthor(e.target.value)}
                  placeholder="Author name"
                  className="mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase">Type</label>
                <Select value={uploadType} onValueChange={(v) => setUploadType(v as MediaType)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="book">Book</SelectItem>
                    <SelectItem value="audio">Audio Sermon</SelectItem>
                    <SelectItem value="video">Video Teaching</SelectItem>
                    <SelectItem value="material">Study Guide</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase">Category</label>
                <Input
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  placeholder="e.g. Theology"
                  className="mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase">Publisher / Ministry</label>
                <Input
                  value={uploadPublisher}
                  onChange={(e) => setUploadPublisher(e.target.value)}
                  placeholder="e.g. Grace Press"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase">License / Permission</label>
                <Input
                  value={uploadLicense}
                  onChange={(e) => setUploadLicense(e.target.value)}
                  placeholder="Public Domain / CC BY"
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase">Summary Description</label>
              <Input
                value={uploadDesc}
                onChange={(e) => setUploadDesc(e.target.value)}
                placeholder="Brief overview"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase">
                Full Text / Chapters (Separate chapters with a blank line)
              </label>
              <Textarea
                value={uploadContent}
                onChange={(e) => setUploadContent(e.target.value)}
                placeholder="Paste study text or sermon transcript..."
                className="mt-1 min-h-[100px]"
              />
            </div>
            <Button className="w-full" onClick={handleUpload}>
              {can(user?.role, 'content:publish') ? 'Publish Material Now' : 'Submit Material for Review'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
