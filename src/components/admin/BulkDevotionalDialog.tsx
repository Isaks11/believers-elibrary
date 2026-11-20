import { useState, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Upload,
  Download,
  FileText,
  AlertCircle,
  CheckCircle2,
  Calendar,
  BookOpen,
  X,
  Loader2,
  Info,
} from 'lucide-react'
import { toast } from 'sonner'
import { parseDevotionalsCsv, generateDevotionalsTemplateCsv, type ParsedDevotionalRow } from '@/lib/csvParser'
import { bulkCreateContent, storageFeedback } from '@/lib/contentAdmin'
import { useAuth } from '@/contexts/AuthContext'
import type { ContentDraft, DevotionalRecord } from '@/types/content'

export interface BulkDevotionalDialogProps {
  open: boolean
  onClose: () => void
  onChanged?: () => void
}

export function BulkDevotionalDialog({ open, onClose, onChanged }: BulkDevotionalDialogProps) {
  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [fileName, setFileName] = useState<string>('')
  const [validRows, setValidRows] = useState<ParsedDevotionalRow[]>([])
  const [errors, setErrors] = useState<{ rowNumber: number; message: string }[]>([])
  const [importing, setImporting] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [defaultTranslation, setDefaultTranslation] = useState<string>('none')

  const actor = { id: user?.id ?? null, role: user?.role ?? 'user' }

  const handleDownloadTemplate = () => {
    const csvContent = generateDevotionalsTemplateCsv()
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', 'devotionals_bulk_template.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success('Downloaded devotionals_bulk_template.csv')
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

      const res = parseDevotionalsCsv(text)
      setValidRows(res.valid)
      setErrors(res.errors)

      if (res.valid.length > 0) {
        toast.success(`Found ${res.valid.length} valid devotional(s) ready to import`)
      }
      if (res.errors.length > 0) {
        toast.warning(`${res.errors.length} row(s) need attention`)
      }
    }
    reader.onerror = () => toast.error('Failed to read file')
    reader.readAsText(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0])
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileProcess(e.target.files[0])
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
      const fallbackTranslation = defaultTranslation === 'none' ? null : defaultTranslation
      const drafts = validRows.map((row) => ({
        title: row.title,
        body: row.body,
        verse_ref: row.verse_ref,
        verse_text: row.verse_text,
        prayer: row.prayer || null,
        translation: row.translation ?? fallbackTranslation,
        devotional_date: row.devotional_date,
        category: row.category,
        tags: row.tags,
        author: row.author,
        license_attribution: row.license_attribution,
        offline_policy: row.offline_policy,
        status: row.status,
      })) as unknown as Array<ContentDraft<DevotionalRecord> & { status?: any }>

      const res = await bulkCreateContent('devotional', drafts, actor)

      if (res.created.length > 0) {
        const feedback = storageFeedback(res, `Imported ${res.created.length} devotional(s)`)
        toast[feedback.level](feedback.message)
        onChanged?.()
        handleReset()
        onClose()
      } else {
        toast.error('No devotionals were imported. Review validation issues and try again.')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error importing devotionals')
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
            Bulk Upload Devotionals
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Import a full devotional schedule in one action. Use the professional CSV template to include all content and publishing fields.
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
                  Template includes required and optional fields with sample rows:
                  <span className="font-medium text-foreground"> date, title, verse_ref, verse_text, body, prayer, translation, category, tags, author, license_attribution, offline_policy, status</span>.
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
                  <li><strong>Required:</strong> date (YYYY-MM-DD), title, verse_ref, body</li>
                  <li><strong>Paragraphs:</strong> leave a blank line inside quoted <code>body</code> cells (or use <code>\n\n</code>)</li>
                  <li><strong>Translation:</strong> set <code>none</code> or leave blank for no translation</li>
                  <li><strong>Tags:</strong> separate with <code>;</code> or <code>|</code></li>
                  <li><strong>status:</strong> draft or published • <strong>offline:</strong> online_only, optional, essential</li>
                </ul>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-secondary/30 border border-border/50">
            <div>
              <p className="text-xs font-semibold text-primary">Default Bible Translation</p>
              <p className="text-[11px] text-muted-foreground">Used when a CSV row leaves the translation column blank.</p>
            </div>
            <Select value={defaultTranslation} onValueChange={setDefaultTranslation}>
              <SelectTrigger className="h-8 w-full sm:w-48 text-xs bg-background">
                <SelectValue placeholder="Select translation" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (no translation)</SelectItem>
                <SelectItem value="KJV">KJV (King James Version)</SelectItem>
                <SelectItem value="WEB">WEB (World English Bible)</SelectItem>
                <SelectItem value="ASV">ASV (American Standard Version)</SelectItem>
                <SelectItem value="BBE">BBE (Bible in Basic English)</SelectItem>
                <SelectItem value="ESV">ESV (English Standard Version)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {!fileName ? (
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
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
              <p className="text-xs text-muted-foreground mt-1">Click to browse or drag and drop. Multiline quoted fields supported.</p>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-secondary/40 border border-border/60 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-primary truncate">{fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {validRows.length} ready to import{errors.length > 0 ? ` • ${errors.length} issue(s)` : ' • all rows valid'}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={handleReset} className="h-8 w-8 p-0 text-muted-foreground shrink-0">
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}

          {errors.length > 0 && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1.5">
              <span className="text-xs font-bold flex items-center gap-1.5 text-amber-800">
                <AlertCircle className="w-4 h-4" /> Validation issues ({errors.length})
              </span>
              <div className="max-h-28 overflow-y-auto space-y-1 text-xs text-amber-800/90">
                {errors.map((err, i) => (
                  <p key={i}><strong>Row {err.rowNumber}:</strong> {err.message}</p>
                ))}
              </div>
            </div>
          )}

          {validRows.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Import preview ({validRows.length})
                </span>
                <span className="text-[11px] text-muted-foreground">Scheduled by devotional date</span>
              </div>
              <div className="max-h-64 overflow-y-auto border border-border/60 rounded-xl divide-y divide-border/40 bg-card">
                {validRows.map((row, idx) => (
                  <div key={idx} className="p-3 flex items-start justify-between gap-3 text-xs hover:bg-secondary/20">
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px] font-mono py-0 px-1.5 bg-secondary/60">
                          <Calendar className="w-2.5 h-2.5 mr-1 inline" />{row.devotional_date}
                        </Badge>
                        <span className="font-semibold text-primary">{row.title}</span>
                        <Badge variant={row.status === 'published' ? 'default' : 'secondary'} className="text-[10px] py-0 px-1.5 capitalize">
                          {row.status}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-3 whitespace-pre-line">{row.body}</p>
                      {row.prayer && <p className="text-[11px] text-primary/80 line-clamp-1"><strong>Prayer:</strong> {row.prayer}</p>}
                      <div className="flex flex-wrap gap-1">
                        {(row.translation ?? (defaultTranslation === 'none' ? null : defaultTranslation)) && (
                          <Badge variant="outline" className="text-[10px] py-0">
                            {row.translation ?? defaultTranslation}
                          </Badge>
                        )}
                        {row.offline_policy && <Badge variant="outline" className="text-[10px] py-0">{row.offline_policy.replace('_', ' ')}</Badge>}
                        {row.tags.slice(0, 3).map((t) => <Badge key={t} variant="secondary" className="text-[10px] py-0">{t}</Badge>)}
                        {row.tags.length > 3 && <span className="text-[10px] text-muted-foreground">+{row.tags.length - 3}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0 space-y-1 max-w-[40%]">
                      <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                        <BookOpen className="w-2.5 h-2.5 mr-1 inline" />{row.verse_ref}
                      </Badge>
                      {row.category && <p className="text-[10px] text-muted-foreground">{row.category}</p>}
                      {row.author && <p className="text-[10px] text-muted-foreground truncate">{row.author}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/40">
          <Button variant="outline" size="sm" onClick={onClose} disabled={importing}>Cancel</Button>
          <Button size="sm" onClick={handleImport} disabled={validRows.length === 0 || importing} className="gap-1.5 bg-primary text-primary-foreground min-w-[180px]">
            {importing ? (<><Loader2 className="w-3.5 h-3.5 animate-spin" /> Importing...</>) : (<><Upload className="w-3.5 h-3.5" /> Import {validRows.length} devotional{validRows.length === 1 ? '' : 's'}</>)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
