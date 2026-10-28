import { useEffect, useState } from 'react'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { BookOpen, Sparkles, Loader2, Edit3, CheckCircle } from 'lucide-react'
import { BIBLE_BOOKS, formatBibleRef, parseBibleRef, fetchVerseText } from '@/lib/bibleService'
import { toast } from 'sonner'

export interface BibleReferencePickerProps {
  value: string
  onChange: (verseRef: string) => void
  onVerseTextFetched?: (verseText: string) => void
}

export function BibleReferencePicker({
  value,
  onChange,
  onVerseTextFetched,
}: BibleReferencePickerProps) {
  const [isManual, setIsManual] = useState(false)
  const [selectedBook, setSelectedBook] = useState<string>('John')
  const [selectedChapter, setSelectedChapter] = useState<number>(3)
  const [verseStart, setVerseStart] = useState<number | ''>(16)
  const [verseEnd, setVerseEnd] = useState<number | ''>('')
  const [fetching, setFetching] = useState(false)

  // Sync state if external value changes (or on init)
  useEffect(() => {
    if (!value) return
    const parsed = parseBibleRef(value)
    if (parsed) {
      setSelectedBook(parsed.book)
      setSelectedChapter(parsed.chapter)
      setVerseStart(parsed.verseStart ?? 1)
      setVerseEnd(parsed.verseEnd ?? '')
    } else {
      // If cannot parse, switch to manual view
      setIsManual(true)
    }
  }, [value])

  const currentBookMeta = BIBLE_BOOKS.find((b) => b.name === selectedBook) || BIBLE_BOOKS[0]
  const totalChapters = currentBookMeta?.chapters || 1

  const handleBookChange = (bookName: string) => {
    setSelectedBook(bookName)
    setSelectedChapter(1)
    const newRef = formatBibleRef(bookName, 1, verseStart || 1, verseEnd || null)
    onChange(newRef)
  }

  const handleChapterChange = (chStr: string) => {
    const ch = parseInt(chStr, 10) || 1
    setSelectedChapter(ch)
    const newRef = formatBibleRef(selectedBook, ch, verseStart || 1, verseEnd || null)
    onChange(newRef)
  }

  const handleVerseStartChange = (val: string) => {
    const num = val === '' ? '' : Math.max(1, parseInt(val, 10) || 1)
    setVerseStart(num)
    const newRef = formatBibleRef(selectedBook, selectedChapter, num || null, verseEnd || null)
    onChange(newRef)
  }

  const handleVerseEndChange = (val: string) => {
    const num = val === '' ? '' : Math.max(1, parseInt(val, 10) || 1)
    setVerseEnd(num)
    const newRef = formatBibleRef(selectedBook, selectedChapter, verseStart || null, num || null)
    onChange(newRef)
  }

  const handleFetchVerse = async () => {
    const refToFetch = value.trim()
    if (!refToFetch) {
      toast.error('Please specify a Bible reference first')
      return
    }

    setFetching(true)
    try {
      const res = await fetchVerseText(refToFetch, 'KJV')
      if (res && res.text) {
        onVerseTextFetched?.(res.text)
        toast.success(`Scripture text loaded for ${refToFetch}`)
      } else {
        toast.error(`Could not automatically fetch text for ${refToFetch}. You can enter it manually below.`)
      }
    } catch {
      toast.error('Network error while fetching scripture text.')
    } finally {
      setFetching(false)
    }
  }

  if (isManual) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground uppercase font-bold">Manual Verse Reference</span>
          <button
            type="button"
            onClick={() => setIsManual(false)}
            className="text-[11px] text-primary hover:underline flex items-center gap-1 font-medium"
          >
            <BookOpen className="w-3 h-3" /> Select from Bible selector
          </button>
        </div>
        <div className="flex gap-2">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="e.g. John 3:16 or Romans 8:28-30"
            className="text-xs"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleFetchVerse}
            disabled={fetching || !value.trim()}
            className="shrink-0 h-9 text-xs gap-1"
          >
            {fetching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3 text-amber-500" />}
            Fetch Text
          </Button>
        </div>
      </div>
    )
  }

  const otBooks = BIBLE_BOOKS.filter((b) => b.testament === 'OT')
  const ntBooks = BIBLE_BOOKS.filter((b) => b.testament === 'NT')

  return (
    <div className="space-y-2.5 p-3 rounded-xl bg-secondary/30 border border-border/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-bold text-primary">Scripture Reference</span>
          {value && (
            <Badge variant="secondary" className="text-[10px] px-2 py-0 bg-primary/10 text-primary font-bold">
              {value}
            </Badge>
          )}
        </div>
        <button
          type="button"
          onClick={() => setIsManual(true)}
          className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-1"
        >
          <Edit3 className="w-2.5 h-2.5" /> Type manually
        </button>
      </div>

      <div className="grid grid-cols-12 gap-2">
        {/* Book Selector */}
        <div className="col-span-5">
          <span className="text-[10px] text-muted-foreground block mb-1">Book</span>
          <Select value={selectedBook} onValueChange={handleBookChange}>
            <SelectTrigger className="h-8 text-xs bg-background">
              <SelectValue placeholder="Book" />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              <SelectGroup>
                <SelectLabel className="text-[10px] uppercase font-bold text-muted-foreground">New Testament</SelectLabel>
                {ntBooks.map((b) => (
                  <SelectItem key={b.name} value={b.name} className="text-xs">
                    {b.name}
                  </SelectItem>
                ))}
              </SelectGroup>
              <SelectGroup>
                <SelectLabel className="text-[10px] uppercase font-bold text-muted-foreground">Old Testament</SelectLabel>
                {otBooks.map((b) => (
                  <SelectItem key={b.name} value={b.name} className="text-xs">
                    {b.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        {/* Chapter Selector */}
        <div className="col-span-3">
          <span className="text-[10px] text-muted-foreground block mb-1">Chapter</span>
          <Select value={String(selectedChapter)} onValueChange={handleChapterChange}>
            <SelectTrigger className="h-8 text-xs bg-background">
              <SelectValue placeholder="Ch" />
            </SelectTrigger>
            <SelectContent className="max-h-56">
              {Array.from({ length: totalChapters }, (_, i) => i + 1).map((ch) => (
                <SelectItem key={ch} value={String(ch)} className="text-xs">
                  Chapter {ch}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Verse Start */}
        <div className="col-span-2">
          <span className="text-[10px] text-muted-foreground block mb-1">Verse</span>
          <Input
            type="number"
            min={1}
            max={176}
            value={verseStart}
            onChange={(e) => handleVerseStartChange(e.target.value)}
            placeholder="16"
            className="h-8 text-xs bg-background px-2"
          />
        </div>

        {/* Verse End (Optional Range) */}
        <div className="col-span-2">
          <span className="text-[10px] text-muted-foreground block mb-1">To</span>
          <Input
            type="number"
            min={1}
            max={176}
            value={verseEnd}
            onChange={(e) => handleVerseEndChange(e.target.value)}
            placeholder="—"
            className="h-8 text-xs bg-background px-2"
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        <span className="text-[10px] text-muted-foreground">
          Reference format enables users to switch translations (KJV, WEB, ASV, BBE) cleanly.
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleFetchVerse}
          disabled={fetching || !value.trim()}
          className="h-7 text-[11px] gap-1 shrink-0"
        >
          {fetching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3 text-amber-500" />}
          Auto-fill Scripture Text
        </Button>
      </div>
    </div>
  )
}
