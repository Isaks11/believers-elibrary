import { isSupabaseConfigured, supabase } from '@/lib/supabase'

export interface ContactSettings {
  title: string
  description: string
  email: string
  phone: string
  address: string
  website: string
  officeHours: string
  additionalInfo: string
  updatedAt?: string | null
}

const STORAGE_KEY = 'contact_settings_v1'
const TABLE = 'contact_settings'
const ROW_ID = 'default'

export const DEFAULT_CONTACT_SETTINGS: ContactSettings = {
  title: 'Contact Us',
  description: 'Have a question, prayer request, or feedback? Reach out to our ministry team using the details below.',
  email: '',
  phone: '',
  address: '',
  website: '',
  officeHours: '',
  additionalInfo: '',
  updatedAt: null,
}

function normalize(raw: Partial<ContactSettings> | Record<string, unknown> | null | undefined): ContactSettings {
  const r = (raw || {}) as Record<string, unknown>
  return {
    title: String(r.title ?? DEFAULT_CONTACT_SETTINGS.title).trim() || DEFAULT_CONTACT_SETTINGS.title,
    description:
      String(r.description ?? DEFAULT_CONTACT_SETTINGS.description).trim() || DEFAULT_CONTACT_SETTINGS.description,
    email: String(r.email ?? '').trim(),
    phone: String(r.phone ?? '').trim(),
    address: String(r.address ?? '').trim(),
    website: String(r.website ?? '').trim(),
    officeHours: String(r.officeHours ?? r.office_hours ?? '').trim(),
    additionalInfo: String(r.additionalInfo ?? r.additional_info ?? '').trim(),
    updatedAt: (r.updatedAt ?? r.updated_at ?? null) as string | null,
  }
}

export function getCachedContactSettings(): ContactSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_CONTACT_SETTINGS
    return normalize(JSON.parse(raw))
  } catch {
    return DEFAULT_CONTACT_SETTINGS
  }
}

export function cacheContactSettings(settings: ContactSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    /* ignore */
  }
}

export async function loadContactSettings(): Promise<ContactSettings> {
  if (!isSupabaseConfigured || !supabase) return getCachedContactSettings()
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('id', ROW_ID)
      .maybeSingle()
    if (error || !data) return getCachedContactSettings()
    const normalized = normalize(data as Record<string, unknown>)
    cacheContactSettings(normalized)
    return normalized
  } catch {
    return getCachedContactSettings()
  }
}

export async function saveContactSettings(
  patch: Omit<ContactSettings, 'updatedAt'>
): Promise<{ ok: boolean; settings: ContactSettings; storage: 'cloud' | 'local'; warning?: string }> {
  const next: ContactSettings = normalize({
    ...patch,
    updatedAt: new Date().toISOString(),
  })
  cacheContactSettings(next)

  if (!isSupabaseConfigured || !supabase) {
    return { ok: true, settings: next, storage: 'local' }
  }

  try {
    const { error } = await supabase
      .from(TABLE)
      .upsert({
        id: ROW_ID,
        title: next.title,
        description: next.description,
        email: next.email,
        phone: next.phone,
        address: next.address,
        website: next.website,
        office_hours: next.officeHours,
        additional_info: next.additionalInfo,
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
