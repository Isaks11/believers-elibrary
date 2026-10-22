/**
 * Generic CMS manager for the five server-backed content types.
 *
 * Driven entirely by `ContentTypeMeta` (header count + New button, debounced
 * search, status chips, category facet, sort, pagination) over the
 * `listContent` API. Row actions (publish / unpublish / schedule / archive /
 * restore / delete / edit / preview) are each gated by `can(user.role, …)` —
 * delete is only offered for draft/archived rows ("Archive first").
 */

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Eye,
  Send,
  CalendarClock,
  Archive,
  ArchiveRestore,
  Trash2,
  Undo2,
} from 'lucide-react'
import { toast } from 'sonner'
import { listContent, isScheduled, setStatus, deleteContent, type ContentSort } from '@/lib/contentAdmin'
import {
  ContentTypeMeta,
  type AnyContentRecord,
  type ContentEntityType,
  type ContentStatus,
} from '@/types/content'
import { can, type PermissionAction } from '@/lib/permissions'
import { useAuth } from '@/contexts/AuthContext'
import { ContentEditorDialog } from '@/components/admin/ContentEditorDialog'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 10

const STATUS_FILTERS = ['all', 'draft', 'published', 'scheduled', 'archived'] as const
type StatusFilter = (typeof STATUS_FILTERS)[number]

const SORTS: Record<string, ContentSort> = {
  updated: { field: 'updated_at', dir: 'desc' },
  title: { field: 'title', dir: 'asc' },
  status: { field: 'status', dir: 'asc' },
}

export type ContentTypeManagerProps = {
  type: ContentEntityType
  /** Notified on every mutation so the admin shell can refresh its stats. */
  onChanged?: () => void
}

const BADGE_STYLES: Record<ContentStatus, string> = {
  draft: 'bg-amber-100 text-amber-800',
  published: 'bg-emerald-100 text-emerald-800',
  archived: 'bg-slate-200 text-slate-700',
}

function StatusBadge({ row }: { row: AnyContentRecord }) {
  if (isScheduled(row)) {
    return <Badge className="bg-sky-100 text-sky-800 text-[9px] px-1.5 py-0">Scheduled</Badge>
  }
  return (
    <Badge className={cn('text-[9px] px-1.5 py-0', BADGE_STYLES[row.status])}>{row.status}</Badge>
  )
}

function formatDate(iso: string | null | undefined): string {
  const ms = iso ? Date.parse(iso) : NaN
  return Number.isFinite(ms) ? new Date(ms).toLocaleDateString() : '—'
}

export function ContentTypeManager({ type, onChanged }: ContentTypeManagerProps) {
  const { user } = useAuth()
  const meta = ContentTypeMeta[type]

  const [q, setQ] = useState('')
  const [appliedQ, setAppliedQ] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [category, setCategory] = useState('')
  const [sortKey, setSortKey] = useState<keyof typeof SORTS>('updated')
  const [page, setPage] = useState(1)

  const [rows, setRows] = useState<AnyContentRecord[]>([])
  const [total, setTotal] = useState(0)
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<AnyContentRecord | null>(null)
  const [previewRow, setPreviewRow] = useState<AnyContentRecord | null>(null)
  const [scheduleRow, setScheduleRow] = useState<AnyContentRecord | null>(null)
  const [scheduleValue, setScheduleValue] = useState('')
  const [deleteRow, setDeleteRow] = useState<AnyContentRecord | null>(null)

  const role = user?.role
  const actor = { id: user?.id ?? null, role: role ?? 'user' }

  const guard = (action: PermissionAction, message: string): boolean => {
    if (!can(role, action)) {
      toast.error(message)
      return false
    }
    return true
  }

  // Debounced search term.
  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedQ(q.trim())
      setPage(1)
    }, 250)
    return () => clearTimeout(timer)
  }, [q])

  const fetchRows = useCallback(async () => {
    setLoading(true)
    try {
      const opts = {
        q: appliedQ || undefined,
        category: category || undefined,
        sort: SORTS[sortKey],
      }
      if (statusFilter === 'scheduled') {
        // Scheduled rows are `published` records still waiting to go live, so
        // the pseudo-filter fetches published rows and narrows locally.
        const res = await listContent(type, { ...opts, status: 'published', page: 1, pageSize: 100 })
        const scheduled = res.rows.filter((row) => isScheduled(row))
        const start = (page - 1) * PAGE_SIZE
        setRows(scheduled.slice(start, start + PAGE_SIZE))
        setTotal(scheduled.length)
        setCategories(res.categories)
      } else {
        const res = await listContent(type, {
          ...opts,
          status: statusFilter as ContentStatus | 'all',
          page,
          pageSize: PAGE_SIZE,
        })
        setRows(res.rows)
        setTotal(res.total)
        setCategories(res.categories)
      }
    } finally {
      setLoading(false)
    }
  }, [type, appliedQ, statusFilter, category, sortKey, page])

  useEffect(() => {
    void fetchRows()
  }, [fetchRows])

  const refresh = useCallback(async () => {
    await fetchRows()
    onChanged?.()
  }, [fetchRows, onChanged])

  const handleEditorChanged = useCallback(
    (changed: AnyContentRecord) => {
      // Keeps the dialog in edit mode right after the first save of a new item.
      setEditing(changed)
      void refresh()
    },
    [refresh]
  )

  // --- Row actions ---------------------------------------------------------

  const transition = (row: AnyContentRecord, target: ContentStatus, success: string, opts: { scheduledFor?: string } = {}) => {
    const res = setStatus(type, row.id, target, actor, opts)
    if (!res.ok) {
      toast.error(res.errors[0] || 'Could not change status')
      return
    }
    toast.success(success)
    void refresh()
  }

  const handlePublish = (row: AnyContentRecord) => {
    if (!guard('content:publish', 'Your role cannot publish content')) return
    transition(row, 'published', 'Published — now live')
  }

  const handleUnpublish = (row: AnyContentRecord) => {
    if (!guard('content:publish', 'Your role cannot unpublish content')) return
    transition(row, 'draft', 'Moved back to draft')
  }

  const handleArchive = (row: AnyContentRecord) => {
    if (!guard('content:archive', 'Your role cannot archive content')) return
    transition(row, 'archived', 'Archived')
  }

  const handleRestore = (row: AnyContentRecord) => {
    if (!guard('content:archive', 'Your role cannot restore content')) return
    transition(row, 'draft', 'Restored to draft')
  }

  const openSchedule = (row: AnyContentRecord) => {
    if (!guard('content:schedule', 'Your role cannot schedule content')) return
    setScheduleRow(row)
    setScheduleValue('')
  }

  const confirmSchedule = () => {
    if (!scheduleRow) return
    const ms = Date.parse(scheduleValue)
    if (!Number.isFinite(ms)) {
      toast.error('Pick a date and time first')
      return
    }
    if (ms <= Date.now()) {
      toast.error('Scheduled time must be in the future')
      return
    }
    const row = scheduleRow
    setScheduleRow(null)
    transition(row, 'published', `Scheduled for ${new Date(ms).toLocaleString()}`, {
      scheduledFor: new Date(ms).toISOString(),
    })
  }

  const confirmDelete = () => {
    if (!deleteRow) return
    const res = deleteContent(type, deleteRow.id, actor)
    setDeleteRow(null)
    if (!res.ok) {
      toast.error(res.errors[0] || 'Could not delete')
      return
    }
    toast.success('Deleted permanently')
    void refresh()
  }

  const openEdit = (row: AnyContentRecord) => {
    if (!guard('content:edit', 'Your role cannot edit content')) return
    setEditing(row)
    setEditorOpen(true)
  }

  const openNew = () => {
    if (!guard('content:create', 'Your role cannot create content')) return
    setEditing(null)
    setEditorOpen(true)
  }

  const openPreview = (row: AnyContentRecord) => {
    if (!guard('content:edit', 'Your role cannot preview content')) return
    setPreviewRow(row)
  }

  const canCreate = can(role, 'content:create')

  // Pagination window label: "x–y of z".
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(page * PAGE_SIZE, total)
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-4">
      {/* Header: count + New */}
      <div className="flex justify-between items-center gap-2">
        <h3 className="text-sm font-bold text-primary uppercase">
          {meta.label} <span className="text-muted-foreground">({total})</span>
        </h3>
        <Button
          size="sm"
          className="h-8 gap-1"
          onClick={openNew}
          disabled={!canCreate}
          title={canCreate ? undefined : 'Your role cannot create content'}
        >
          <Plus className="w-3.5 h-3.5" /> New
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Search ${meta.label.toLowerCase()}…`}
          className="pl-8 h-9 text-xs"
        />
      </div>

      {/* Status filter chips */}
      <div className="flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setStatusFilter(key)
              setPage(1)
            }}
            className={cn(
              'px-3 py-1 rounded-full text-[11px] font-semibold capitalize transition-all',
              statusFilter === key
                ? 'bg-primary text-primary-foreground shadow'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/70'
            )}
          >
            {key}
          </button>
        ))}
      </div>

      {/* Category + sort */}
      <div className="grid grid-cols-2 gap-2">
        <Select
          value={category || 'all'}
          onValueChange={(v) => {
            setCategory(v === 'all' ? '' : v)
            setPage(1)
          }}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={sortKey}
          onValueChange={(v) => {
            setSortKey(v as keyof typeof SORTS)
            setPage(1)
          }}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="updated">Recently updated</SelectItem>
            <SelectItem value="title">Title A–Z</SelectItem>
            <SelectItem value="status">Status</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Rows */}
      {loading && rows.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-6">Loading…</p>
      )}

      {!loading && rows.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-6">
          No {meta.label.toLowerCase()} match your filters.
        </p>
      )}

      <div className="space-y-2">
        {rows.map((row) => {
          const scheduled = isScheduled(row)
          const canEdit = can(role, 'content:edit')
          const canPublish = can(role, 'content:publish')
          const canSchedule = can(role, 'content:schedule')
          const canArchive = can(role, 'content:archive')
          const canDelete = can(role, 'content:delete')
          const deleteAllowed = row.status !== 'published'
          const showMenu = canEdit || canPublish || canSchedule || canArchive || canDelete

          return (
            <Card key={row.id} className="border-none shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-3 flex items-center gap-2.5">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h4 className="text-xs font-bold text-primary truncate max-w-[65%]">{row.title}</h4>
                    <StatusBadge row={row} />
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    v{row.version} • updated {formatDate(row.updated_at)}
                    {row.category ? ` • ${row.category}` : ''}
                    {scheduled && row.scheduled_for
                      ? ` • goes live ${new Date(row.scheduled_for).toLocaleString()}`
                      : ''}
                  </p>
                </div>

                {showMenu && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" aria-label="Actions">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="text-xs">
                      {canEdit && (
                        <DropdownMenuItem onClick={() => openEdit(row)}>
                          <Pencil className="w-3.5 h-3.5 mr-2" /> Edit
                        </DropdownMenuItem>
                      )}
                      {canEdit && (
                        <DropdownMenuItem onClick={() => openPreview(row)}>
                          <Eye className="w-3.5 h-3.5 mr-2" /> Preview
                        </DropdownMenuItem>
                      )}
                      {canPublish && row.status === 'draft' && (
                        <DropdownMenuItem onClick={() => handlePublish(row)}>
                          <Send className="w-3.5 h-3.5 mr-2" /> Publish
                        </DropdownMenuItem>
                      )}
                      {canPublish && row.status === 'published' && (
                        <DropdownMenuItem onClick={() => handleUnpublish(row)}>
                          <Undo2 className="w-3.5 h-3.5 mr-2" /> Unpublish
                        </DropdownMenuItem>
                      )}
                      {canSchedule && row.status === 'draft' && (
                        <DropdownMenuItem onClick={() => openSchedule(row)}>
                          <CalendarClock className="w-3.5 h-3.5 mr-2" /> Schedule
                        </DropdownMenuItem>
                      )}
                      {canArchive && row.status !== 'archived' && (
                        <DropdownMenuItem onClick={() => handleArchive(row)}>
                          <Archive className="w-3.5 h-3.5 mr-2" /> Archive
                        </DropdownMenuItem>
                      )}
                      {canArchive && row.status === 'archived' && (
                        <DropdownMenuItem onClick={() => handleRestore(row)}>
                          <ArchiveRestore className="w-3.5 h-3.5 mr-2" /> Restore to draft
                        </DropdownMenuItem>
                      )}
                      {canDelete && (
                        <DropdownMenuItem
                          disabled={!deleteAllowed}
                          title={deleteAllowed ? undefined : 'Archive first'}
                          onClick={() => {
                            if (!deleteAllowed) {
                              toast.info('Archive this item before deleting it')
                              return
                            }
                            setDeleteRow(row)
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-2" />
                          {deleteAllowed ? 'Delete' : 'Delete (archive first)'}
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Pagination: "x–y of z" + prev/next */}
      <div className="flex items-center justify-between pt-1">
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {rangeStart}–{rangeEnd} of {total}
        </span>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            className="h-7 w-7 p-0"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            aria-label="Previous page"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </Button>
          <span className="text-[11px] text-muted-foreground tabular-nums px-1">
            {page} / {pageCount}
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 w-7 p-0"
            disabled={page >= pageCount}
            onClick={() => setPage((p) => p + 1)}
            aria-label="Next page"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Editor */}
      <ContentEditorDialog
        type={type}
        open={editorOpen}
        record={editing}
        onClose={() => {
          setEditorOpen(false)
          setEditing(null)
        }}
        onChanged={handleEditorChanged}
      />

      {/* Row preview */}
      <Dialog open={!!previewRow} onOpenChange={(v) => { if (!v) setPreviewRow(null) }}>
        <DialogContent className="max-w-sm rounded-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif">{previewRow?.title}</DialogTitle>
          </DialogHeader>
          {previewRow && (
            <div className="space-y-3 mt-1 text-sm">
              <div className="flex items-center gap-1.5">
                <StatusBadge row={previewRow} />
                <Badge variant="outline" className="text-[10px] font-mono">v{previewRow.version}</Badge>
              </div>
              {(previewRow as unknown as Record<string, unknown>).body ||
              (previewRow as unknown as Record<string, unknown>).lyrics ||
              (previewRow as unknown as Record<string, unknown>).description ? (
                <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                  {String(
                    (previewRow as unknown as Record<string, unknown>).body ||
                      (previewRow as unknown as Record<string, unknown>).lyrics ||
                      (previewRow as unknown as Record<string, unknown>).description
                  )}
                </p>
              ) : null}
              <div className="border-t border-border/50 pt-2 space-y-1 text-[11px]">
                <p className="flex justify-between gap-3">
                  <span className="text-muted-foreground uppercase font-semibold">Slug</span>
                  <span className="break-all">{previewRow.slug}</span>
                </p>
                <p className="flex justify-between gap-3">
                  <span className="text-muted-foreground uppercase font-semibold">Updated</span>
                  <span>{formatDate(previewRow.updated_at)}</span>
                </p>
                {previewRow.author && (
                  <p className="flex justify-between gap-3">
                    <span className="text-muted-foreground uppercase font-semibold">Author</span>
                    <span>{previewRow.author}</span>
                  </p>
                )}
                {previewRow.license_attribution && (
                  <p className="flex justify-between gap-3">
                    <span className="text-muted-foreground uppercase font-semibold">Licence</span>
                    <span className="break-all">{previewRow.license_attribution}</span>
                  </p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Schedule dialog */}
      <Dialog open={!!scheduleRow} onOpenChange={(v) => { if (!v) setScheduleRow(null) }}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif">Schedule “{scheduleRow?.title}”</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-1">
            <p className="text-xs text-muted-foreground">
              The item stays in the Scheduled state until the chosen time, then goes live
              automatically (past times are rejected).
            </p>
            <Input
              type="datetime-local"
              value={scheduleValue}
              onChange={(e) => setScheduleValue(e.target.value)}
              className="h-9 text-xs"
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setScheduleRow(null)}>
                Cancel
              </Button>
              <Button className="flex-1 gap-1.5" onClick={confirmSchedule}>
                <CalendarClock className="w-4 h-4" /> Schedule
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteRow} onOpenChange={(v) => { if (!v) setDeleteRow(null) }}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif">Delete permanently?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-1">
            <p className="text-xs text-muted-foreground">
              “{deleteRow?.title}” and its revision history will be removed from this device and,
              best-effort, from the server. Published content must be archived first.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteRow(null)}>
                Cancel
              </Button>
              <Button variant="destructive" className="flex-1 gap-1.5" onClick={confirmDelete}>
                <Trash2 className="w-4 h-4" /> Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
