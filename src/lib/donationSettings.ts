import { supabase } from '@/lib/supabase'

export interface DonationSettings {
  enabled: boolean
  title: string
  description: string
  accountName: string
  bankName: string
  accountNumber: string
  currency: string
  additionalInfo: string
  updatedAt?: string | null
}

const STORAGE_KEY = 'donation_settings_v1'
const TABLE = 'donation_settings'
const ROW_ID = 'default'

export const DEFAULT_DONATION_SETTINGS: DonationSettings = {
  enabled: true,
  title: 'Support the Ministry',
  description:
    'Your giving helps support ministry outreach, discipleship resources, prayer initiatives, and the ongoing development of Believers e-Library.',
  accountName: '',
  bankName: '',
  accountNumber: '',
  currency: '',
  additionalInfo: '',
  updatedAt: null,
}

function normalize(raw: Partial<DonationSettings> | Record<string, unknown> | null | undefined): DonationSettings {
  const r = (raw || {}) as Record<string, unknown>
  return {
    enabled: typeof r.enabled === 'boolean' ? r.enabled : DEFAULT_DONATION_SETTINGS.enabled,
    title: String(r.title ?? DEFAULT_DONATION_SETTINGS.title).trim() || DEFAULT_DONATION_SETTINGS.title,
    description:
      String(r.description ?? DEFAULT_DONATION_SETTINGS.description).trim() || DEFAULT_DONATION_SETTINGS.description,
    accountName: String(r.accountName ?? r.account_name ?? '').trim(),
    bankName: String(r.bankName ?? r.bank_name ?? '').trim(),
    accountNumber: String(r.accountNumber ?? r.account_number ?? '').trim(),
    currency: String(r.currency ?? '').trim(),
    additionalInfo: String(r.additionalInfo ?? r.additional_info ?? '').trim(),
    updatedAt: (r.updatedAt ?? r.updated_at ?? null) as string | null,
  }
}

export function getCachedDonationSettings(): DonationSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_DONATION_SETTINGS
    return normalize(JSON.parse(raw))
  } catch {
    return DEFAULT_DONATION_SETTINGS
  }
}

export function cacheDonationSettings(settings: DonationSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // ignore
  }
}

export async function loadDonationSettings(): Promise<DonationSettings> {
  if (!supabase) return getCachedDonationSettings()
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('id', ROW_ID)
      .maybeSingle()
    if (error || !data) return getCachedDonationSettings()
    const normalized = normalize(data as Record<string, unknown>)
    cacheDonationSettings(normalized)
    return normalized
  } catch {
    return getCachedDonationSettings()
  }
}

export async function saveDonationSettings(
  input: DonationSettings,
  actorUserId?: string | null
): Promise<{ ok: boolean; settings: DonationSettings; storage: 'cloud' | 'local'; error?: string }> {
  const settings = normalize({ ...input, updatedAt: new Date().toISOString() })

  if (!supabase) {
    cacheDonationSettings(settings)
    return { ok: true, settings, storage: 'local' }
  }

  try {
    const payload = {
      id: ROW_ID,
      enabled: settings.enabled,
      title: settings.title,
      description: settings.description,
      account_name: settings.accountName || null,
      bank_name: settings.bankName || null,
      account_number: settings.accountNumber || null,
      currency: settings.currency || null,
      additional_info: settings.additionalInfo || null,
      updated_by: actorUserId || null,
      updated_at: settings.updatedAt,
    }
    const { data, error } = await supabase
      .from(TABLE)
      .upsert(payload, { onConflict: 'id' })
      .select('*')
      .single()
    if (error) {
      cacheDonationSettings(settings)
      return { ok: false, settings, storage: 'local', error: error.message }
    }
    const normalized = normalize(data as Record<string, unknown>)
    cacheDonationSettings(normalized)
    return { ok: true, settings: normalized, storage: 'cloud' }
  } catch (err) {
    cacheDonationSettings(settings)
    return {
      ok: false,
      settings,
      storage: 'local',
      error: err instanceof Error ? err.message : 'Could not save donation settings',
    }
  }
}

export function hasDonationAccountDetails(settings: DonationSettings): boolean {
  return Boolean(settings.accountName || settings.bankName || settings.accountNumber || settings.additionalInfo)
}