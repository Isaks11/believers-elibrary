import { useState, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Upload,
  Download,
  FileText,
  AlertCircle,
  CheckCircle2,
  Music2,
  X,
  Loader2,
  Info,
} from 'lucide-react'
import { toast } from 'sonner'
import { parseCsvToGrid } from '@/lib/csvParser'
import { bulkCreateContent, listContent, storageFeedback } from '@/lib/contentAdmin'
import { findHymnNumberConflict, splitHymnTitleAndTune, type HymnSectionType } from '@/lib/hymnUtils'
import { useAuth } from '@/contexts/AuthContext'
import type { ContentDraft, HymnRecord } from '@/types/content'

export interface BulkHymnDialogProps {
  open: boolean
  onClose: () => void
  onChanged?: () => void
}

interface ParsedHymnRow {
  number: number | null
  title: string
  lyrics: string
  category: string | null
  composer: string | null
  tune: string | null
  meter: string | null
  language: string | null
  tags: string[]
  audio_url: string | null
  offline_policy: 'online_only' | 'optional' | 'essential'
  status: 'draft' | 'published'
  hymn_type: HymnSectionType
}

function parseTags(raw: string): string[] {
  if (!raw) return []
  return raw.split(/[;|]/).map((t) => t.trim()).filter(Boolean)
}

function normalizeOfflinePolicy(raw: string): 'online_only' | 'optional' | 'essential' {
  const v = raw.trim().toLowerCase().replace(/[\s-]+/g, '_')
  if (v === 'essential' || v === 'required') return 'essential'
  if (v === 'optional' || v === 'cache' || v === 'cached') return 'optional'
  return 'online_only'
}

function normalizeStatus(raw: string): 'draft' | 'published' {
  return raw.trim().toLowerCase() === 'draft' ? 'draft' : 'published'
}

function normalizeHeader(h: string): string {
  const clean = h.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (clean === 'hymnnumber' || clean === 'no' || clean === 'num') return 'number'
  if (clean === 'name') return 'title'
  if (clean === 'text' || clean === 'words' || clean === 'verses') return 'lyrics'
  if (clean === 'author' || clean === 'writer') return 'composer'
  if (clean === 'tune' || clean === 'tunename') return 'tune'
  if (clean === 'type' || clean === 'hymntype' || clean === 'section') return 'hymn_type'
  if (clean === 'lang') return 'language'
  if (clean === 'tag' || clean === 'keywords') return 'tags'
  if (clean === 'audio' || clean === 'audiourl' || clean === 'audiofile') return 'audio_url'
  if (clean === 'offline' || clean === 'offlinepolicy') return 'offline_policy'
  return clean
}

function generateHymnsTemplateCsv(): string {
  const rows = [
    ['number', 'title', 'lyrics', 'category', 'composer', 'meter', 'language', 'tags', 'audio_url', 'offline_policy', 'status'],
    [
      '1',
      'Amazing Grace',
      '1. Amazing grace! How sweet the sound\n   That saved a wretch like me!\n   I once was lost, but now am found;\n   Was blind, but now I see.\n\n2. \'Twas grace that taught my heart to fear,\n   And grace my fears relieved;\n   How precious did that grace appear\n   The hour I first believed.',
      'Worship',
      'John Newton',
      '8.6.8.6',
      'English',
      'grace; salvation; testimony',
      '',
      'optional',
      'published',
    ],
    [
      '2',
      'How Great Thou Art',
      '1. O Lord my God, when I in awesome wonder\n   Consider all the worlds Thy hands have made,\n   I see the stars, I hear the rolling thunder,\n   Thy power throughout the universe displayed.\n\n   Then sings my soul, my Savior God, to Thee,\n   How great Thou art, how great Thou art!',
      'Praise',
      'Carl Boberg',
      '11.10.11.10',
      'English',
      'praise; creation; majesty',
      '',
      'optional',
      'published',
    ],
    [
      '3',
      'It Is Well With My Soul',
      '1. When peace like a river attendeth my way,\n   When sorrows like sea billows roll;\n   Whatever my lot, Thou hast taught me to say,\n   "It is well, it is well with my soul."\n\n   It is well with my soul,\n   It is well, it is well with my soul.',
      'Comfort',
      'Horatio Spafford',
      '11.8.11.9',
      'English',
      'peace; comfort; trust',
      '',
      'online_only',
      'draft',
    ],
  ]

  return rows
    .map((row) =>
      row
        .map((field) => {
          const str = String(field)
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`
          }
          return str
        })
        .join(',')
    )
    .join('\r\n')
}

export function BulkHymnDialog({ open, onClose, onChanged }: BulkHymnDialogProps) {
  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [fileName, setFileName] = useState<string>('')
  const [validRows, setValidRows] = useState<ParsedHymnRow[]>([])
  const [errors, setErrors] = useState<{ rowNumber: number; message: string }[]>([])
  const [importing, setImporting] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [sectionType, setSectionType] = useState<HymnSectionType>('hymn')

  const actor = { id: user?.id ?? null, role: user?.role ?? 'user' }

  const handleDownloadTemplate = () => {
    const csvContent = generateHymnsTemplateCsv()
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', 'hymns_bulk_template.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success('Downloaded hymns_bulk_template.csv')
  }

  const handleFileProcess = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast.error('Please upload a CSV file (.csv)')
      return
    }

    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = async (e) => {
      const text = e.target?.result as string
      if (!text) {
        toast.error('Uploaded file is empty')
        return
      }

      const grid = parseCsvToGrid(text)
      if (grid.length < 2) {
        toast.error('CSV file must contain a header row and at least one data row')
        return
      }

      let existingCmsHymns: HymnRecord[] = []
      try {
        const res = await listContent('hymn', { pageSize: 1000 })
        existingCmsHymns = res.rows
      } catch {
        existingCmsHymns = []
      }

      const headers = grid[0].map((h) => normalizeHeader(h.trim()))
      const idx = (name: string) => headers.indexOf(name)
      const numberIdx = idx('number')
      const titleIdx = idx('title')
      const lyricsIdx = idx('lyrics')
      const categoryIdx = idx('category')
      const composerIdx = idx('composer')
      const tuneIdx = idx('tune')
      const hymnTypeIdx = idx('hymn_type')
      const meterIdx = idx('meter')
      const languageIdx = idx('language')
      const tagsIdx = idx('tags')
      const audioIdx = idx('audio_url')
      const offlineIdx = idx('offline_policy')
      const statusIdx = idx('status')

      if (titleIdx === -1 || lyricsIdx === -1) {
        toast.error('CSV must include required columns: title and lyrics')
        return
      }

      const parsedValid: ParsedHymnRow[] = []
      const parsedErrors: { rowNumber: number; message: string }[] = []
      const seenNumbers = new Map<string, { rowNum: number; title: string }>()

      for (let i = 1; i < grid.length; i++) {
        const row = grid[i]
        if (row.every((cell) => !cell?.trim())) continue

        const rowNum = i + 1
        const rawTitle = (row[titleIdx] || '').trim()
        const rawTune = (tuneIdx !== -1 ? row[tuneIdx] : '')?.trim() || null
        const { title, tune } = splitHymnTitleAndTune(rawTitle, rawTune)
        const lyrics = (row[lyricsIdx] || '').trim()
        const rawRowType = (hymnTypeIdx !== -1 ? row[hymnTypeIdx] : '')?.trim().toLowerCase() || ''
        const rowSection: HymnSectionType =
          rawRowType === 'chorus' || rawRowType === 'choruses'
            ? 'chorus'
            : rawRowType === 'hymn' || rawRowType === 'hymns'
              ? 'hymn'
              : sectionType
        const sectionLabel = rowSection === 'chorus' ? 'Chorus' : 'Hymn'

        if (!title) {
          parsedErrors.push({ rowNumber: rowNum, message: 'Title is required' })
          continue
        }
        if (!lyrics) {
          parsedErrors.push({ rowNumber: rowNum, message: 'Lyrics are required' })
          continue
        }

        const numStr = numberIdx !== -1 ? (row[numberIdx] || '').trim() : ''
        const parsedNum = numStr ? Number(numStr) : null
        if (numStr && (!Number.isInteger(parsedNum) || (parsedNum ?? 0) <= 0)) {
          parsedErrors.push({ rowNumber: rowNum, message: `Invalid ${sectionLabel.toLowerCase()} number "${numStr}". Must be a positive whole number.` })
          continue
        }

        const hymnNumber = parsedNum != null && Number.isFinite(parsedNum) ? parsedNum : null
        if (hymnNumber !== null) {
          const conflict = findHymnNumberConflict(hymnNumber, existingCmsHymns, null, rowSection)
          if (conflict) {
            parsedErrors.push({
              rowNumber: rowNum,
              message: `${sectionLabel} #${hymnNumber} is already used by "${conflict.title}"`,
            })
            continue
          }
          const dupKey = `${rowSection}:${hymnNumber}`
          const csvDup = seenNumbers.get(dupKey)
          if (csvDup) {
            parsedErrors.push({
              rowNumber: rowNum,
              message: `Duplicate ${sectionLabel.toLowerCase()} #${hymnNumber} in CSV (already used on row ${csvDup.rowNum} by "${csvDup.title}")`,
            })
            continue
          }
          seenNumbers.set(dupKey, { rowNum, title })
        }

        parsedValid.push({
          number: hymnNumber,
          title,
          lyrics,
          category: (categoryIdx !== -1 ? row[categoryIdx] : '')?.trim() || null,
          composer: (composerIdx !== -1 ? row[composerIdx] : '')?.trim() || null,
          tune,
          meter: (meterIdx !== -1 ? row[meterIdx] : '')?.trim() || null,
          language: (languageIdx !== -1 ? row[languageIdx] : '')?.trim() || 'English',
          tags: parseTags((tagsIdx !== -1 ? row[tagsIdx] : '') || ''),
          audio_url: (audioIdx !== -1 ? row[audioIdx] : '')?.trim() || null,
          offline_policy: normalizeOfflinePolicy((offlineIdx !== -1 ? row[offlineIdx] : '') || 'optional'),
          status: normalizeStatus((statusIdx !== -1 ? row[statusIdx] : '') || 'published'),
          hymn_type: rowSection,
        })
      }

      setValidRows(parsedValid)
      setErrors(parsedErrors)

      if (parsedValid.length > 0) toast.success(`Found ${parsedValid.length} valid hymn(s) ready to import`)
      if (parsedErrors.length > 0) toast.warning(`${parsedErrors.length} row(s) need attention`)
    }
    reader.onerror = () => toast.error('Failed to read file')
    reader.readAsText(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFileProcess(e.dataTransfer.files[0])
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) handleFileProcess(e.target.files[0])
  }

  const handleReset = () => {
    setFileName('')
    setValidRows([])
    setErrors([])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleImport = async () => {
    if (validRows.length === 0) return

    setImporting(true)
    try {
      const drafts = validRows.map((row) => ({
        title: row.title,
        number: row.number,
        lyrics: row.lyrics,
        category: row.category,
        hymn_category: row.hymn_type === 'chorus' ? (row.category || 'Chorus') : row.category,
        hymn_type: row.hymn_type,
        composer: row.composer,
        tune: row.tune,
        meter: row.meter,
        language: row.language || 'English',
        tags: row.tags,
        audio_url: row.audio_url,
        offline_policy: row.offline_policy,
        status: row.status,
      })) as unknown as Array<ContentDraft<HymnRecord> & { status?: any }>

      const res = await bulkCreateContent('hymn', drafts, actor)

      if (res.created.length > 0) {
        const feedback = storageFeedback(res, `Imported ${res.created.length} hymn(s)`)
        toast[feedback.level](feedback.message)
        onChanged?.()
        handleReset()
        onClose()
      } else {
        toast.error('No hymns were imported. Review validation issues and try again.')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error importing hymns')
    } finally {
      setImporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-1.5">
          <DialogTitle className="flex items-center gap-2 text-xl font-serif">
            <Upload className="w-5 h-5 text-primary" />
            Bulk Upload Hymns
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Import hymns in bulk with complete metadata and lyrics. Use the template to ensure all fields map correctly.
          </p>
        </DialogHeader>

        <div className="space-y-4 my-1">
          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="border-primary/15 bg-primary/5">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2 text-primary">
                  <FileText className="w-4 h-4" />
                  <span className="text-sm font-semibold">1. Download template</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Includes all hymn fields: <span className="font-medium text-foreground">number, title, lyrics, category, composer, meter, language, tags, audio_url, offline_policy, status</span>.
                </p>
                <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="h-8 text-xs gap-1.5">
                  <Download className="w-3.5 h-3.5" /> Download CSV template
                </Button>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2 text-primary">
                  <Info className="w-4 h-4" />
                  <span className="text-sm font-semibold">Field guide</span>
                </div>
                <ul className="text-xs text-muted-foreground space-y-1 leading-relaxed">
                  <li><strong>Required:</strong> title, lyrics (supports multiline verses)</li>
                  <li><strong>Tags:</strong> separate with <code>;</code> or <code>|</code></li>
                  <li><strong>offline_policy:</strong> online_only, optional, essential</li>
                  <li><strong>status:</strong> draft or published; audio_url optional</li>
                </ul>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-secondary/30 border border-border/50">
            <div>
              <p className="text-xs font-semibold text-primary">Upload Destination Section</p>
              <p className="text-[11px] text-muted-foreground">Choruses have their own independent numbers (#1, #2, …) separate from Hymns.</p>
            </div>
            <div className="grid grid-cols-2 gap-1.5 shrink-0">
              {(['hymn', 'chorus'] as HymnSectionType[]).map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => {
                    if (sectionType !== sec) {
                      setSectionType(sec)
                      handleReset()
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    sectionType === sec
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-background text-muted-foreground border-border hover:text-primary'
                  }`}
                >
                  {sec === 'chorus' ? 'Chorus' : 'Hymns'}
                </button>
              ))}
            </div>
          </div>

          {!fileName ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                dragOver ? 'border-primary bg-primary/10 scale-[1.01]' : 'border-border hover:border-primary/50 hover:bg-secondary/30'
              }`}
            >
              <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleFileSelect} className="hidden" />
              <div className="w-12 h-12 rounded-xl bg-secondary/60 flex items-center justify-center mx-auto mb-3">
                <Upload className="w-6 h-6 text-primary" />
              </div>
              <p className="text-sm font-semibold text-primary">Upload completed CSV</p>
              <p className="text-xs text-muted-foreground mt-1">Click to browse or drag and drop. Quoted multiline lyrics are supported.</p>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-secondary/40 border border-border/60 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-primary truncate">{fileName}</p>
                  <p className="text-xs text-muted-foreground">{validRows.length} ready to import{errors.length > 0 ? ` • ${errors.length} issue(s)` : ' • all rows valid'}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={handleReset} className="h-8 w-8 p-0 text-muted-foreground shrink-0"><X className="w-4 h-4" /></Button>
            </div>
          )}

          {errors.length > 0 && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1.5">
              <span className="text-xs font-bold flex items-center gap-1.5 text-amber-800"><AlertCircle className="w-4 h-4" /> Validation issues ({errors.length})</span>
              <div className="max-h-28 overflow-y-auto space-y-1 text-xs text-amber-800/90">
                {errors.map((err, i) => (<p key={i}><strong>Row {err.rowNumber}:</strong> {err.message}</p>))}
              </div>
            </div>
          )}

          {validRows.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Import preview ({validRows.length})
                </span>
                <span className="text-[11px] text-muted-foreground">Full metadata included</span>
              </div>
              <div className="max-h-64 overflow-y-auto border border-border/60 rounded-xl divide-y divide-border/40 bg-card">
                {validRows.map((row, idx) => (
                  <div key={idx} className="p-3 flex items-start justify-between gap-3 text-xs hover:bg-secondary/20">
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {row.number != null && <Badge variant="outline" className="text-[10px] font-mono py-0 px-1.5 bg-secondary/60">#{row.number}</Badge>}
                        <span className="font-semibold text-primary">{row.title}</span>
                        <Badge variant={row.status === 'published' ? 'default' : 'secondary'} className="text-[10px] py-0 px-1.5 capitalize">{row.status}</Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-2 whitespace-pre-line">{row.lyrics.split('\n')[0]}</p>
                      <div className="flex flex-wrap gap-1">
                        {row.language && <Badge variant="outline" className="text-[10px] py-0">{row.language}</Badge>}
                        {row.meter && <Badge variant="outline" className="text-[10px] py-0">{row.meter}</Badge>}
                        <Badge variant="outline" className="text-[10px] py-0">{row.offline_policy.replace('_', ' ')}</Badge>
                        {row.tags.slice(0, 3).map((t) => <Badge key={t} variant="secondary" className="text-[10px] py-0">{t}</Badge>)}
                      </div>
                    </div>
                    <div className="text-right shrink-0 space-y-1 max-w-[40%]">
                      {row.category && <Badge variant="secondary" className="text-[10px] py-0 px-1.5"><Music2 className="w-2.5 h-2.5 mr-1 inline" />{row.category}</Badge>}
                      {row.composer && <p className="text-[10px] text-muted-foreground">{row.composer}</p>}
                      {row.audio_url && <p className="text-[10px] text-emerald-700">Audio linked</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/40">
          <Button variant="outline" size="sm" onClick={onClose} disabled={importing}>Cancel</Button>
          <Button size="sm" onClick={handleImport} disabled={validRows.length === 0 || importing} className="gap-1.5 bg-primary text-primary-foreground min-w-[160px]">
            {importing ? (<><Loader2 className="w-3.5 h-3.5 animate-spin" /> Importing...</>) : (<><Upload className="w-3.5 h-3.5" /> Import {validRows.length} hymn{validRows.length === 1 ? '' : 's'}</>)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
