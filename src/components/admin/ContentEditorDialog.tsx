/**
 * Create / edit dialog for every CMS content type.
 *
 * Fields are driven by `ContentTypeMeta[type].requires` plus the optional
 * columns of each record (see src/types/content.ts). The publication panel
 * covers the shared workflow surface: status select, future-only schedule
 * input, offline policy, licence/attribution and tags.
 *
 * Every mutating button is gated through `can(user.role, …)` from
 * `src/lib/permissions.ts` — the frontend matrix only mirrors what RLS
 * enforces server-side, it never replaces it.
 */

import { useCallback, useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Eye, Send, CalendarClock, History, Plus, Trash2, Save, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import {
  createContent,
  updateContent,
  setStatus,
  validateContent,
} from '@/lib/contentAdmin'
import {
  ContentTypeMeta,
  type AnyContentRecord,
  type ContentEntityType,
  type ContentStatus,
  type ContentDraft,
  type ContentRecordMap,
  type OfflinePolicy,
  type PlanStep,
} from '@/types/content'
import { can } from '@/lib/permissions'
import { useAuth } from '@/contexts/AuthContext'
import { RevisionHistoryDialog } from '@/components/admin/RevisionHistoryDialog'
import { BibleReferencePicker } from '@/components/admin/BibleReferencePicker'
import { cn } from '@/lib/utils'

export type ContentEditorDialogProps = {
  type: ContentEntityType
  open: boolean
  /** null → create mode; otherwise the record being edited. */
  record: AnyContentRecord | null
  onClose: () => void
  /** Fired after any content/status change so the list can refresh. */
  onChanged?: (record: AnyContentRecord) => void
}

/** Flat form shared by every type — only the relevant fields are rendered. */
type FormState = {
  title: string
  body: string
  verse_text: string
  verse_ref: string
  translation: string
  devotional_date: string
  description: string
  days: string
  structure: PlanStep[]
  number: string
  lyrics: string
  audio_url: string
  public_domain: boolean
  meter: string
  composer: string
  video_url: string
  thumbnail_url: string
  speaker: string
  duration_seconds: string
  resource_url: string
  resource_type: string
  scripture_ref: string
  curated_by: string
  author: string
  category: string
  tags: string
  license_attribution: string
  offline_policy: OfflinePolicy
}

const RESOURCE_TYPES = ['study_guide', 'commentary', 'dictionary', 'article', 'podcast', 'other']

function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  if (value === null || value === undefined) return fallback
  return String(value)
}

function asNumberString(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : ''
}

function emptyForm(): FormState {
  return {
    title: '',
    body: '',
    verse_text: '',
    verse_ref: '',
    translation: '',
    devotional_date: '',
    description: '',
    days: '7',
    structure: [],
    number: '',
    lyrics: '',
    audio_url: '',
    public_domain: true,
    meter: '',
    composer: '',
    video_url: '',
    thumbnail_url: '',
    speaker: '',
    duration_seconds: '',
    resource_url: '',
    resource_type: '',
    scripture_ref: '',
    curated_by: '',
    author: '',
    category: '',
    tags: '',
    license_attribution: '',
    offline_policy: 'optional',
  }
}

function formFromRecord(record: AnyContentRecord | null): FormState {
  if (!record) return emptyForm()
  const row = record as unknown as Record<string, unknown>
  return {
    title: asString(row.title),
    body: asString(row.body),
    verse_text: asString(row.verse_text),
    verse_ref: asString(row.verse_ref),
    translation: asString(row.translation),
    devotional_date: asString(row.devotional_date),
    description: asString(row.description),
    days: asNumberString(row.days) || '7',
    structure: Array.isArray(row.structure) ? (row.structure as PlanStep[]) : [],
    number: asNumberString(row.number),
    lyrics: asString(row.lyrics),
    audio_url: asString(row.audio_url),
    public_domain: row.public_domain !== false,
    meter: asString(row.meter),
    composer: asString(row.composer),
    video_url: asString(row.video_url),
    thumbnail_url: asString(row.thumbnail_url),
    speaker: asString(row.speaker),
    duration_seconds: asNumberString(row.duration_seconds),
    resource_url: asString(row.resource_url),
    resource_type: asString(row.resource_type),
    scripture_ref: asString(row.scripture_ref),
    curated_by: asString(row.curated_by),
    author: asString(row.author),
    category: asString(row.category),
    tags: Array.isArray(row.tags) ? row.tags.map(String).join(', ') : '',
    license_attribution: asString(row.license_attribution),
    offline_policy: (row.offline_policy as OfflinePolicy) || 'optional',
  }
}

/** Assembles the ContentDraft payload for the active type. */
function buildDraft(type: ContentEntityType, form: FormState): Record<string, unknown> {
  const trimmedCategory = form.category.trim()
  const base = {
    author: form.author.trim() || null,
    category: trimmedCategory || null,
    tags: form.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
    license_attribution: form.license_attribution.trim() || null,
    offline_policy: form.offline_policy,
  }

  switch (type) {
    case 'devotional':
      return {
        ...base,
        title: form.title.trim(),
        body: form.body,
        verse_text: form.verse_text.trim() || null,
        verse_ref: form.verse_ref.trim(),
        translation: form.translation.trim() || null,
        devotional_date: form.devotional_date || null,
      }
    case 'reading_plan':
      return {
        ...base,
        title: form.title.trim(),
        description: form.description.trim() || null,
        days: Number(form.days),
        structure: form.structure,
      }
    case 'hymn':
      return {
        ...base,
        title: form.title.trim(),
        lyrics: form.lyrics,
        number: form.number.trim() ? Number(form.number) : null,
        audio_url: form.audio_url.trim() || null,
        public_domain: form.public_domain,
        meter: form.meter.trim() || null,
        composer: form.composer.trim() || null,
        hymn_category: trimmedCategory || null,
      }
    case 'video':
      return {
        ...base,
        title: form.title.trim(),
        description: form.description.trim() || null,
        video_url: form.video_url.trim(),
        thumbnail_url: form.thumbnail_url.trim() || null,
        speaker: form.speaker.trim() || null,
        duration_seconds: form.duration_seconds.trim() ? Number(form.duration_seconds) : null,
        video_category: trimmedCategory || null,
      }
    case 'faith_resource':
      return {
        ...base,
        title: form.title.trim(),
        description: form.description.trim() || null,
        resource_url: form.resource_url.trim(),
        resource_type: form.resource_type.trim() || null,
        scripture_ref: form.scripture_ref.trim() || null,
        curated_by: form.curated_by.trim() || null,
      }
    default:
      return { ...base, title: form.title.trim() }
  }
}

/** Local `datetime-local` minimum: "now" in the browser's timezone. */
function nowLocalInputValue(): string {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 16)
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-semibold text-muted-foreground uppercase block mb-1">{children}</span>
}

export function ContentEditorDialog({
  type,
  open,
  record,
  onClose,
  onChanged,
}: ContentEditorDialogProps) {
  const { user } = useAuth()
  const meta = ContentTypeMeta[type]

  const [form, setForm] = useState<FormState>(() => formFromRecord(record))
  const [errors, setErrors] = useState<string[]>([])
  const [scheduleDateTime, setScheduleDateTime] = useState('')
  const [savedVersion, setSavedVersion] = useState<number | null>(record?.version ?? null)
  const [currentStatus, setCurrentStatus] = useState<ContentStatus>(record?.status ?? 'draft')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [revisionsOpen, setRevisionsOpen] = useState(false)

  // Re-initialise only when the dialog opens or a different record is loaded —
  // list refreshes must not clobber what the author is typing.
  const recordId = record?.id ?? null
  const [lastInitKey, setLastInitKey] = useState<string | null>(null)
  useEffect(() => {
    if (!open) return
    const key = `${recordId ?? 'new'}`
    if (lastInitKey === key) return
    setLastInitKey(key)
    setForm(formFromRecord(record))
    setErrors([])
    setScheduleDateTime('')
    setSavedVersion(record?.version ?? null)
    setCurrentStatus(record?.status ?? 'draft')
  }, [open, record, recordId, lastInitKey])

  const role = user?.role
  const canCreate = can(role, 'content:create')
  const canEdit = can(role, 'content:edit')
  const canPublish = can(role, 'content:publish')
  const canSchedule = can(role, 'content:schedule')

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const actor = { id: user?.id ?? null, role: role ?? 'user' }

  const saveContent = useCallback((): AnyContentRecord | null => {
    const draft = buildDraft(type, form) as ContentDraft<ContentRecordMap[ContentEntityType]>
    // Early, field-level feedback (create/update run the same validation).
    const preErrors = validateContent(type, draft)
    if (preErrors.length > 0) {
      setErrors(preErrors)
      return null
    }
    if (record) {
      const res = updateContent(type, record.id, draft, actor)
      if (!res.ok) {
        setErrors(res.errors)
        return null
      }
      setErrors([])
      setSavedVersion(res.record?.version ?? savedVersion)
      if (res.record) onChanged?.(res.record)
      toast.success(`Saved — now v${res.record?.version}`)
      return res.record ?? null
    }
    const res = createContent(type, draft, actor)
    if (!res.ok) {
      setErrors(res.errors)
      return null
    }
    setErrors([])
    setSavedVersion(res.record?.version ?? 1)
    setCurrentStatus('draft')
    if (res.record) onChanged?.(res.record)
    toast.success('Draft created')
    return res.record ?? null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, form, record, savedVersion, onChanged, actor.role, actor.id])

  /** Resolves the id to mutate: the existing record, or the just-created one. */
  const resolveId = (fresh: AnyContentRecord | null): string | null =>
    record?.id ?? fresh?.id ?? null

  const applyStatus = (
    target: ContentStatus,
    opts: { scheduledFor?: string } = {}
  ): boolean => {
    const fresh = saveContent()
    const id = resolveId(fresh)
    if (!id) return false
    const res = setStatus(type, id, target, actor, opts)
    if (!res.ok) {
      setErrors(res.errors)
      toast.error(res.errors[0] || 'Could not change status')
      return false
    }
    setErrors([])
    setCurrentStatus(target)
    if (fresh) onChanged?.(fresh)
    else if (record) onChanged?.({ ...record, status: target } as AnyContentRecord)
    return true
  }

  const handleSaveDraft = () => {
    if (record ? !canEdit : !canCreate) {
      toast.error(record ? 'Your role cannot edit content' : 'Your role cannot create content')
      return
    }
    saveContent()
  }

  const handlePublish = () => {
    if (record && currentStatus === 'published') {
      // Already live: the button becomes a plain content update.
      if (!canEdit) {
        toast.error('Your role cannot edit content')
        return
      }
      saveContent()
      return
    }
    if (!canPublish) {
      toast.error('Your role cannot publish content')
      return
    }
    if (applyStatus('published')) toast.success('Published — now live')
  }

  const handleSchedule = () => {
    if (!canSchedule) {
      toast.error('Your role cannot schedule content')
      return
    }
    if (!scheduleDateTime) {
      toast.error('Pick a future date and time first')
      return
    }
    const ms = Date.parse(scheduleDateTime)
    if (!Number.isFinite(ms)) {
      toast.error('Scheduled time must be a valid date')
      return
    }
    if (ms <= Date.now()) {
      toast.error('Scheduled time must be in the future')
      return
    }
    if (applyStatus('published', { scheduledFor: new Date(ms).toISOString() })) {
      toast.success(`Scheduled for ${new Date(ms).toLocaleString()}`)
      setScheduleDateTime('')
    }
  }

  const handleStatusSelect = (value: string) => {
    if (!record) return
    const target = value as ContentStatus
    const allowed =
      target === 'published'
        ? canPublish
        : target === 'archived'
          ? can(role, 'content:archive')
          : currentStatus === 'archived'
            ? can(role, 'content:archive') // archived → draft restore
            : canPublish // published → draft unpublish
    if (!allowed) {
      toast.error('Your role cannot change publication status')
      return
    }
    const label =
      target === 'published' ? 'Published' : target === 'archived' ? 'Archived' : 'Moved to draft'
    if (applyStatus(target)) toast.success(label)
  }

  const addStep = () => {
    setForm((prev) => ({
      ...prev,
      structure: [
        ...prev.structure,
        { day: prev.structure.length + 1, title: '', scripture_ref: '', reflection: '' },
      ],
    }))
  }

  const updateStep = (index: number, patch: Partial<PlanStep>) => {
    setForm((prev) => ({
      ...prev,
      structure: prev.structure.map((step, i) => (i === index ? { ...step, ...patch } : step)),
    }))
  }

  const removeStep = (index: number) => {
    setForm((prev) => ({ ...prev, structure: prev.structure.filter((_, i) => i !== index) }))
  }

  const metaRequires = meta.requires.join(', ')
  const statusSelectValue = currentStatus

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
        <DialogContent className="max-w-sm rounded-2xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif flex items-center justify-between gap-2">
              <span>
                {record ? `Edit ${meta.singularLabel}` : `New ${meta.singularLabel}`}
              </span>
              <span className="flex items-center gap-1.5">
                <Badge variant="outline" className="text-[10px] font-mono">
                  {savedVersion ? `v${savedVersion}` : 'v1 (new)'}
                </Badge>
                {record && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[10px] gap-1"
                    onClick={() => setRevisionsOpen(true)}
                  >
                    <History className="w-3 h-3" /> Revisions
                  </Button>
                )}
              </span>
            </DialogTitle>
          </DialogHeader>

          <p className="text-[10px] text-muted-foreground -mt-1">
            Required for {meta.singularLabel}: <strong>{metaRequires}</strong>
          </p>

          {errors.length > 0 && (
            <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 space-y-1">
              <p className="text-[10px] font-bold text-red-700 uppercase flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Could not save
              </p>
              {errors.map((err) => (
                <p key={err} className="text-[11px] text-red-700">{err}</p>
              ))}
            </div>
          )}

          <div className="space-y-3 mt-1">
            {/* --- Type-specific fields ------------------------------------ */}
            <div>
              <FieldLabel>Title *</FieldLabel>
              <Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Title" />
            </div>

            {type === 'devotional' && (
              <>
                <div>
                  <FieldLabel>Body *</FieldLabel>
                  <Textarea
                    value={form.body}
                    onChange={(e) => set('body', e.target.value)}
                    placeholder="Devotional text…"
                    className="min-h-[110px]"
                  />
                </div>
                {/* Structured Bible Reference Selection */}
                <div>
                  <FieldLabel>Bible Scripture Reference *</FieldLabel>
                  <BibleReferencePicker
                    value={form.verse_ref}
                    onChange={(ref) => set('verse_ref', ref)}
                    onVerseTextFetched={(text) => set('verse_text', text)}
                  />
                </div>

                <div>
                  <FieldLabel>Scripture Quotation (Verse Text)</FieldLabel>
                  <Textarea
                    value={form.verse_text}
                    onChange={(e) => set('verse_text', e.target.value)}
                    placeholder="“For God so loved the world…” (populates automatically from Bible or type manually)"
                    className="min-h-[54px]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <FieldLabel>Primary Translation</FieldLabel>
                    <Select
                      value={form.translation || 'KJV'}
                      onValueChange={(val) => set('translation', val)}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Select translation" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="KJV">KJV (King James Version)</SelectItem>
                        <SelectItem value="WEB">WEB (World English Bible)</SelectItem>
                        <SelectItem value="ASV">ASV (American Standard Version)</SelectItem>
                        <SelectItem value="BBE">BBE (Bible in Basic English)</SelectItem>
                        <SelectItem value="ESV">ESV (English Standard Version)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <FieldLabel>Devotional Date *</FieldLabel>
                    <Input
                      type="date"
                      value={form.devotional_date}
                      onChange={(e) => set('devotional_date', e.target.value)}
                      className="h-9 text-xs"
                    />
                    <span className="text-[10px] text-muted-foreground">The date this devotional will display for users.</span>
                  </div>
                </div>
              </>
            )}

            {type === 'reading_plan' && (
              <>
                <div>
                  <FieldLabel>Description</FieldLabel>
                  <Textarea
                    value={form.description}
                    onChange={(e) => set('description', e.target.value)}
                    placeholder="What is this plan about?"
                    className="min-h-[60px]"
                  />
                </div>
                <div>
                  <FieldLabel>Days *</FieldLabel>
                  <Input
                    type="number"
                    min={1}
                    value={form.days}
                    onChange={(e) => set('days', e.target.value)}
                    placeholder="7"
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Structured Steps</FieldLabel>
                  {form.structure.map((step, index) => (
                    <div key={index} className="p-2 rounded-lg bg-secondary/40 border border-border/50 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-primary uppercase w-16">Day</span>
                        <Input
                          type="number"
                          min={1}
                          value={String(step.day)}
                          onChange={(e) => updateStep(index, { day: Number(e.target.value) })}
                          className="h-7 text-xs"
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-red-500 ml-auto"
                          onClick={() => removeStep(index)}
                          title="Remove step"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      <Input
                        value={step.scripture_ref}
                        onChange={(e) => updateStep(index, { scripture_ref: e.target.value })}
                        placeholder="Reference (e.g. Genesis 1:1–2:3)"
                        className="h-7 text-xs"
                      />
                      <Textarea
                        value={step.reflection ?? ''}
                        onChange={(e) => updateStep(index, { reflection: e.target.value })}
                        placeholder="Note / reflection for the day"
                        className="min-h-[38px] text-xs"
                      />
                    </div>
                  ))}
                  <Button size="sm" variant="outline" className="h-8 text-xs gap-1 w-full" onClick={addStep}>
                    <Plus className="w-3.5 h-3.5" /> Add Day
                  </Button>
                </div>
              </>
            )}

            {type === 'hymn' && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <FieldLabel>Hymn Number</FieldLabel>
                    <Input
                      type="number"
                      value={form.number}
                      onChange={(e) => set('number', e.target.value)}
                      placeholder="12"
                    />
                  </div>
                  <div>
                    <FieldLabel>Meter</FieldLabel>
                    <Input value={form.meter} onChange={(e) => set('meter', e.target.value)} placeholder="C.M." />
                  </div>
                </div>
                <div>
                  <FieldLabel>Lyrics *</FieldLabel>
                  <Textarea
                    value={form.lyrics}
                    onChange={(e) => set('lyrics', e.target.value)}
                    placeholder="Verse 1…"
                    className="min-h-[130px]"
                  />
                </div>
                <div>
                  <FieldLabel>Audio URL</FieldLabel>
                  <Input
                    value={form.audio_url}
                    onChange={(e) => set('audio_url', e.target.value)}
                    placeholder="https://…"
                  />
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-secondary/40 border border-border/50">
                  <span className="text-xs font-semibold">Public domain</span>
                  <Switch
                    checked={form.public_domain}
                    onCheckedChange={(v) => set('public_domain', v)}
                    aria-label="Public domain"
                  />
                </div>
                <div>
                  <FieldLabel>Composer</FieldLabel>
                  <Input value={form.composer} onChange={(e) => set('composer', e.target.value)} placeholder="Name" />
                </div>
              </>
            )}

            {type === 'video' && (
              <>
                <div>
                  <FieldLabel>Description</FieldLabel>
                  <Textarea
                    value={form.description}
                    onChange={(e) => set('description', e.target.value)}
                    placeholder="Short description"
                    className="min-h-[60px]"
                  />
                </div>
                <div>
                  <FieldLabel>Video URL *</FieldLabel>
                  <Input
                    value={form.video_url}
                    onChange={(e) => set('video_url', e.target.value)}
                    placeholder="https://…"
                  />
                </div>
                <div>
                  <FieldLabel>Thumbnail URL</FieldLabel>
                  <Input
                    value={form.thumbnail_url}
                    onChange={(e) => set('thumbnail_url', e.target.value)}
                    placeholder="https://…"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <FieldLabel>Speaker</FieldLabel>
                    <Input value={form.speaker} onChange={(e) => set('speaker', e.target.value)} placeholder="Name" />
                  </div>
                  <div>
                    <FieldLabel>Duration (sec)</FieldLabel>
                    <Input
                      type="number"
                      min={0}
                      value={form.duration_seconds}
                      onChange={(e) => set('duration_seconds', e.target.value)}
                      placeholder="300"
                    />
                  </div>
                </div>
              </>
            )}

            {type === 'faith_resource' && (
              <>
                <div>
                  <FieldLabel>Description</FieldLabel>
                  <Textarea
                    value={form.description}
                    onChange={(e) => set('description', e.target.value)}
                    placeholder="Short description"
                    className="min-h-[60px]"
                  />
                </div>
                <div>
                  <FieldLabel>Resource URL *</FieldLabel>
                  <Input
                    value={form.resource_url}
                    onChange={(e) => set('resource_url', e.target.value)}
                    placeholder="https://…"
                  />
                </div>
                <div>
                  <FieldLabel>Resource Type</FieldLabel>
                  <Select value={form.resource_type} onValueChange={(v) => set('resource_type', v)}>
                    <SelectTrigger><SelectValue placeholder="Select a type" /></SelectTrigger>
                    <SelectContent>
                      {RESOURCE_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <FieldLabel>Scripture Ref</FieldLabel>
                    <Input
                      value={form.scripture_ref}
                      onChange={(e) => set('scripture_ref', e.target.value)}
                      placeholder="Romans 8"
                    />
                  </div>
                  <div>
                    <FieldLabel>Curated By</FieldLabel>
                    <Input
                      value={form.curated_by}
                      onChange={(e) => set('curated_by', e.target.value)}
                      placeholder="Name"
                    />
                  </div>
                </div>
              </>
            )}

            {/* --- Shared metadata ----------------------------------------- */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <FieldLabel>Author</FieldLabel>
                <Input value={form.author} onChange={(e) => set('author', e.target.value)} placeholder="Author" />
              </div>
              <div>
                <FieldLabel>Category</FieldLabel>
                <Input
                  value={form.category}
                  onChange={(e) => set('category', e.target.value)}
                  placeholder="e.g. Faith"
                />
              </div>
            </div>

            {/* --- Publication panel --------------------------------------- */}
            <div className="p-3 rounded-xl bg-secondary/30 border border-border/50 space-y-3">
              <p className="text-[10px] font-bold text-primary uppercase">Publication</p>

              <div>
                <FieldLabel>Status</FieldLabel>
                <Select
                  value={statusSelectValue}
                  onValueChange={handleStatusSelect}
                  disabled={!record}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
                {!record && (
                  <span className="text-[10px] text-muted-foreground">
                    Available once the draft is saved.
                  </span>
                )}
              </div>

              <div>
                <FieldLabel>Schedule (future only)</FieldLabel>
                <Input
                  type="datetime-local"
                  min={nowLocalInputValue()}
                  value={scheduleDateTime}
                  onChange={(e) => setScheduleDateTime(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div>
                <FieldLabel>Offline Policy</FieldLabel>
                <Select
                  value={form.offline_policy}
                  onValueChange={(v) => set('offline_policy', v as OfflinePolicy)}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="online_only">Online only</SelectItem>
                    <SelectItem value="optional">Optional (cache when possible)</SelectItem>
                    <SelectItem value="essential">Essential (keep available offline)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <FieldLabel>Licence / Attribution</FieldLabel>
                <Input
                  value={form.license_attribution}
                  onChange={(e) => set('license_attribution', e.target.value)}
                  placeholder="© author / public domain / source"
                />
              </div>

              <div>
                <FieldLabel>Tags (comma separated)</FieldLabel>
                <Input
                  value={form.tags}
                  onChange={(e) => set('tags', e.target.value)}
                  placeholder="prayer, grace, youth"
                />
              </div>
            </div>

            {/* --- Actions -------------------------------------------------- */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button
                variant="outline"
                className="h-9 text-xs gap-1.5"
                onClick={handleSaveDraft}
                disabled={record ? !canEdit : !canCreate}
                title={record ? (canEdit ? undefined : 'Your role cannot edit content') : canCreate ? undefined : 'Your role cannot create content'}
              >
                <Save className="w-3.5 h-3.5" /> {record ? 'Save Changes' : 'Save Draft'}
              </Button>
              <Button variant="outline" className="h-9 text-xs gap-1.5" onClick={() => setPreviewOpen(true)}>
                <Eye className="w-3.5 h-3.5" /> Preview
              </Button>
              <Button
                className="h-9 text-xs gap-1.5"
                onClick={handlePublish}
                disabled={record ? (currentStatus === 'published' ? !canEdit : !canPublish) : !canPublish}
                title={
                  record && currentStatus === 'published'
                    ? canEdit
                      ? undefined
                      : 'Your role cannot edit content'
                    : canPublish
                      ? undefined
                      : 'Your role cannot publish content'
                }
              >
                <Send className="w-3.5 h-3.5" />
                {record && currentStatus === 'published' ? 'Update' : 'Publish'}
              </Button>
              <Button
                variant="secondary"
                className="h-9 text-xs gap-1.5"
                onClick={handleSchedule}
                disabled={!canSchedule || !scheduleDateTime}
                title={
                  !canSchedule
                    ? 'Your role cannot schedule content'
                    : !scheduleDateTime
                      ? 'Pick a future date and time first'
                      : undefined
                }
              >
                <CalendarClock className="w-3.5 h-3.5" /> Schedule
              </Button>
            </div>

            {!canPublish && (
              <p className="text-[10px] text-muted-foreground text-center">
                Your role can draft and edit, but publishing is limited to Editor and above
                (server RLS enforces the same rule).
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Read-only preview of the record as currently filled in */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-sm rounded-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif">{form.title || `New ${meta.singularLabel}`}</DialogTitle>
          </DialogHeader>
          <PreviewBody type={type} form={form} status={currentStatus} />
        </DialogContent>
      </Dialog>

      {record && (
        <RevisionHistoryDialog
          type={type}
          record={record}
          open={revisionsOpen}
          onOpenChange={setRevisionsOpen}
          onRestored={(restored) => {
            setForm(formFromRecord(restored))
            setSavedVersion(restored.version)
            setErrors([])
            onChanged?.(restored)
          }}
        />
      )}
    </>
  )
}

/** Read-only rendering used by the Preview button. */
function PreviewBody({ type, form, status }: { type: ContentEntityType; form: FormState; status: ContentStatus }) {
  const rows: Array<[string, string]> = []
  if (type === 'devotional') {
    rows.push(['Verse', `${form.verse_ref || '—'}${form.translation ? ` (${form.translation})` : ''}`])
    if (form.devotional_date) rows.push(['Date', form.devotional_date])
  }
  if (type === 'hymn') {
    if (form.number) rows.push(['Number', form.number])
    rows.push(['Public domain', form.public_domain ? 'Yes' : 'No'])
    if (form.meter) rows.push(['Meter', form.meter])
    if (form.composer) rows.push(['Composer', form.composer])
  }
  if (type === 'video') {
    rows.push(['Video URL', form.video_url || '—'])
    if (form.speaker) rows.push(['Speaker', form.speaker])
    if (form.duration_seconds) rows.push(['Duration', `${form.duration_seconds}s`])
  }
  if (type === 'faith_resource') {
    rows.push(['Resource URL', form.resource_url || '—'])
    if (form.resource_type) rows.push(['Type', form.resource_type.replace(/_/g, ' ')])
    if (form.scripture_ref) rows.push(['Scripture', form.scripture_ref])
  }
  if (type === 'reading_plan') {
    rows.push(['Days', form.days])
    rows.push(['Steps', String(form.structure.length)])
  }
  if (form.author) rows.push(['Author', form.author])
  if (form.category) rows.push(['Category', form.category])
  if (form.tags) rows.push(['Tags', form.tags])
  if (form.license_attribution) rows.push(['Licence', form.license_attribution])
  rows.push(['Offline policy', form.offline_policy.replace(/_/g, ' ')])

  return (
    <div className="space-y-3 mt-1 text-sm">
      <Badge className="text-[10px] uppercase">{status}</Badge>
      {form.verse_text && (
        <p className="italic text-primary border-l-2 border-primary/30 pl-3">“{form.verse_text}”</p>
      )}
      {form.body && <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{form.body}</p>}
      {form.lyrics && <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{form.lyrics}</p>}
      {form.description && <p className="text-muted-foreground leading-relaxed">{form.description}</p>}
      {type === 'reading_plan' && form.structure.length > 0 && (
        <ol className="space-y-1.5">
          {form.structure.map((step, i) => (
            <li key={i} className="text-xs p-2 rounded-lg bg-secondary/40">
              <span className="font-bold text-primary">Day {step.day}</span>
              {step.scripture_ref && <span className="text-muted-foreground"> — {step.scripture_ref}</span>}
              {step.reflection && <p className="text-muted-foreground mt-0.5">{step.reflection}</p>}
            </li>
          ))}
        </ol>
      )}
      <div className="border-t border-border/50 pt-2 space-y-1">
        {rows.map(([label, value]) => (
          <p key={label} className="text-[11px] flex justify-between gap-3">
            <span className="text-muted-foreground uppercase font-semibold">{label}</span>
            <span className="text-right break-all">{value}</span>
          </p>
        ))}
      </div>
    </div>
  )
}
