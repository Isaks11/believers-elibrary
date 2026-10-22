import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  ChevronLeft, Music2, Search, Star, Share2, Copy, Play, Pause,
  Download, ListMusic, Volume2, VolumeX, Type, Heart, Clock, Plus, Check
} from 'lucide-react'
import { toast } from 'sonner'
import { HYMN_CATEGORIES } from '@/types/devotional-hymn'
import { getFavoriteHymnIds, getHymns, updateHymn } from '@/data/mockDevotionalHymnData'
import { CMS_ID_PREFIX, cmsHymnToPageHymn, loadPublishedHymns } from '@/lib/contentSource'
import { hymnPlayer, exportHymnWavBlob, formatSeconds } from '@/lib/audioEngine'
import { cn } from '@/lib/utils'
import type { Hymn } from '@/types/devotional-hymn'

const RECENT_HYMNS_KEY = 'hymn_recent_ids'
const PLAYLIST_HYMNS_KEY = 'hymn_playlist_ids'

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
  try {
    localStorage.setItem(key, JSON.stringify(ids))
  } catch { /* ignore */ }
}

/** CMS-published hymns carry `cms:`-prefixed ids — used for provenance badges. */
function isCmsHymn(hymn: Hymn): boolean {
  return hymn.id.startsWith(CMS_ID_PREFIX)
}

/**
 * Merges CMS-published hymns into the local list. When a CMS hymn shares a
 * hymn number with a seeded/local hymn, the CMS copy wins (the local copy is
 * dropped); favorites are re-derived from the shared id-based store so toggles
 * on CMS hymns stay in sync. With no CMS hymns the local list is untouched.
 */
function mergeCmsHymns(local: Hymn[], cms: Hymn[]): Hymn[] {
  if (cms.length === 0) return local
  const favorites = new Set(getFavoriteHymnIds())
  const cmsRows = cms.map((hymn) => ({ ...hymn, isFavorite: favorites.has(hymn.id) }))
  const cmsNumbers = new Set(cmsRows.filter((h) => h.number > 0).map((h) => h.number))
  const remainingLocal = local.filter((hymn) => !cmsNumbers.has(hymn.number))
  return [...cmsRows, ...remainingLocal]
}

export function HymnBook() {
  const [localHymns, setLocalHymns] = useState<Hymn[]>(() => getHymns())
  const [cmsHymns, setCmsHymns] = useState<Hymn[]>([])
  const [category, setCategory] = useState('All')
  const [query, setQuery] = useState('')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [recentIds, setRecentIds] = useState<string[]>(() => loadIdList(RECENT_HYMNS_KEY))
  const [playlistIds, setPlaylistIds] = useState<string[]>(() => loadIdList(PLAYLIST_HYMNS_KEY))

  // Merged view: church-published (CMS) hymns + the local book. Dedupe by
  // hymn number happens in mergeCmsHymns (CMS wins); with no CMS hymns the
  // list is exactly the local one. Search/filter below run over the merge.
  const hymns = useMemo(() => mergeCmsHymns(localHymns, cmsHymns), [localHymns, cmsHymns])

  useEffect(() => {
    const unsub = hymnPlayer.subscribe((state) => {
      if (!state.isPlaying && state.currentTime === 0) {
        setPlayingId(null)
      }
    })
    return () => {
      unsub()
      hymnPlayer.stop()
    }
  }, [])

  // Published CMS hymns (contentSource memoizes for 5 minutes).
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const rows = await loadPublishedHymns()
      if (!cancelled) setCmsHymns(rows.map(cmsHymnToPageHymn))
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const recordRecent = (id: string) => {
    const next = [id, ...recentIds.filter((r) => r !== id)].slice(0, 10)
    setRecentIds(next)
    saveIdList(RECENT_HYMNS_KEY, next)
  }

  const togglePlaylist = (id: string) => {
    const exists = playlistIds.includes(id)
    const next = exists ? playlistIds.filter((p) => p !== id) : [...playlistIds, id]
    setPlaylistIds(next)
    saveIdList(PLAYLIST_HYMNS_KEY, next)
    toast.success(exists ? 'Removed from Worship Playlist' : 'Added to Worship Playlist')
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return hymns.filter(h => {
      const inCategory =
        category === 'All'
          ? true
          : category === 'Favorites'
            ? Boolean(h.isFavorite)
            : category === 'Playlist'
              ? playlistIds.includes(h.id)
              : category === 'Recent'
                ? recentIds.includes(h.id)
                : h.category === category
      const matchesQuery = !q ||
        h.title.toLowerCase().includes(q) ||
        String(h.number).includes(q) ||
        h.author.toLowerCase().includes(q) ||
        h.stanzas.some(s => s.toLowerCase().includes(q)) ||
        (h.chorus ?? '').toLowerCase().includes(q)
      return inCategory && matchesQuery
    })
  }, [hymns, category, query, playlistIds, recentIds])

  const togglePlay = (id: string, shift = 0) => {
    const target = hymns.find((h) => h.id === id)
    if (playingId === id) {
      hymnPlayer.pause()
      setPlayingId(null)
    } else {
      hymnPlayer.play(id, target ? { title: target.title, author: target.author } : undefined, shift, 0)
      setPlayingId(id)
      recordRecent(id)
    }
  }

  const toggleFavorite = (id: string) => {
    const hymn = hymns.find(h => h.id === id)
    if (!hymn) return
    const updated = updateHymn(id, { isFavorite: !hymn.isFavorite })
    setLocalHymns(updated)
    toast.success(hymn.isFavorite ? 'Removed from favorites' : 'Added to favorites')
  }

  const openHymnDetail = (id: string) => {
    setDetailId(id)
    recordRecent(id)
  }

  const detail = hymns.find(h => h.id === detailId) ?? null
  const filterTabs = ['All', 'Favorites', 'Playlist', 'Recent', ...HYMN_CATEGORIES]

  return (
    <div className="space-y-5 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header>
        <h1 className="text-2xl font-serif text-primary">Hymn Book</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Timeless hymns of the faith • {hymns.length} hymns with real organ accompaniment
        </p>
      </header>

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 text-muted-foreground absolute left-4 top-1/2 -translate-y-1/2" />
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by title, number, or lyrics..."
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

      {/* Hymn List */}
      <div className="space-y-3">
        <AnimatePresence>
          {filtered.map((hymn, i) => {
            const isItemPlaying = playingId === hymn.id
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
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        togglePlay(hymn.id)
                      }}
                      className={cn(
                        'w-12 h-12 rounded-2xl flex flex-col items-center justify-center transition-colors shrink-0',
                        isItemPlaying
                          ? 'bg-primary text-primary-foreground shadow-md'
                          : 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground'
                      )}
                      aria-label={isItemPlaying ? `Pause ${hymn.title}` : `Play ${hymn.title}`}
                    >
                      {isItemPlaying ? (
                        <Pause className="w-5 h-5 fill-current" />
                      ) : (
                        <>
                          <span className="text-lg font-bold leading-none">{hymn.number > 0 ? hymn.number : '—'}</span>
                          <span className="text-[8px] uppercase font-bold opacity-70">Hymn</span>
                        </>
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-primary truncate group-hover:text-primary/80 transition-colors">
                        {hymn.title}
                      </h3>
                      <p className="text-xs text-muted-foreground truncate">
                        {hymn.author} • {hymn.tuneName ?? hymn.category}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Badge className="bg-secondary/50 text-secondary-foreground text-[9px] px-1.5 py-0">
                          {hymn.category}
                        </Badge>
                        {isCmsHymn(hymn) && (
                          <Badge className="bg-primary/10 text-primary text-[9px] px-1.5 py-0">Library</Badge>
                        )}
                        {hymn.keySignature && (
                          <span className="text-[10px] text-muted-foreground font-bold uppercase">
                            Key {hymn.keySignature}
                          </span>
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
                        {inPlaylist ? (
                          <Check className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Plus className="w-4 h-4 text-muted-foreground" />
                        )}
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

        {filtered.length === 0 && (
          <div className="py-16 text-center space-y-2">
            <Music2 className="w-10 h-10 text-muted-foreground mx-auto" />
            <p className="text-sm font-medium text-muted-foreground">No hymns found</p>
            <p className="text-xs text-muted-foreground/70">Try a different search or filter tab</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {detail && (
          <HymnDetail
            hymn={detail}
            isPlaying={playingId === detail.id}
            inPlaylist={playlistIds.includes(detail.id)}
            onClose={() => setDetailId(null)}
            onTogglePlay={(shift) => togglePlay(detail.id, shift)}
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

function HymnDetail({ hymn, isPlaying, inPlaylist, onClose, onTogglePlay, onFavorite, onTogglePlaylist, allHymns, onOpen }: {
  hymn: Hymn
  isPlaying: boolean
  inPlaylist: boolean
  onClose: () => void
  onTogglePlay: (keyShift: number) => void
  onFavorite: () => void
  onTogglePlaylist: () => void
  allHymns: Hymn[]
  onOpen: (id: string) => void
}) {
  const [fontSize, setFontSize] = useState(17)
  const [showChords, setShowChords] = useState(false)
  const [keyShift, setKeyShift] = useState(0)
  const [activeStanza, setActiveStanza] = useState<number | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(() => hymnPlayer.computeDuration(hymn.id))
  const [volume, setVolume] = useState(0.75)

  useEffect(() => {
    setDuration(hymnPlayer.computeDuration(hymn.id))
    const unsub = hymnPlayer.subscribe((st) => {
      setCurrentTime(st.currentTime)
      if (st.duration > 0) setDuration(st.duration)
      setVolume(st.volume)
    })
    return unsub
  }, [hymn.id])

  const idx = allHymns.findIndex(h => h.id === hymn.id)
  const prevHymn = allHymns[(idx - 1 + allHymns.length) % allHymns.length]
  const nextHymn = allHymns[(idx + 1) % allHymns.length]

  const changeKeyShift = (delta: number) => {
    const nextShift = ((keyShift + delta + 18) % 12) - 6
    setKeyShift(nextShift)
    hymnPlayer.setKeyShift(nextShift)
  }

  const handleDownloadWav = () => {
    try {
      const wavBlob = exportHymnWavBlob(hymn.id, keyShift)
      const url = URL.createObjectURL(wavBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `hymn-${hymn.number}-${hymn.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.wav`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Downloaded real .wav audio file for offline listening!')
    } catch {
      toast.error('Could not generate audio download')
    }
  }

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
      await navigator.share({ title: hymn.title, text: `Hymn ${hymn.number} • ${hymn.title}` })
    } catch {
      toast.info(`${hymn.title} - Hymn ${hymn.number}`)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 40 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="fixed inset-0 z-[60] bg-background overflow-y-auto"
    >
      {/* Hero */}
      <div className="relative h-[30vh] bg-primary">
        <div className="absolute inset-0 bg-[url('https://storage.googleapis.com/dala-prod-public-storage/generated-images/f095a220-d4e4-4a6a-8aec-8a5aa9c8ce04/devotional-cover-1-cb4ac9fc-1782601932817.webp')] bg-cover opacity-25" />
        <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/30 to-transparent" />
        <Button
          variant="secondary"
          size="icon"
          onClick={onClose}
          className="absolute top-6 left-6 rounded-full bg-white/20 backdrop-blur-md border-none text-white hover:bg-white/40"
        >
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={onTogglePlaylist}
          className="absolute top-6 right-6 rounded-full bg-white/20 backdrop-blur-md border-none text-white hover:bg-white/40 gap-1 text-xs"
        >
          {inPlaylist ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {inPlaylist ? 'In Playlist' : 'Playlist'}
        </Button>
        <div className="absolute bottom-6 left-6 right-6 space-y-2">
          <div className="flex items-center gap-2">
            <Badge className="bg-white/20 text-white border-none text-[10px] font-bold">Hymn {hymn.number}</Badge>
            <Badge className="bg-accent text-accent-foreground text-[10px] font-bold">{hymn.category}</Badge>
            {isCmsHymn(hymn) && (
              <Badge className="bg-white/20 text-white border-none text-[10px] font-bold">Library</Badge>
            )}
          </div>
          <h1 className="text-3xl font-serif font-bold text-white leading-tight">{hymn.title}</h1>
          <p className="text-sm text-white/80 font-medium">
            {hymn.author}{hymn.yearWritten ? ` • ${hymn.yearWritten}` : ''} • Public Domain
          </p>
        </div>
      </div>

      <div className="px-6 py-6 space-y-6 pb-36">
        {/* Controls */}
        <div className="flex items-center justify-between border-y border-border/50 py-3">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" className="h-8 px-2 gap-1 text-xs" onClick={() => setFontSize(f => Math.max(14, f - 1))}>
              <Type className="w-4 h-4" /> A-
            </Button>
            <Button size="sm" variant="ghost" className="h-8 px-2 gap-1 text-xs" onClick={() => setFontSize(f => Math.min(24, f + 1))}>
              <Type className="w-4 h-4" /> A+
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className={cn('h-8 px-2 gap-1 text-xs', showChords && 'text-primary bg-primary/10')}
              onClick={() => setShowChords(s => !s)}
            >
              <ListMusic className="w-4 h-4" /> Chords
            </Button>
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => changeKeyShift(-1)} title="Transpose down">♭</Button>
            <span className="text-[10px] font-bold text-muted-foreground w-10 text-center">
              {keyShift === 0 ? (hymn.keySignature ?? '-') : `${hymn.keySignature ?? ''}${keyShift > 0 ? `+${keyShift}` : keyShift}`}
            </span>
            <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => changeKeyShift(1)} title="Transpose up">♯</Button>
          </div>
        </div>

        {/* Real Synthesized Organ Audio Player */}
        <div className="rounded-2xl bg-primary/5 border border-primary/10 p-4 space-y-3">
          <div className="flex items-center gap-4">
            <button
              onClick={() => onTogglePlay(keyShift)}
              className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg active:scale-95 transition-transform shrink-0"
              aria-label={isPlaying ? 'Pause hymn' : 'Play hymn'}
            >
              {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-0.5" />}
            </button>
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-primary text-sm truncate">{hymn.tuneName ?? 'Traditional Organ Melody'}</h4>
              <p className="text-[10px] text-muted-foreground uppercase font-bold">
                {isPlaying ? 'Playing Organ Accompaniment' : 'Ready to Play'} • {formatSeconds(currentTime)} / {formatSeconds(duration)}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-primary"
              onClick={handleDownloadWav}
              title="Download offline .wav audio"
            >
              <Download className="w-5 h-5" />
            </Button>
          </div>

          {/* Interactive Seek Bar */}
          <div className="space-y-1">
            <input
              type="range"
              min={0}
              max={duration || 30}
              step={0.5}
              value={currentTime}
              onChange={(e) => hymnPlayer.seek(Number(e.target.value))}
              className="w-full accent-primary h-1.5 bg-primary/15 rounded-lg cursor-pointer"
              aria-label="Seek audio position"
            />
          </div>

          {/* Volume Control */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => hymnPlayer.setVolume(volume > 0 ? 0 : 0.75)}
              className="text-muted-foreground hover:text-primary"
              aria-label="Toggle mute"
            >
              {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => hymnPlayer.setVolume(Number(e.target.value))}
              className="w-28 accent-primary h-1 bg-muted rounded-lg cursor-pointer"
              aria-label="Audio volume"
            />
            <span className="text-[10px] text-muted-foreground font-mono">{Math.round(volume * 100)}%</span>
          </div>
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
                  className="font-serif text-foreground/90 italic leading-relaxed whitespace-pre-line"
                  style={{ fontSize }}
                >
                  {showChords && <span className="block font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Chords: {hymn.keySignature ?? '-'} • {hymn.meter ?? 'Free meter'}</span>}
                  {stanza}
                </p>
              </div>
            </div>
          ))}

          {hymn.chorus && (
            <div className="rounded-xl bg-accent/10 border border-accent/20 p-4">
              <p
                className="font-serif font-bold text-primary italic leading-relaxed whitespace-pre-line"
                style={{ fontSize }}
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
            <Button variant="outline" size="icon" className="rounded-xl h-11 w-11 shrink-0" onClick={() => onOpen(prevHymn.id)}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <Button variant="outline" size="icon" className={cn('rounded-xl h-11 w-11 shrink-0', hymn.isFavorite && 'bg-amber-500/10 border-amber-500/40')} onClick={onFavorite}>
              <Heart className={cn('w-5 h-5', hymn.isFavorite ? 'fill-rose-500 text-rose-500' : 'text-primary')} />
            </Button>
            <Button variant="outline" size="icon" className="rounded-xl h-11 w-11 shrink-0" onClick={copyLyrics}>
              <Copy className="w-5 h-5" />
            </Button>
            <Button variant="outline" size="icon" className="rounded-xl h-11 w-11 shrink-0" onClick={share}>
              <Share2 className="w-5 h-5" />
            </Button>
            <Button className="h-11 flex-1 rounded-xl gap-2 font-bold" onClick={() => onTogglePlay(keyShift)}>
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
              {isPlaying ? 'Pause' : 'Play'} Hymn
            </Button>
            <Button variant="outline" size="icon" className="rounded-xl h-11 w-11 shrink-0" onClick={() => onOpen(nextHymn.id)}>
              <ChevronLeft className="w-5 h-5 rotate-180" />
            </Button>
          </div>
          <p className="text-center text-[10px] text-muted-foreground mt-2 flex items-center justify-center gap-1">
            <Clock className="w-3 h-3" /> {hymn.number} / {allHymns.length} • Use Prev / Next to browse the book
          </p>
        </div>
      </div>
    </motion.div>
  )
}