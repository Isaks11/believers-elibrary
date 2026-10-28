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
  Calendar,
  BookOpen,
  X,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { parseDevotionalsCsv, generateDevotionalsTemplateCsv, type ParsedDevotionalRow } from '@/lib/csvParser'
import { bulkCreateContent } from '@/lib/contentAdmin'
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

  const actor = { id: user?.id ?? null, role: user?.role ?? 'user' }

  const handleDownloadTemplate = () => {
    const csvContent = generateDevotionalsTemplateCsv()
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', 'devotionals_template.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success('Downloaded devotionals_template.csv')
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
        toast.warning(`${res.errors.length} row(s) have validation issues`)
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
      const drafts = validRows.map((row) => ({
        title: row.title,
        body: row.body,
        verse_ref: row.verse_ref,
        verse_text: row.verse_text,
        translation: 'KJV',
        devotional_date: row.devotional_date,
        category: row.category,
        author: row.author,
        status: row.status,
      })) as unknown as Array<ContentDraft<DevotionalRecord> & { status?: any }>

      const res = bulkCreateContent('devotional', drafts, actor)

      if (res.created.length > 0) {
        toast.success(`Successfully imported ${res.created.length} devotional(s)!`)
        onChanged?.()
        handleReset()
        onClose()
      } else {
        toast.error('Failed to import devotionals. Check row formatting.')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error importing devotionals')
    } finally {
      setImporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-serif">
            <Upload className="w-5 h-5 text-primary" />
            Bulk Upload Devotionals
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Upload multiple devotionals at once using a CSV spreadsheet. Each devotional will be scheduled and displayed to users on its configured date.
          </p>
        </DialogHeader>

        <div className="space-y-4 my-2">
          {/* Step 1: Download Template */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-3.5 flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-primary" /> Download CSV Template
                </span>
                <p className="text-[11px] text-muted-foreground">
                  Includes required columns: <strong>date</strong> (YYYY-MM-DD), <strong>title</strong>, <strong>verse_ref</strong>, <strong>body</strong>, and sample rows.
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

          {/* Step 2: Upload CSV File */}
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
                onChange={handleFileSelect}
                className="hidden"
              />
              <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-semibold text-primary">Click to select or drag and drop your CSV file</p>
              <p className="text-xs text-muted-foreground mt-1">Accepts CSV files with multiline quotes</p>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-secondary/40 border border-border/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-xs font-bold text-primary">{fileName}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {validRows.length} valid rows found {errors.length > 0 && `• ${errors.length} issue(s)`}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={handleReset} className="h-7 w-7 p-0 text-muted-foreground">
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Validation Errors */}
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

          {/* Preview of Valid Rows */}
          {validRows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Preview Devotionals to Import ({validRows.length})
                </span>
                <span className="text-[10px] text-muted-foreground">Dates determine user daily display</span>
              </div>
              <div className="max-h-56 overflow-y-auto border border-border/60 rounded-xl divide-y divide-border/40 bg-card">
                {validRows.map((row, idx) => (
                  <div key={idx} className="p-2.5 flex items-start justify-between gap-3 text-xs hover:bg-secondary/20">
                    <div className="space-y-0.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] font-mono py-0 px-1 bg-secondary/60">
                          <Calendar className="w-2.5 h-2.5 mr-1 inline" />
                          {row.devotional_date}
                        </Badge>
                        <span className="font-semibold text-primary truncate">{row.title}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">{row.body}</p>
                    </div>
                    <div className="text-right shrink-0 space-y-0.5">
                      <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                        <BookOpen className="w-2.5 h-2.5 mr-1 inline" />
                        {row.verse_ref}
                      </Badge>
                      {row.category && (
                        <p className="text-[9px] text-muted-foreground uppercase">{row.category}</p>
                      )}
                    </div>
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
                <Upload className="w-3.5 h-3.5" /> Import {validRows.length} Devotionals
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
