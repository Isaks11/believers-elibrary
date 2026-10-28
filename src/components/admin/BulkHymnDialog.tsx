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
} from 'lucide-react'
import { toast } from 'sonner'
import { parseCsvToGrid } from '@/lib/csvParser'
import { bulkCreateContent } from '@/lib/contentAdmin'
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
  meter: string | null
}

function generateHymnsTemplateCsv(): string {
  const rows = [
    ['number', 'title', 'lyrics', 'category', 'composer', 'meter'],
    [
      '1',
      'Amazing Grace',
      'Amazing grace! How sweet the sound\nThat saved a wretch like me!\nI once was lost, but now am found;\nWas blind, but now I see.\n\n\'Twas grace that taught my heart to fear,\nAnd grace my fears relieved;\nHow precious did that grace appear\nThe hour I first believed!\n\nThrough many dangers, toils, and snares,\nI have already come;\n\'Tis grace hath brought me safe thus far,\nAnd grace will lead me home.',
      'Grace',
      'John Newton',
      'CM',
    ],
    [
      '2',
      'Holy, Holy, Holy',
      'Holy, holy, holy! Lord God Almighty!\nEarly in the morning our song shall rise to Thee;\nHoly, holy, holy, merciful and mighty!\nGod in three Persons, blessed Trinity!\n\nHoly, holy, holy! All the saints adore Thee,\nCasting down their golden crowns around the glassy sea;\nCherubim and seraphim falling down before Thee,\nWhich wert, and art, and evermore shalt be.',
      'Praise',
      'Reginald Heber',
      '11.12.12.10',
    ],
    [
      '3',
      'Great Is Thy Faithfulness',
      'Great is Thy faithfulness, O God my Father,\nThere is no shadow of turning with Thee;\nThou changest not, Thy compassions, they fail not;\nAs Thou hast been Thou forever wilt be.\n\nGreat is Thy faithfulness! Great is Thy faithfulness!\nMorning by morning new mercies I see;\nAll I have needed Thy hand hath provided;\nGreat is Thy faithfulness, Lord, unto me!',
      'Faith',
      'Thomas Chisholm',
      '11.10.11.10',
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

  const actor = { id: user?.id ?? null, role: user?.role ?? 'user' }

  const handleDownloadTemplate = () => {
    const csvContent = generateHymnsTemplateCsv()
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', 'hymns_template.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success('Downloaded hymns_template.csv')
  }

  const handleFileProcess = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast.error('Please upload a CSV file (.csv)')
      return
    }

    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      if (!text) {
        toast.error('Uploaded file is empty')
        return
      }

      const grid = parseCsvToGrid(text)
      if (grid.length === 0) {
        setErrors([{ rowNumber: 0, message: 'CSV file is empty' }])
        return
      }

      const headers = grid[0].map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''))
      const titleIdx = headers.indexOf('title')
      const lyricsIdx = headers.indexOf('lyrics')
      const numberIdx = headers.indexOf('number')
      const categoryIdx = headers.indexOf('category')
      const composerIdx = headers.indexOf('composer') !== -1 ? headers.indexOf('composer') : headers.indexOf('author')
      const meterIdx = headers.indexOf('meter')

      if (titleIdx === -1 || lyricsIdx === -1) {
        setErrors([{ rowNumber: 1, message: 'CSV must contain at least "title" and "lyrics" columns.' }])
        return
      }

      const parsedValid: ParsedHymnRow[] = []
      const parsedErrors: { rowNumber: number; message: string }[] = []

      grid.slice(1).forEach((row, i) => {
        const rowNum = i + 2
        const title = (row[titleIdx] || '').trim()
        const lyrics = (row[lyricsIdx] || '').trim()
        const numStr = numberIdx !== -1 ? (row[numberIdx] || '').trim() : ''
        const category = categoryIdx !== -1 ? (row[categoryIdx] || '').trim() : ''
        const composer = composerIdx !== -1 ? (row[composerIdx] || '').trim() : ''
        const meter = meterIdx !== -1 ? (row[meterIdx] || '').trim() : ''

        if (!title) {
          parsedErrors.push({ rowNumber: rowNum, message: 'Hymn title is required' })
          return
        }
        if (!lyrics) {
          parsedErrors.push({ rowNumber: rowNum, message: 'Hymn lyrics are required' })
          return
        }

        const hymnNumber = numStr ? parseInt(numStr, 10) : null

        parsedValid.push({
          number: Number.isFinite(hymnNumber) ? hymnNumber : null,
          title,
          lyrics,
          category: category || null,
          composer: composer || null,
          meter: meter || null,
        })
      })

      setValidRows(parsedValid)
      setErrors(parsedErrors)

      if (parsedValid.length > 0) {
        toast.success(`Found ${parsedValid.length} valid hymn(s) ready to import`)
      }
    }
    reader.onerror = () => {
      toast.error('Failed to read file')
    }
    reader.readAsText(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0])
    }
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
        audio_url: null,
        public_domain: true,
        hymn_category: row.category,
        category: row.category,
        meter: row.meter,
        composer: row.composer,
        status: 'published' as const,
      })) as unknown as Array<ContentDraft<HymnRecord> & { status?: any }>

      const res = bulkCreateContent('hymn', drafts, actor)

      if (res.created.length > 0) {
        toast.success(`Successfully imported ${res.created.length} hymn(s)!`)
        onChanged?.()
        handleReset()
        onClose()
      } else {
        toast.error('Failed to import hymns.')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error importing hymns')
    } finally {
      setImporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-serif">
            <Music2 className="w-5 h-5 text-primary" />
            Bulk Upload Hymns
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Upload multiple hymns at once into the digital hymnbook using a CSV file.
          </p>
        </DialogHeader>

        <div className="space-y-4 my-2">
          {/* Download Template */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-3.5 flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-primary" /> Download Hymns CSV Template
                </span>
                <p className="text-[11px] text-muted-foreground">
                  Includes columns: <strong>number</strong>, <strong>title</strong>, <strong>lyrics</strong>, <strong>category</strong>, <strong>composer</strong>, and <strong>meter</strong>.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadTemplate}
                className="shrink-0 h-8 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10"
              >
                <Download className="w-3.5 h-3.5" /> Download Template
              </Button>
            </CardContent>
          </Card>

          {/* Upload Area */}
          {!fileName ? (
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                dragOver
                  ? 'border-primary bg-primary/10 scale-[1.01]'
                  : 'border-border hover:border-primary/50 hover:bg-secondary/30'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={(e) => e.target.files?.[0] && handleFileProcess(e.target.files[0])}
                className="hidden"
              />
              <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-semibold text-primary">Click to select or drag and drop your Hymns CSV</p>
              <p className="text-xs text-muted-foreground mt-1">Supports multiline hymn lyrics and stanzas</p>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-secondary/40 border border-border/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Music2 className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-xs font-bold text-primary">{fileName}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {validRows.length} valid hymns found {errors.length > 0 && `• ${errors.length} issue(s)`}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={handleReset} className="h-7 w-7 p-0 text-muted-foreground">
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Error messages */}
          {errors.length > 0 && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1">
              <span className="text-xs font-bold flex items-center gap-1 text-amber-800">
                <AlertCircle className="w-3.5 h-3.5" /> Validation Warnings ({errors.length})
              </span>
              <div className="max-h-24 overflow-y-auto space-y-0.5 text-[11px] text-amber-700">
                {errors.map((err, i) => (
                  <p key={i}>
                    <strong>Row {err.rowNumber}:</strong> {err.message}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Preview */}
          {validRows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Preview Hymns to Import ({validRows.length})
                </span>
              </div>
              <div className="max-h-56 overflow-y-auto border border-border/60 rounded-xl divide-y divide-border/40 bg-card">
                {validRows.map((row, idx) => (
                  <div key={idx} className="p-2.5 flex items-start justify-between gap-3 text-xs hover:bg-secondary/20">
                    <div className="space-y-0.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {row.number && (
                          <Badge variant="outline" className="text-[10px] font-mono py-0 px-1.5">
                            #{row.number}
                          </Badge>
                        )}
                        <span className="font-semibold text-primary truncate">{row.title}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">{row.lyrics.slice(0, 70)}…</p>
                    </div>
                    {row.category && (
                      <Badge variant="secondary" className="text-[10px] py-0 px-1.5 shrink-0">
                        {row.category}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={onClose} disabled={importing}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleImport}
            disabled={validRows.length === 0 || importing}
            className="gap-1.5 bg-primary text-primary-foreground"
          >
            {importing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Importing...
              </>
            ) : (
              <>
                <Upload className="w-3.5 h-3.5" /> Import {validRows.length} Hymns
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
