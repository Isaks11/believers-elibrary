import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Copy, HeartHandshake, Landmark, Info } from 'lucide-react'
import { toast } from 'sonner'
import { getCachedDonationSettings, hasDonationAccountDetails, loadDonationSettings, type DonationSettings } from '@/lib/donationSettings'

interface DonateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DonateDialog({ open, onOpenChange }: DonateDialogProps) {
  const [settings, setSettings] = useState<DonationSettings>(() => getCachedDonationSettings())
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    let active = true
    setLoading(true)
    void loadDonationSettings().then((s) => {
      if (!active) return
      setSettings(s)
      setLoading(false)
    })
    return () => { active = false }
  }, [open])

  const copyText = async (label: string, value: string) => {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      toast.success(`${label} copied`)
    } catch {
      toast.error('Could not copy to clipboard')
    }
  }

  const hasDetails = hasDonationAccountDetails(settings)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <HeartHandshake className="w-5 h-5" /> {settings.title || 'Support the Ministry'}
          </DialogTitle>
          <DialogDescription>
            Give securely using the account details provided below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Card className="border-primary/15 bg-primary/5">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2 text-primary">
                <Info className="w-4 h-4" />
                <p className="text-sm font-semibold">What your donation supports</p>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                {settings.description}
              </p>
            </CardContent>
          </Card>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-primary flex items-center gap-2">
                <Landmark className="w-4 h-4" /> Account details
              </p>
              {loading && <Badge variant="secondary" className="text-[10px]">Loading…</Badge>}
            </div>

            {!hasDetails ? (
              <Card className="border-dashed">
                <CardContent className="p-4 text-sm text-muted-foreground">
                  Donation account details have not been configured yet. Please check back later.
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-4 space-y-3">
                  {settings.bankName && (
                    <DetailRow label="Bank / Platform" value={settings.bankName} onCopy={() => copyText('Bank name', settings.bankName)} />
                  )}
                  {settings.accountName && (
                    <DetailRow label="Account Name" value={settings.accountName} onCopy={() => copyText('Account name', settings.accountName)} />
                  )}
                  {settings.accountNumber && (
                    <DetailRow label="Account Number" value={settings.accountNumber} onCopy={() => copyText('Account number', settings.accountNumber)} />
                  )}
                  {settings.currency && (
                    <DetailRow label="Currency" value={settings.currency} onCopy={() => copyText('Currency', settings.currency)} />
                  )}
                  {settings.additionalInfo && (
                    <div className="pt-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Additional information</p>
                      <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">{settings.additionalInfo}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            After making a transfer, you may include a note/reference if instructed above. Thank you for your support.
          </p>

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function DetailRow({ label, value, onCopy }: { label: string; value: string; onCopy: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-muted-foreground uppercase">{label}</p>
        <p className="text-sm font-medium text-foreground break-all">{value}</p>
      </div>
      <Button type="button" variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={onCopy} aria-label={`Copy ${label}`}>
        <Copy className="w-4 h-4" />
      </Button>
    </div>
  )
}