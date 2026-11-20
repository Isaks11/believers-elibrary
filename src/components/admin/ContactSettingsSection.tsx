import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { MessageSquare, Save, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  getCachedContactSettings,
  loadContactSettings,
  saveContactSettings,
  type ContactSettings,
} from '@/lib/contactSettings'

export function ContactSettingsSection() {
  const [form, setForm] = useState<ContactSettings>(() => getCachedContactSettings())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadContactSettings().then((s) => {
      if (!cancelled) setForm(s)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const setField = (key: keyof Omit<ContactSettings, 'updatedAt'>, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await saveContactSettings({
        title: form.title,
        description: form.description,
        email: form.email,
        phone: form.phone,
        address: form.address,
        website: form.website,
        officeHours: form.officeHours,
        additionalInfo: form.additionalInfo,
      })
      if (res.storage === 'cloud') {
        toast.success('Contact details saved to database')
      } else if (res.warning) {
        toast.warning(`Saved on this device (${res.warning})`)
      } else {
        toast.info('Contact details saved on this device')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="border-none shadow-sm">
      <CardContent className="p-4 space-y-3.5">
        <div>
          <h3 className="text-sm font-bold text-primary flex items-center gap-1.5">
            <MessageSquare className="w-4 h-4" /> Contact Us Details
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Enter your church or ministry contact details shown when users tap the Contact Us button.
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase">Title</label>
          <Input value={form.title} onChange={(e) => setField('title', e.target.value)} placeholder="Contact Us" />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase">Intro Message</label>
          <Textarea
            value={form.description}
            onChange={(e) => setField('description', e.target.value)}
            placeholder="How can we help or pray for you?"
            className="min-h-[70px]"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Email</label>
            <Input value={form.email} onChange={(e) => setField('email', e.target.value)} placeholder="info@church.org" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Phone</label>
            <Input value={form.phone} onChange={(e) => setField('phone', e.target.value)} placeholder="+1 (555) 123-4567" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Website</label>
            <Input value={form.website} onChange={(e) => setField('website', e.target.value)} placeholder="https://church.org" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Office Hours</label>
            <Input value={form.officeHours} onChange={(e) => setField('officeHours', e.target.value)} placeholder="Mon–Fri, 9am–5pm" />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase">Address</label>
          <Textarea
            value={form.address}
            onChange={(e) => setField('address', e.target.value)}
            placeholder="Street address, city, country"
            className="min-h-[60px]"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase">Additional Info (optional)</label>
          <Textarea
            value={form.additionalInfo}
            onChange={(e) => setField('additionalInfo', e.target.value)}
            placeholder="Any extra instructions or social links..."
            className="min-h-[60px]"
          />
        </div>

        <div className="flex justify-end pt-1">
          <Button type="button" size="sm" className="gap-1.5 min-w-[140px]" onClick={() => void handleSave()} disabled={saving}>
            {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</> : <><Save className="w-3.5 h-3.5" /> Save Contact Details</>}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
