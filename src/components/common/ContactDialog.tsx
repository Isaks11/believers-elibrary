import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Mail, Phone, MapPin, Globe, Clock, Copy, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'
import {
  getCachedContactSettings,
  loadContactSettings,
  type ContactSettings,
} from '@/lib/contactSettings'

export function ContactDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [settings, setSettings] = useState<ContactSettings>(() => getCachedContactSettings())

  useEffect(() => {
    if (!open) return
    let cancelled = false
    loadContactSettings().then((s) => {
      if (!cancelled) setSettings(s)
    })
    return () => {
      cancelled = true
    }
  }, [open])

  const copyValue = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(`${label} copied`)
    } catch {
      toast.error(`Could not copy ${label.toLowerCase()}`)
    }
  }

  const hasDetails = Boolean(
    settings.email || settings.phone || settings.address || settings.website || settings.officeHours || settings.additionalInfo
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-serif text-primary">
            <MessageSquare className="w-5 h-5" />
            {settings.title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-1">
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            {settings.description}
          </p>

          {!hasDetails ? (
            <div className="p-4 rounded-xl bg-secondary/30 border border-border/50 text-center text-xs text-muted-foreground">
              Contact details have not been added yet. Administrators can configure them in the Admin CMS.
            </div>
          ) : (
            <div className="space-y-2.5">
              {settings.email && (
                <div className="p-3 rounded-xl bg-secondary/30 border border-border/50 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Mail className="w-4 h-4 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground">Email</p>
                      <a href={`mailto:${settings.email}`} className="text-xs font-semibold text-primary hover:underline truncate block">
                        {settings.email}
                      </a>
                    </div>
                  </div>
                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => void copyValue('Email', settings.email)}>
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}

              {settings.phone && (
                <div className="p-3 rounded-xl bg-secondary/30 border border-border/50 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Phone className="w-4 h-4 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground">Phone</p>
                      <a href={`tel:${settings.phone}`} className="text-xs font-semibold text-primary hover:underline truncate block">
                        {settings.phone}
                      </a>
                    </div>
                  </div>
                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => void copyValue('Phone', settings.phone)}>
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}

              {settings.address && (
                <div className="p-3 rounded-xl bg-secondary/30 border border-border/50 flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground">Address</p>
                    <p className="text-xs text-foreground whitespace-pre-line">{settings.address}</p>
                  </div>
                </div>
              )}

              {settings.website && (
                <div className="p-3 rounded-xl bg-secondary/30 border border-border/50 flex items-center gap-2.5">
                  <Globe className="w-4 h-4 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground">Website</p>
                    <a
                      href={/^https?:\/\//i.test(settings.website) ? settings.website : `https://${settings.website}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-primary hover:underline truncate block"
                    >
                      {settings.website}
                    </a>
                  </div>
                </div>
              )}

              {settings.officeHours && (
                <div className="p-3 rounded-xl bg-secondary/30 border border-border/50 flex items-start gap-2.5">
                  <Clock className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground">Hours</p>
                    <p className="text-xs text-foreground whitespace-pre-line">{settings.officeHours}</p>
                  </div>
                </div>
              )}

              {settings.additionalInfo && (
                <div className="p-3 rounded-xl bg-primary/5 border border-primary/15 text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
                  {settings.additionalInfo}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end pt-1">
            <Button size="sm" onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
