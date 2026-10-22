/**
 * Revision history dialog for a single CMS record.
 *
 * Lists the snapshots captured by `updateContent` / `restoreRevision`
 * (`listRevisions`, newest first) and offers a two-step "Restore" action
 * (confirm → `restoreRevision`, which is itself audited and snapshotted so the
 * history stays contiguous).
 */

import { useCallback, useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { History, RotateCcw, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { listRevisions, restoreRevision } from '@/lib/contentAdmin'
import { type AnyContentRecord, type ContentEntityType, type ContentRevision } from '@/types/content'
import { can } from '@/lib/permissions'
import { useAuth } from '@/contexts/AuthContext'
import { relativeTime } from '@/components/admin/formatTime'
import { cn } from '@/lib/utils'

export type RevisionHistoryDialogProps = {
  type: ContentEntityType
  record: AnyContentRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called after a successful restore so the editor can reload the record. */
  onRestored?: (record: AnyContentRecord) => void
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-amber-100 text-amber-800',
  published: 'bg-emerald-100 text-emerald-800',
  archived: 'bg-slate-200 text-slate-700',
}

export function RevisionHistoryDialog({
  type,
  record,
  open,
  onOpenChange,
  onRestored,
}: RevisionHistoryDialogProps) {
  const { user } = useAuth()
  const [revisions, setRevisions] = useState<ContentRevision[]>([])
  const [loading, setLoading] = useState(false)
  const [confirmVersion, setConfirmVersion] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!record) return
    setLoading(true)
    try {
      setRevisions(await listRevisions(type, record.id))
    } finally {
      setLoading(false)
    }
  }, [type, record])

  useEffect(() => {
    if (!open) return
    setConfirmVersion(null)
    void load()
  }, [open, load])

  const handleRestore = async (version: number) => {
    if (!record) return
    if (!can(user?.role, 'content:edit')) {
      toast.error('Your role cannot restore revisions')
      return
    }
    setBusy(true)
    try {
      const res = restoreRevision(type, record.id, version, {
        id: user?.id ?? null,
        role: user?.role ?? 'user',
      })
      if (!res.ok) {
        toast.error(res.errors[0] || 'Could not restore this revision')
        return
      }
      toast.success(`Version ${version} restored as v${res.record?.version}`)
      setConfirmVersion(null)
      await load()
      if (res.record) onRestored?.(res.record)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif flex items-center gap-2">
            <History className="w-4 h-4" /> Revisions {record ? `(v${record.version})` : ''}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2 mt-1">
          {loading && (
            <p className="text-xs text-muted-foreground text-center py-4">Loading revision history…</p>
          )}

          {!loading && revisions.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              No revisions recorded yet — every saved edit will appear here.
            </p>
          )}

          {!loading &&
            revisions.map((rev) => {
              const snapshotStatus = (rev.snapshot as AnyContentRecord | undefined)?.status
              const isCurrent = record ? rev.version === record.version : false
              const confirming = confirmVersion === rev.version
              return (
                <div
                  key={rev.version}
                  className={cn(
                    'p-2.5 rounded-xl border border-border/50 bg-secondary/30 space-y-2',
                    confirming && 'border-primary/40 bg-primary/5'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-primary">v{rev.version}</span>
                      {snapshotStatus && (
                        <Badge className={cn('text-[9px] px-1.5 py-0', STATUS_STYLES[snapshotStatus])}>
                          {snapshotStatus}
                        </Badge>
                      )}
                      {isCurrent && (
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0">current</Badge>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {relativeTime(rev.created_at)}
                    </span>
                  </div>

                  <p className="text-[10px] text-muted-foreground">
                    Edited by{' '}
                    <span className="font-semibold text-foreground/70">
                      {rev.edited_by ? rev.edited_by.slice(0, 12) : 'unknown'}
                    </span>
                    {' • '}{new Date(rev.created_at).toLocaleString()}
                  </p>

                  {confirming ? (
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] text-muted-foreground">
                        Restore v{rev.version}? The current content is snapshotted first.
                      </p>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-[10px]"
                          onClick={() => setConfirmVersion(null)}
                        >
                          <X className="w-3 h-3 mr-1" /> Cancel
                        </Button>
                        <Button
                          size="sm"
                          className="h-6 px-2 text-[10px]"
                          disabled={busy}
                          onClick={() => handleRestore(rev.version)}
                        >
                          <Check className="w-3 h-3 mr-1" /> Confirm
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-[10px] w-full"
                      disabled={isCurrent || !can(user?.role, 'content:edit')}
                      title={
                        isCurrent
                          ? 'This is already the current version'
                          : !can(user?.role, 'content:edit')
                            ? 'Your role cannot restore revisions'
                            : undefined
                      }
                      onClick={() => setConfirmVersion(rev.version)}
                    >
                      <RotateCcw className="w-3 h-3 mr-1" /> Restore this version
                    </Button>
                  )}
                </div>
              )
            })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
