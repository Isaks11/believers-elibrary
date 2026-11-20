import { isSupabaseConfigured, supabase } from '@/lib/supabase'

export interface PrivacySettings {
  title: string
  content: string
  updatedAt?: string | null
}

const STORAGE_KEY = 'privacy_settings_v1'
const TABLE = 'privacy_settings'
const ROW_ID = 'default'

export const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  title: 'Privacy Policy & Terms of Use',
  content: `Welcome to Believers e-Library.

1. Your Personal Content & Privacy
Your reading preferences, bookmarks, study notes, journal entries, and private prayer logs are stored locally on your device. When you sign in with an account, your profile and synced study records are protected by your account credentials and are never sold or shared with third-party advertisers.

2. Information We Collect
When creating an account, we store your display name and email address solely to authenticate your account and sync your personal library preferences. We do not use advertising trackers.

3. Respectful Community Use
By registering, you agree to use Believers e-Library respectfully and in accordance with Christian fellowship guidelines.

4. Your Rights
You can export your personal data or permanently delete your account and personal records at any time from Account Settings in your Profile.`,
  updatedAt: null,
}

function normalize(raw: Partial<PrivacySettings> | Record<string, unknown> | null | undefined): PrivacySettings {
  const r = (raw || {}) as Record<string, unknown>
  const title = String(r.title ?? DEFAULT_PRIVACY_SETTINGS.title).trim() || DEFAULT_PRIVACY_SETTINGS.title
  const content = String(r.content ?? DEFAULT_PRIVACY_SETTINGS.content).trim() || DEFAULT_PRIVACY_SETTINGS.content
  return {
    title,
    content,
    updatedAt: (r.updatedAt ?? r.updated_at ?? null) as string | null,
  }
}

export function getCachedPrivacySettings(): PrivacySettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_PRIVACY_SETTINGS
    return normalize(JSON.parse(raw))
  } catch {
    return DEFAULT_PRIVACY_SETTINGS
  }
}

export function cachePrivacySettings(settings: PrivacySettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    /* ignore */
  }
}

export async function loadPrivacySettings(): Promise<PrivacySettings> {
  if (!isSupabaseConfigured || !supabase) return getCachedPrivacySettings()
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('id', ROW_ID)
      .maybeSingle()
    if (error || !data) return getCachedPrivacySettings()
    const normalized = normalize(data as Record<string, unknown>)
    cachePrivacySettings(normalized)
    return normalized
  } catch {
    return getCachedPrivacySettings()
  }
}

export async function savePrivacySettings(
  patch: Pick<PrivacySettings, 'title' | 'content'>
): Promise<{ ok: boolean; settings: PrivacySettings; storage: 'cloud' | 'local'; warning?: string }> {
  const next: PrivacySettings = normalize({
    title: patch.title,
    content: patch.content,
    updatedAt: new Date().toISOString(),
  })
  cachePrivacySettings(next)

  if (!isSupabaseConfigured || !supabase) {
    return { ok: true, settings: next, storage: 'local' }
  }

  try {
    const { error } = await supabase
      .from(TABLE)
      .upsert({
        id: ROW_ID,
        title: next.title,
        content: next.content,
        updated_at: next.updatedAt,
      })
    if (error) {
      return { ok: true, settings: next, storage: 'local', warning: error.message }
    }
    return { ok: true, settings: next, storage: 'cloud' }
  } catch (err) {
    return {
      ok: true,
      settings: next,
      storage: 'local',
      warning: err instanceof Error ? err.message : 'Saved on device only',
    }
  }
}
