import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  ChevronLeft, Music2, Search, Star, Share2, Copy, Play, Pause,
  Download, ListMusic, Volume2, Type, Heart, Clock
} from 'lucide-react'
import { toast } from 'sonner'
import { HYMN_CATEGORIES } from '@/types/devotional-hymn'
import { getHymns, updateHymn } from '@/data/mockDevotionalHymnData'
import { cn } from '@/lib/utils'
import type { Hymn } from '@/types/devotional-hymn'

export function HymnBook() {
  const [hymns, setHymns] = useState<Hymn[]>(() => getHymns())
  const [category, setCategory] = useState('All')
  const [query, setQuery] = useState('')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return hymns.filter(h => {
      const inCategory = category === 'All' || h.category === category
      const matchesQuery = !q ||
        h.title.toLowerCase().includes(q) ||
        String(h.number).includes(q) ||
        h.author.toLowerCase().includes(q) ||
        h.stanzas.some(s => s.toLowerCase().includes(q)) ||
        (h.chorus ?? '').toLowerCase().includes(q)
      return inCategory && matchesQuery
    })
  }, [hymns, category, query])

  const togglePlay = (id: string) => {
    setPlayingId(prev => (prev === id ? null : id))
  }

  const toggleFavorite = (id: string) => {
    const hymn = hymns.find(h => h.id === id)
    if (!hymn) return
    const updated = updateHymn(id, { isFavorite: !hymn.isFavorite })
    setHymns(updated)
    toast.success(hymn.isFavorite ? 'Removed from favorites' : 'Added to favorites')
  }

  const detail = hymns.find(h => h.id === detailId) ?? null

  return (
    <div className="space-y-5 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header>
        <h1 className="text-2xl font-serif text-primary">Hymn Book</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Timeless hymns of the faith, {hymns.length} hymns and growing
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

      {/* Category Pills */}
      <div className="flex overflow-x-auto gap-2 no-scrollbar pb-1">
        {['All', ...HYMN_CATEGORIES].map(cat => (
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
          {filtered.map((hymn, i) => (
            <motion.div
              key={hymn.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.3 }}
            >
              <Card
                className="border-none shadow-sm hover:shadow-lg transition-shadow cursor-pointer group"
              >
                <CardContent
                  className="p-4 flex items-center gap-4"
                  onClick={() => setDetailId(hymn.id)}
                >
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex flex-col items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors shrink-0">
                    <span className="text-lg font-bold leading-none">{hymn.number}</span>
                    <span className="text-[8px] uppercase font-bold opacity-70">Hymn</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-primary truncate group-hover:text-primary/80 transition-colors">{hymn.title}</h3>
                    <p className="text-xs text-muted-foreground truncate">
                      {hymn.author} • {hymn.tuneName ?? hymn.category}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge className="bg-secondary/50 text-secondary-foreground text-[9px] px-1.5 py-0">{hymn.category}</Badge>
                      {hymn.keySignature && <span className="text-[10px] text-muted-foreground font-bold uppercase">Key {hymn.keySignature}</span>}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-10 w-10 p-0 rounded-full shrink-0"
                    onClick={e => { e.stopPropagation(); toggleFavorite(hymn.id) }}
                  >
                    <Star className={cn('w-5 h-5 transition-colors', hymn.isFavorite ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground')} />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>

        {filtered.length === 0 && (
          <div className="py-16 text-center space-y-2">
            <Music2 className="w-10 h-10 text-muted-foreground mx-auto" />
            <p className="text-sm font-medium text-muted-foreground">No hymns found</p>
            <p className="text-xs text-muted-foreground/70">Try a different search or category</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {detail && (
          <HymnDetail
            hymn={detail}
            isPlaying={playingId === detail.id}
            onClose={() => setDetailId(null)}
            onTogglePlay={() => togglePlay(detail.id)}
            onFavorite={() => toggleFavorite(detail.id)}
            allHymns={hymns}
            onOpen={setDetailId}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function HymnDetail({ hymn, isPlaying, onClose, onTogglePlay, onFavorite, allHymns, onOpen }: {
  hymn: Hymn
  isPlaying: boolean
  onClose: () => void
  onTogglePlay: () => void
  onFavorite: () => void
  allHymns: Hymn[]
  onOpen: (id: string) => void
}) {
  const [fontSize, setFontSize] = useState(17)
  const [showChords, setShowChords] = useState(false)
  const [keyShift, setKeyShift] = useState(0)
  const [activeStanza, setActiveStanza] = useState<number | null>(null)

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
      <div className="relative h-[32vh] bg-primary">
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
        <div className="absolute bottom-6 left-6 right-6 space-y-2">
          <div className="flex items-center gap-2">
            <Badge className="bg-white/20 text-white border-none text-[10px] font-bold">Hymn {hymn.number}</Badge>
            <Badge className="bg-accent text-accent-foreground text-[10px] font-bold">{hymn.category}</Badge>
          </div>
          <h1 className="text-3xl font-serif font-bold text-white leading-tight">{hymn.title}</h1>
          <p className="text-sm text-white/80 font-medium">
            {hymn.author}{hymn.yearWritten ? ` • ${hymn.yearWritten}` : ''}
          </p>
        </div>
      </div>

      <div className="px-6 py-6 space-y-6 pb-32">
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
            <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => setKeyShift(s => (s - 1 + 12) % 12)}>♭</Button>
            <span className="text-[10px] font-bold text-muted-foreground w-8 text-center">
              {keyShift === 0 ? (hymn.keySignature ?? '-') : `${hymn.keySignature ?? ''}+${keyShift}`}
            </span>
            <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => setKeyShift(s => (s + 1) % 12)}>♯</Button>
          </div>
        </div>

        {/* Audio Player */}
        <div className="rounded-2xl bg-primary/5 border border-primary/10 p-4 space-y-3">
          <div className="flex items-center gap-4">
            <button
              onClick={onTogglePlay}
              className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg active:scale-95 transition-transform"
            >
              {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current" />}
            </button>
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-primary text-sm truncate">{hymn.tuneName ?? 'Traditional Melody'}</h4>
              <p className="text-[10px] text-muted-foreground uppercase font-bold">
                {hymn.tuneName ? 'Tune' : 'Audio'} {isPlaying ? '• Playing' : ''} {hymn.keySignature ? `• Key ${hymn.keySignature}` : ''}
              </p>
            </div>
            <Button variant="ghost" size="icon" className="text-muted-foreground" onClick={() => toast.info('Audio downloaded')}>
              <Download className="w-5 h-5" />
            </Button>
          </div>
          {isPlaying && (
            <div className="relative h-1.5 rounded-full bg-primary/10 overflow-hidden">
              <motion.div
                className="absolute inset-y-0 left-0 bg-primary rounded-full"
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: 90, ease: 'linear' }}
              />
            </div>
          )}
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
              <ChevronLeft className="w-5 h-5 rotate-180" />
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
            <Button className="h-11 flex-1 rounded-xl gap-2 font-bold" onClick={onTogglePlay}>
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
              {isPlaying ? 'Pause' : 'Play'} Hymn
            </Button>
            <Button variant="outline" size="icon" className="rounded-xl h-11 w-11 shrink-0" onClick={() => onOpen(nextHymn.id)}>
              <ChevronLeft className="w-5 h-5 rotate-0" />
            </Button>
          </div>
          <p className="text-center text-[10px] text-muted-foreground mt-2 flex items-center justify-center gap-1">
            <Clock className="w-3 h-3" /> {hymn.number} / {allHymns.length} • Use Prev / Next to browse the book
          </p>
          <div className="flex items-center justify-center gap-3 mt-2 text-muted-foreground">
            <Volume2 className="w-3.5 h-3.5" />
            <div className="w-24 h-1 rounded-full bg-muted"><div className="h-full w-2/3 bg-primary rounded-full" /></div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}