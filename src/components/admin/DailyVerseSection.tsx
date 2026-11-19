import { useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { BookOpen, Plus, Save, Trash2, Upload, Download, FileText, X, Loader2, AlertCircle, CheckCircle2, Calendar } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import {
  deleteDailyVerse,
  generateDailyVersesTemplateCsv,
  listDailyVerses,
  parseDailyVersesCsv,
  saveDailyVerse,
  type DailyVerseInput,
  type DailyVerseRecord,
} from '@/lib/dailyVerses'

export function DailyVerseSection() {
  const { user } = useAuth()
  const [rows, setRows] = useState<DailyVerseRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<DailyVerseInput>({ verse_ref: '', verse_text: '', verse_date: '', is_active: true })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [bulkOpen, setBulkOpen] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      setRows(await listDailyVerses())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const resetForm = () => {
    setEditingId(null)
    setForm({ verse_ref: '', verse_text: '', verse_date: '', is_active: true })
  }

  const handleSave = async () => {
    if (!form.verse_ref.trim() || !form.verse_text.trim()) {
      toast.error('Verse reference and text are required')
      return
    }
    setSaving(true)
    try {
      const res = await saveDailyVerse(form, user?.id ?? null, editingId || undefined)
      if (res.ok) {
        toast.success(res.storage === 'cloud' ? 'Daily verse saved' : 'Daily verse saved on this device')
        resetForm()
        await load()
      } else {
        toast.error(res.error || 'Could not save daily verse')
        if (res.row) await load()
      }
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (row: DailyVerseRecord) => {
    setEditingId(row.id)
    setForm({ verse_ref: row.verse_ref, verse_text: row.verse_text, verse_date: row.verse_date || '', is_active: row.is_active })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this daily verse?')) return
    const res = await deleteDailyVerse(id)
    if (res.ok) toast.success('Daily verse removed')
    else toast.error(res.error || 'Removed locally, but could not update online')
    if (editingId === id) resetForm()
    await load()
  }

  return (
    <div className="space-y-4">
      <Card className="border-primary/15 bg-primary/5">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-2 text-primary">
            <BookOpen className="w-4 h-4" />
            <p className="text-sm font-semibold">Daily Verses</p>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Add and manage the verses shown as the Daily Verse on Home and Dashboard. You can schedule a verse for a specific date or keep active verses for rotation/fallback. Bulk upload is supported via CSV.
          </p>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardContent className="p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-primary">{editingId ? 'Edit daily verse' : 'Add daily verse'}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={() => setBulkOpen(true)}>
                <Upload className="w-3.5 h-3.5" /> Bulk upload
              </Button>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase">Reference *</label>
              <Input value={form.verse_ref} onChange={(e) => setForm((f) => ({ ...f, verse_ref: e.target.value }))} placeholder="e.g. John 3:16" className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase">Date (optional)</label>
              <Input type="date" value={form.verse_date || ''} onChange={(e) => setForm((f) => ({ ...f, verse_date: e.target.value }))} className="mt-1" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase">Verse text *</label>
            <Textarea value={form.verse_text} onChange={(e) => setForm((f) => ({ ...f, verse_text: e.target.value }))} placeholder="Enter the scripture text..." className="mt-1 min-h-[100px]" />
          </div>
          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active !== false} onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />
              <span className="text-sm text-muted-foreground">Active</span>
            </div>
            <div className="flex gap-2">
              {editingId && <Button variant="outline" size="sm" onClick={resetForm}>Cancel</Button>}
              <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
                <Save className="w-4 h-4" /> {saving ? 'Saving…' : editingId ? 'Update verse' : 'Add verse'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-primary">Saved daily verses</p>
          <Badge variant="secondary">{rows.length}</Badge>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading verses…</p>
        ) : rows.length === 0 ? (
          <Card className="border-dashed"><CardContent className="p-4 text-sm text-muted-foreground">No daily verses added yet. Add one above or bulk upload a CSV.</CardContent></Card>
        ) : (
          <div className="space-y-2">
            {rows.map((row) => (
              <Card key={row.id} className="border-border/60">
                <CardContent className="p-3.5 flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="secondary" className="text-[10px]">{row.verse_ref}</Badge>
                      {row.verse_date && <Badge variant="outline" className="text-[10px] gap-1"><Calendar className="w-3 h-3" />{row.verse_date}</Badge>}
                      <Badge className={row.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}>{row.is_active ? 'Active' : 'Inactive'}</Badge>
                    </div>
                    <p className="text-sm text-foreground/90 leading-relaxed line-clamp-3">{row.verse_text}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => handleEdit(row)}>Edit</Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(row.id)} aria-label="Delete verse">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <BulkDailyVerseDialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onImported={async () => { await load() }}
      />
    </div>
  )
}

function BulkDailyVerseDialog({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported: () => Promise<void> | void }) {
  const { user } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [valid, setValid] = useState<DailyVerseInput[]>([])
  const [errors, setErrors] = useState<{ rowNumber: number; message: string }[]>([])
  const [importing, setImporting] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const reset = () => { setFileName(''); setValid([]); setErrors([]); if (fileRef.current) fileRef.current.value = '' }

  const downloadTemplate = () => {
    const blob = new Blob([generateDailyVersesTemplateCsv()], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'daily_verses_template.csv'
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
    toast.success('Downloaded daily_verses_template.csv')
  }

  const process = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) { toast.error('Please upload a CSV file (.csv)'); return }
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      if (!text) { toast.error('Uploaded file is empty'); return }
      const res = parseDailyVersesCsv(text)
      setValid(res.valid); setErrors(res.errors)
      if (res.valid.length) toast.success(`Found ${res.valid.length} valid daily verse(s)`)
      if (res.errors.length) toast.warning(`${res.errors.length} row(s) need attention`)
    }
    reader.readAsText(file)
  }

  const importRows = async () => {
    if (valid.length === 0) return
    setImporting(true)
    try {
      let okCount = 0
      for (const row of valid) {
        const res = await saveDailyVerse(row, user?.id ?? null)
        if (res.ok) okCount++
      }
      if (okCount > 0) {
        toast.success(`Imported ${okCount} daily verse(s)`)
        await onImported()
        reset()
        onClose()
      } else {
        toast.error('No daily verses were imported')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error importing daily verses')
    } finally {
      setImporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Upload className="w-5 h-5 text-primary" /> Bulk Upload Daily Verses</DialogTitle>
          <p className="text-sm text-muted-foreground">Upload a CSV with columns: <strong>date</strong> (optional, YYYY-MM-DD), <strong>reference</strong>, <strong>text</strong>, <strong>active</strong> (optional).</p>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={downloadTemplate}><Download className="w-3.5 h-3.5" /> Download template</Button>
          </div>
          {!fileName ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files?.[0]) process(e.dataTransfer.files[0]) }}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${dragOver ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}
            >
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { if (e.target.files?.[0]) process(e.target.files[0]) }} />
              <FileText className="w-8 h-8 text-primary mx-auto mb-2" />
              <p className="text-sm font-semibold text-primary">Upload CSV</p>
              <p className="text-xs text-muted-foreground mt-1">Click or drag and drop</p>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-secondary/40 border flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-primary truncate">{fileName}</p>
                <p className="text-xs text-muted-foreground">{valid.length} ready{errors.length ? ` • ${errors.length} issue(s)` : ''}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={reset}><X className="w-4 h-4" /></Button>
            </div>
          )}
          {errors.length > 0 && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1 text-xs">
              <p className="font-semibold flex items-center gap-1.5"><AlertCircle className="w-4 h-4" /> Issues</p>
              <div className="max-h-24 overflow-y-auto space-y-1">{errors.map((e,i)=><p key={i}><strong>Row {e.rowNumber}:</strong> {e.message}</p>)}</div>
            </div>
          )}
          {valid.length > 0 && (
            <div className="border rounded-xl divide-y max-h-56 overflow-y-auto">
              {valid.map((r, i) => (
                <div key={i} className="p-3 text-xs space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {r.verse_date && <Badge variant="outline" className="text-[10px]">{r.verse_date}</Badge>}
                    <Badge variant="secondary" className="text-[10px]">{r.verse_ref}</Badge>
                    {r.is_active === false && <Badge className="bg-slate-200 text-slate-700 text-[10px]">Inactive</Badge>}
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <p className="text-muted-foreground line-clamp-2">{r.verse_text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={importing}>Cancel</Button>
          <Button size="sm" onClick={importRows} disabled={valid.length === 0 || importing} className="gap-1.5">
            {importing ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Importing…</> : <><Upload className="w-3.5 h-3.5" /> Import {valid.length} verse{valid.length === 1 ? '' : 's'}</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
