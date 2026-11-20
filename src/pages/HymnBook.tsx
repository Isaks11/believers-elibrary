import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  ChevronLeft, Music2, Search, Star, Share2, Copy,
  ListMusic, Type, Heart, Clock, Plus, Check, LayoutGrid, List
} from 'lucide-react'
import { toast } from 'sonner'
import { HYMN_CATEGORIES } from '@/types/devotional-hymn'
import { getFavoriteHymnIds, getHymns, updateHymn } from '@/data/mockDevotionalHymnData'
import { CMS_ID_PREFIX, cmsHymnToPageHymn, loadPublishedHymns } from '@/lib/contentSource'
import { cn } from '@/lib/utils'
import type { Hymn } from '@/types/devotional-hymn'

const RECENT_HYMNS_KEY = 'hymn_recent_ids'
const PLAYLIST_HYMNS_KEY = 'hymn_playlist_ids'

const HYMN_FONT_STYLES = [
  { id: 'serif', label: 'Serif', family: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif' },
  { id: 'sans', label: 'Sans', family: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' },
  { id: 'readable', label: 'Readable', family: '"Trebuchet MS", "Segoe UI", Verdana, sans-serif' },
] as const
type HymnFontStyleId = typeof HYMN_FONT_STYLES[number]['id']

function getDefaultHymnFontStyle(): HymnFontStyleId {
  try {
    const v = localStorage.getItem('hymn_font_style') as HymnFontStyleId | null
    return HYMN_FONT_STYLES.some((s) => s.id === v) ? (v as HymnFontStyleId) : 'serif'
  } catch { return 'serif' }
}
function getDefaultHymnFontSize(): number {
  try {
    const n = Number(localStorage.getItem('hymn_font_size'))
    return Number.isFinite(n) && n >= 14 && n <= 26 ? n : 17
  } catch { return 17 }
}

function loadIdList(key: string): string[] {
  try {
    const raw = localStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveIdList(key: string, ids: string[]) {
  localStorage.setItem(key, JSON.stringify(ids))
}

function pushRecent(id: string): string[] {
  const ids = [id, ...loadIdList(RECENT_HYMNS_KEY).filter(existing => existing !== id)].slice(0, 20)
  saveIdList(RECENT_HYMNS_KEY, ids)
  return ids
}

function toggleIdInList(key: string, id: string): string[] {
  const ids = loadIdList(key)
  const next = ids.includes(id) ? ids.filter(existing => existing !== id) : [id, ...ids]
  saveIdList(key, next)
  return next
}

/** True when the hymn row came from the CMS bridge (its page id is `cms:`-prefixed). */
export function isCmsHymn(hymn: Hymn): boolean {
  return hymn.id.startsWith(CMS_ID_PREFIX)
}

export function HymnBook() {
  const [localHymns, setLocalHymns] = useState<Hymn[]>(() => getHymns())
  const [cmsHymns, setCmsHymns] = useState<Hymn[]>([])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string>('All')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [recentIds, setRecentIds] = useState<string[]>(() => loadIdList(RECENT_HYMNS_KEY))
  const [playlistIds, setPlaylistIds] = useState<string[]>(() => loadIdList(PLAYLIST_HYMNS_KEY))
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => (localStorage.getItem('hymn_view_mode') === 'grid' ? 'grid' : 'list'))

  useEffect(() => { try { localStorage.setItem('hymn_view_mode', viewMode) } catch {} }, [viewMode])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const rows = await loadPublishedHymns()
        if (cancelled) return
        const favorites = new Set(getFavoriteHymnIds())
        setCmsHymns(
          rows.map((row) => {
            const hymn = cmsHymnToPageHymn(row)
            hymn.isFavorite = favorites.has(hymn.id)
            return hymn
          }),
        )
      } catch {
        if (!cancelled) setCmsHymns([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const hymns = useMemo(() => {
    const localIds = new Set(localHymns.map((hymn) => hymn.id))
    const merged = [...localHymns]
    for (const hymn of cmsHymns) {
      if (!localIds.has(hymn.id)) merged.push(hymn)
    }
    merged.sort((a, b) => a.number - b.number)
    return merged
  }, [localHymns, cmsHymns])

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    const numberQuery = q.replace(/^(hymn\s*#?\s*|#)/i, '').trim()
    const isNumericQuery = /^\d+$/.test(numberQuery)
    const exactNum = isNumericQuery ? Number(numberQuery) : null

    const matches = hymns.filter(h => {
      const inCategory =
        category === 'All' ||
        (category === 'Favorites' ? h.isFavorite : true) &&
          (category === 'Playlist'
            ? playlistIds.includes(h.id)
            : category === 'Recent'
              ? recentIds.includes(h.id)
              : category === 'All' || category === 'Favorites' ? true : h.category === category)
      const matchesQuery = !q ||
        h.title.toLowerCase().includes(q) ||
        (h.tuneName ?? '').toLowerCase().includes(q) ||
        (h.number > 0 && (isNumericQuery ? String(h.number).includes(numberQuery) : String(h.number).includes(q))) ||
        h.author.toLowerCase().includes(q) ||
        h.stanzas.some(s => s.toLowerCase().includes(q)) ||
        (h.chorus ?? '').toLowerCase().includes(q)
      return inCategory && matchesQuery
    })

    if (exactNum !== null) {
      matches.sort((a, b) => {
        const aExact = a.number === exactNum ? 0 : 1
        const bExact = b.number === exactNum ? 0 : 1
        if (aExact !== bExact) return aExact - bExact
        return a.number - b.number
      })
    }

    return matches
  }, [hymns, category, query, playlistIds, recentIds])

  const toggleFavorite = (id: string) => {
    const hymn = hymns.find(h => h.id === id)
    if (!hymn) return
    const updated = updateHymn(id, { isFavorite: !hymn.isFavorite })
    setLocalHymns(updated)
    setCmsHymns(prev => prev.map(h => h.id === id ? { ...h, isFavorite: !hymn.isFavorite } : h))
    toast.success(hymn.isFavorite ? 'Removed from favorites' : 'Added to favorites')
  }

  const recordRecent = (id: string) => setRecentIds(pushRecent(id))
  const togglePlaylist = (id: string) => {
    setPlaylistIds(toggleIdInList(PLAYLIST_HYMNS_KEY, id))
    toast.success(playlistIds.includes(id) ? 'Removed from worship playlist' : 'Added to worship playlist')
  }

  const openHymnDetail = (id: string) => {
    setDetailId(id)
    recordRecent(id)
  }

  const detail = hymns.find(h => h.id === detailId) ?? null
  const filterTabs = ['All', 'Favorites', 'Playlist', 'Recent', ...HYMN_CATEGORIES]

  return (
    <div className="space-y-5 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-serif text-primary">Hymn Book</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Timeless hymns of the faith • {hymns.length} hymns
          </p>
        </div>
        <div className="flex items-center gap-1 bg-secondary/30 rounded-xl p-1 shrink-0">
          <Button type="button" size="sm" variant={viewMode === 'list' ? 'default' : 'ghost'} className="h-8 px-2.5 gap-1.5" onClick={() => setViewMode('list')}>
            <List className="w-4 h-4" /> <span className="hidden sm:inline text-xs">List</span>
          </Button>
          <Button type="button" size="sm" variant={viewMode === 'grid' ? 'default' : 'ghost'} className="h-8 px-2.5 gap-1.5" onClick={() => setViewMode('grid')}>
            <LayoutGrid className="w-4 h-4" /> <span className="hidden sm:inline text-xs">Numbers</span>
          </Button>
        </div>
      </header>

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 text-muted-foreground absolute left-4 top-1/2 -translate-y-1/2" />
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by title, number, author, or lyrics..."
          className="pl-11 h-12 rounded-2xl bg-card border-border/50 shadow-sm"
        />
      </div>

      {/* Category & Collection Pills */}
      <div className="flex overflow-x-auto gap-2 no-scrollbar pb-1">
        {filterTabs.map(cat => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={cn(
              'px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all active:scale-95',
              category === cat
                ? 'bg-primary text-primary-foreground shadow-lg'
                : 'bg-secondary/40 text-primary hover:bg-secondary/60'
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {viewMode === 'grid' ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Select a hymn by number</p>
          <div className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-8 gap-2">
            {filtered.map((hymn) => (
              <button
                key={hymn.id}
                type="button"
                onClick={() => openHymnDetail(hymn.id)}
                className={cn(
                  'aspect-square rounded-xl border text-sm font-bold flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 hover:border-primary/40 hover:bg-primary/5',
                  hymn.isFavorite ? 'border-amber-400/50 bg-amber-50/40' : 'border-border/60 bg-card'
                )}
                title={hymn.title}
              >
                <span className="text-primary">{hymn.number > 0 ? hymn.number : '—'}</span>
                {hymn.isFavorite && <Star className="w-3 h-3 fill-amber-500 text-amber-500" />}
              </button>
            ))}
          </div>
          {filtered.length === 0 && <EmptyHymns />}
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {filtered.map((hymn, i) => {
              const inPlaylist = playlistIds.includes(hymn.id)
              return (
                <motion.div
                  key={hymn.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03, duration: 0.25 }}
                >
                  <Card className="border-none shadow-sm hover:shadow-lg transition-shadow cursor-pointer group">
                    <CardContent
                      className="p-4 flex items-center gap-3.5"
                      onClick={() => openHymnDetail(hymn.id)}
                    >
                      <div className="w-12 h-12 rounded-2xl flex flex-col items-center justify-center shrink-0 bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        <span className="text-lg font-bold leading-none">{hymn.number > 0 ? hymn.number : '—'}</span>
                        <span className="text-[8px] uppercase font-bold opacity-70">Hymn</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-primary truncate group-hover:text-primary/80 transition-colors">
                          {hymn.title}
                        </h3>
                        {hymn.tuneName && (
                          <p className="text-[11px] text-primary/75 truncate mt-0.5">
                            <span className="font-semibold text-muted-foreground">Tune:</span> {hymn.tuneName}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground truncate">
                          {hymn.author}{hymn.meter ? ` • ${hymn.meter}` : ''} • {hymn.category}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <Badge className="bg-secondary/50 text-secondary-foreground text-[9px] px-1.5 py-0">
                            {hymn.category}
                          </Badge>
                          {isCmsHymn(hymn) && (
                            <Badge className="bg-primary/10 text-primary text-[9px] px-1.5 py-0">Library</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-9 w-9 p-0 rounded-full"
                          onClick={e => { e.stopPropagation(); togglePlaylist(hymn.id) }}
                          title={inPlaylist ? 'In Worship Playlist' : 'Add to Worship Playlist'}
                        >
                          {inPlaylist ? <Check className="w-4 h-4 text-emerald-600" /> : <Plus className="w-4 h-4 text-muted-foreground" />}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-9 w-9 p-0 rounded-full"
                          onClick={e => { e.stopPropagation(); toggleFavorite(hymn.id) }}
                          aria-label="Favorite hymn"
                        >
                          <Star className={cn('w-5 h-5 transition-colors', hymn.isFavorite ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground')} />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </AnimatePresence>
          {filtered.length === 0 && <EmptyHymns />}
        </div>
      )}

      <AnimatePresence>
        {detail && (
          <HymnDetail
            hymn={detail}
            inPlaylist={playlistIds.includes(detail.id)}
            onClose={() => setDetailId(null)}
            onFavorite={() => toggleFavorite(detail.id)}
            onTogglePlaylist={() => togglePlaylist(detail.id)}
            allHymns={hymns}
            onOpen={openHymnDetail}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function EmptyHymns() {
  return (
    <div className="py-16 text-center space-y-2">
      <Music2 className="w-10 h-10 text-muted-foreground mx-auto" />
      <p className="text-sm font-medium text-muted-foreground">No hymns found</p>
      <p className="text-xs text-muted-foreground/70">Try a different search or filter tab</p>
    </div>
  )
}

function HymnDetail({ hymn, inPlaylist, onClose, onFavorite, onTogglePlaylist, allHymns, onOpen }: {
  hymn: Hymn
  inPlaylist: boolean
  onClose: () => void
  onFavorite: () => void
  onTogglePlaylist: () => void
  allHymns: Hymn[]
  onOpen: (id: string) => void
}) {
  const [fontSize, setFontSize] = useState<number>(() => getDefaultHymnFontSize())
  const [fontStyle, setFontStyle] = useState<HymnFontStyleId>(() => getDefaultHymnFontStyle())
  const [showChords, setShowChords] = useState(false)
  const [activeStanza, setActiveStanza] = useState<number | null>(null)

  useEffect(() => { try { localStorage.setItem('hymn_font_size', String(fontSize)) } catch {} }, [fontSize])
  useEffect(() => { try { localStorage.setItem('hymn_font_style', fontStyle) } catch {} }, [fontStyle])

  const fontFamily = HYMN_FONT_STYLES.find((s) => s.id === fontStyle)?.family || HYMN_FONT_STYLES[0].family

  const idx = allHymns.findIndex(h => h.id === hymn.id)
  const prevHymn = allHymns[(idx - 1 + allHymns.length) % allHymns.length]
  const nextHymn = allHymns[(idx + 1) % allHymns.length]

  const copyLyrics = async () => {
    const br = String.fromCharCode(10, 10)
    const lyrics = [...hymn.stanzas, hymn.chorus ? `${br}${hymn.chorus}` : ''].join(br)
    try {
      await navigator.clipboard.writeText(`${hymn.title} (Hymn ${hymn.number}) by ${hymn.author}${br}${lyrics}`)
      toast.success('Lyrics copied to clipboard')
    } catch {
      toast.error('Could not copy lyrics')
    }
  }

  const share = async () => {
    try {
      await navigator.share({ title: hymn.title, text: `Hymn ${hymn.number} – ${hymn.title}` })
    } catch {
      toast.info(`${hymn.title} - Hymn ${hymn.number}`)
    }
  }

  const metaLine = [
    hymn.author,
    hymn.yearWritten ? String(hymn.yearWritten) : null,
    hymn.tuneName ? `Tune: ${hymn.tuneName}` : null,
    hymn.meter ? `Meter: ${hymn.meter}` : null,
  ].filter(Boolean)

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 40 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="fixed inset-0 z-[60] bg-background overflow-y-auto"
    >
      {/* Hero */}
      <div className="relative min-h-[30vh] bg-primary">
        <div className="absolute inset-0 bg-[url('https://storage.googleapis.com/dala-prod-public-storage/generated-images/f095a220-d4e4-4a6a-8aec-8a5aa9c8ce04/devotional-cover-1-cb4ac9fc-1782601932817.webp')] bg-cover opacity-25" />
        <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/40 to-primary/20" />
        <Button
          variant="secondary"
          size="icon"
          onClick={onClose}
          className="absolute top-6 left-6 rounded-full bg-white/20 backdrop-blur-md border-none text-white hover:bg-white/40 z-10"
        >
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={onTogglePlaylist}
          className="absolute top-6 right-6 rounded-full bg-white/20 backdrop-blur-md border-none text-white hover:bg-white/40 gap-1 text-xs z-10"
        >
          {inPlaylist ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {inPlaylist ? 'In Playlist' : 'Playlist'}
        </Button>
        <div className="absolute inset-x-0 bottom-0 p-6 pt-20 space-y-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <Badge className="bg-white/20 text-white border-none text-[11px] font-bold px-2.5 py-1">Hymn {hymn.number}</Badge>
            <Badge className="bg-accent text-accent-foreground text-[11px] font-bold px-2.5 py-1">{hymn.category}</Badge>
            {isCmsHymn(hymn) && <Badge className="bg-white/20 text-white border-none text-[11px] font-bold px-2.5 py-1">Library</Badge>}
          </div>
          <h1 className="text-3xl sm:text-4xl font-serif font-bold text-white leading-snug tracking-wide">{hymn.title}</h1>
          <div className="space-y-1.5 pt-1">
            {metaLine.length > 0 && (
              <p className="text-sm text-white/90 font-medium leading-relaxed">
                {metaLine.join(' • ')}
              </p>
            )}
            <p className="text-xs text-white/75 font-medium tracking-wide">Public Domain Hymn</p>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 space-y-6 pb-36">
        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-y border-border/50 py-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Popover>
              <PopoverTrigger asChild>
                <Button size="sm" variant="ghost" className="h-8 px-2.5 gap-1.5 text-xs">
                  <Type className="w-4 h-4" /> Text
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 space-y-3" align="start">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider">Font style</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {HYMN_FONT_STYLES.map((s) => (
                      <Button key={s.id} type="button" size="sm" variant={fontStyle === s.id ? 'default' : 'outline'} className="h-8 text-xs" onClick={() => setFontStyle(s.id)} style={{ fontFamily: s.family }}>
                        {s.label}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider">Font size</p>
                  <div className="flex items-center gap-2">
                    <Button type="button" size="sm" variant="outline" className="h-8 px-2" onClick={() => setFontSize((s) => Math.max(14, s - 1))}>A-</Button>
                    <div className="flex-1 text-center text-sm font-medium text-foreground">{fontSize}px</div>
                    <Button type="button" size="sm" variant="outline" className="h-8 px-2" onClick={() => setFontSize((s) => Math.min(26, s + 1))}>A+</Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Your font style and size are saved as default.</p>
                </div>
              </PopoverContent>
            </Popover>
            <Button
              size="sm"
              variant="ghost"
              className={cn('h-8 px-2.5 gap-1.5 text-xs', showChords && 'text-primary bg-primary/10')}
              onClick={() => setShowChords(s => !s)}
            >
              <ListMusic className="w-4 h-4" /> Chords/Meter
            </Button>
          </div>
          {hymn.meter && <span className="text-xs text-muted-foreground font-medium">Meter: {hymn.meter}</span>}
        </div>

        {/* Lyrics */}
        <div className="space-y-5">
          {hymn.stanzas.map((stanza, i) => (
            <div
              key={i}
              onClick={() => setActiveStanza(activeStanza === i ? null : i)}
              className={cn(
                'rounded-xl p-4 transition-all cursor-pointer border',
                activeStanza === i ? 'bg-primary/5 border-primary/20 shadow-sm' : 'border-transparent'
              )}
            >
              <div className="flex items-start gap-3">
                <span className={cn(
                  'text-[10px] font-bold mt-1.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0',
                  activeStanza === i ? 'bg-primary text-primary-foreground' : 'bg-secondary/60 text-secondary-foreground'
                )}>
                  {i + 1}
                </span>
                <p
                  className="text-foreground/90 italic leading-relaxed whitespace-pre-line"
                  style={{ fontSize, fontFamily }}
                >
                  {showChords && hymn.meter && <span className="block font-mono text-[10px] not-italic text-muted-foreground uppercase tracking-wider mb-2">Meter: {hymn.meter}</span>}
                  {stanza}
                </p>
              </div>
            </div>
          ))}

          {hymn.chorus && (
            <div className="rounded-xl bg-accent/10 border border-accent/20 p-4">
              <p
                className="font-bold text-primary italic leading-relaxed whitespace-pre-line"
                style={{ fontSize, fontFamily }}
              >
                {hymn.chorus}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-accent mt-2">Chorus</p>
            </div>
          )}
        </div>

        {/* Action Row */}
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-4 bg-gradient-to-t from-background via-background to-transparent">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="rounded-xl h-11 w-11 shrink-0" onClick={() => onOpen(prevHymn.id)} aria-label="Previous hymn">
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <Button variant="outline" size="icon" className={cn('rounded-xl h-11 w-11 shrink-0', hymn.isFavorite && 'bg-amber-500/10 border-amber-500/40')} onClick={onFavorite} aria-label="Favorite hymn">
              <Heart className={cn('w-5 h-5', hymn.isFavorite ? 'fill-rose-500 text-rose-500' : 'text-primary')} />
            </Button>
            <Button variant="outline" className="h-11 flex-1 rounded-xl gap-2 font-bold" onClick={onTogglePlaylist}>
              {inPlaylist ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {inPlaylist ? 'In Playlist' : 'Add to Playlist'}
            </Button>
            <Button variant="outline" size="icon" className="rounded-xl h-11 w-11 shrink-0" onClick={copyLyrics} aria-label="Copy lyrics">
              <Copy className="w-5 h-5" />
            </Button>
            <Button variant="outline" size="icon" className="rounded-xl h-11 w-11 shrink-0" onClick={share} aria-label="Share hymn">
              <Share2 className="w-5 h-5" />
            </Button>
            <Button variant="outline" size="icon" className="rounded-xl h-11 w-11 shrink-0" onClick={() => onOpen(nextHymn.id)} aria-label="Next hymn">
              <ChevronLeft className="w-5 h-5 rotate-180" />
            </Button>
          </div>
          <p className="text-center text-[10px] text-muted-foreground mt-2 flex items-center justify-center gap-1">
            <Clock className="w-3 h-3" /> {hymn.number} / {allHymns.length} • Use Prev / Next to browse
          </p>
        </div>
      </div>
    </motion.div>
  )
}
