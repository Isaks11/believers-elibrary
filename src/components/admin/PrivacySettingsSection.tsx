import { useEffect, useRef, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Upload, Save, RotateCcw, FileText, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  DEFAULT_PRIVACY_SETTINGS,
  getCachedPrivacySettings,
  loadPrivacySettings,
  savePrivacySettings,
} from '@/lib/privacySettings'

export function PrivacySettingsSection() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState(() => getCachedPrivacySettings().title)
  const [content, setContent] = useState(() => getCachedPrivacySettings().content)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadPrivacySettings().then((s) => {
      if (cancelled) return
      setTitle(s.title)
      setContent(s.content)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = String(ev.target?.result ?? '').trim()
      if (!text) {
        toast.error('Uploaded file is empty')
        return
      }
      setContent(text)
      toast.success(`Loaded "${file.name}" into privacy terms`)
    }
    reader.onerror = () => toast.error('Could not read file')
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error('Both title and privacy terms content are required')
      return
    }
    setSaving(true)
    try {
      const res = await savePrivacySettings({ title, content })
      if (res.storage === 'cloud') {
        toast.success('Privacy terms saved to database')
      } else if (res.warning) {
        toast.warning(`Saved on this device (${res.warning})`)
      } else {
        toast.info('Privacy terms saved on this device')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setTitle(DEFAULT_PRIVACY_SETTINGS.title)
    setContent(DEFAULT_PRIVACY_SETTINGS.content)
    toast.info('Reset to default privacy terms (tap Save to apply)')
  }

  return (
    <div className="space-y-4">
      <Card className="border-none shadow-sm">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-primary flex items-center gap-1.5">
                <FileText className="w-4 h-4" /> Registration Privacy Terms
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Users must read and accept these privacy terms when creating a new account.
              </p>
            </div>
            <div>
              <input
                ref={fileRef}
                type="file"
                accept=".txt,.md,text/plain,text/markdown"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="w-3.5 h-3.5" /> Upload .txt / .md
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase">
              Title
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Privacy Policy & Terms of Use"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase">
              Privacy Terms Text
            </label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter or paste your privacy policy and terms..."
              className="min-h-[260px] text-sm leading-relaxed"
            />
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs gap-1.5 text-muted-foreground"
              onClick={handleReset}
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset Default
            </Button>
            <Button
              type="button"
              size="sm"
              className="gap-1.5 min-w-[130px]"
              onClick={() => void handleSave()}
              disabled={saving}
            >
              {saving ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</>
              ) : (
                <><Save className="w-3.5 h-3.5" /> Save Privacy Terms</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
