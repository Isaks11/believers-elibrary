import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { HeartHandshake, Save, RefreshCw, Landmark } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { getCachedDonationSettings, loadDonationSettings, saveDonationSettings, type DonationSettings } from '@/lib/donationSettings'

export function DonationSettingsSection() {
  const { user } = useAuth()
  const [form, setForm] = useState<DonationSettings>(() => getCachedDonationSettings())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const settings = await loadDonationSettings()
      setForm(settings)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const update = <K extends keyof DonationSettings>(key: K, value: DonationSettings[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await saveDonationSettings(form, user?.id ?? null)
      setForm(res.settings)
      if (res.ok) {
        toast.success(res.storage === 'cloud' ? 'Donation settings saved' : 'Donation settings saved on this device')
      } else {
        toast.error(res.error || 'Saved locally, but could not update online')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save donation settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card className="border-primary/15 bg-primary/5">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-2 text-primary">
            <HeartHandshake className="w-4 h-4" />
            <p className="text-sm font-semibold">Giving / Donation Settings</p>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Configure the donation purpose and account details shown to users in the Donate modal (Home and Profile). Keep account information accurate and up to date.
          </p>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-primary">Donation modal visibility</p>
              <p className="text-xs text-muted-foreground">Show or hide the giving information for users.</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={form.enabled ? 'default' : 'secondary'} className="text-[10px]">
                {form.enabled ? 'Enabled' : 'Hidden'}
              </Badge>
              <Switch checked={form.enabled} onCheckedChange={(v) => update('enabled', v)} aria-label="Enable donations" />
            </div>
          </div>

          <div className="grid gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase">Title</label>
              <Input value={form.title} onChange={(e) => update('title', e.target.value)} placeholder="Support the Ministry" className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase">Donation purpose / what it will be used for</label>
              <Textarea
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                placeholder="Explain clearly how donations will be used..."
                className="mt-1 min-h-[110px]"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-border/50 space-y-3">
            <div className="flex items-center gap-2 text-primary">
              <Landmark className="w-4 h-4" />
              <p className="text-sm font-semibold">Account details</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase">Bank / Platform name</label>
                <Input value={form.bankName} onChange={(e) => update('bankName', e.target.value)} placeholder="e.g. First Bank, MTN MoMo" className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase">Account name</label>
                <Input value={form.accountName} onChange={(e) => update('accountName', e.target.value)} placeholder="Account holder name" className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase">Account number / Wallet ID</label>
                <Input value={form.accountNumber} onChange={(e) => update('accountNumber', e.target.value)} placeholder="Account number" className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase">Currency (optional)</label>
                <Input value={form.currency} onChange={(e) => update('currency', e.target.value)} placeholder="e.g. NGN, USD, GHS" className="mt-1" />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase">Additional information (optional)</label>
              <Textarea
                value={form.additionalInfo}
                onChange={(e) => update('additionalInfo', e.target.value)}
                placeholder="Reference/narration instructions, branch details, mobile money steps, contact info, etc."
                className="mt-1 min-h-[90px]"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button variant="outline" onClick={() => void load()} disabled={loading || saving} className="gap-1.5">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Reload
            </Button>
            <Button onClick={handleSave} disabled={loading || saving} className="gap-1.5">
              <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save Settings'}
            </Button>
          </div>

          {form.updatedAt && (
            <p className="text-[11px] text-muted-foreground">Last updated: {new Date(form.updatedAt).toLocaleString()}</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}