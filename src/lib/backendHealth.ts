/**
 * Backend health & error diagnostics.
 *
 * The CMS is "cloud-first, device-cached": when Supabase is reachable and the
 * signed-in user has a role, writes go to Postgres. When the backend is
 * unreachable (bad VITE_SUPABASE_URL, DNS failure, paused project) or the
 * schema has not been applied, content falls back to this device. Historically
 * that fallback was silent, so admins believed uploads had reached the
 * database. This module makes the real state visible in the Admin UI.
 */

import { isSupabaseConfigured, supabase } from '@/lib/supabase'

export type BackendHealthState =
  | 'local'          // Supabase not configured — device storage only
  | 'unreachable'    // URL/key set but the project cannot be reached
  | 'schema_missing' // project reachable, required tables/policies absent
  | 'connected'      // reachable and the CMS tables respond

export interface BackendHealth {
  state: BackendHealthState
  /** Hostname only — never the anon key. */
  host: string | null
  /** Short human-readable summary for banners. */
  message: string
  /** Diagnostic detail (network error, HTTP status, Postgres error). */
  detail?: string
  checkedAt: string
  signedIn: boolean
  /** True only when writes can actually be persisted server-side. */
  canWriteToCloud: boolean
}

const PROBE_TIMEOUT_MS = 8000

function backendUrl(): string | null {
  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()
  return url ? url.replace(/\/+$/, '') : null
}

function backendHost(): string | null {
  const url = backendUrl()
  if (!url) return null
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

/** Maps low-level PostgREST / network errors to actionable guidance. */
export function friendlyBackendError(raw: string | null | undefined): string {
  const message = (raw || '').trim()
  if (!message) return 'The server rejected the request.'
  const lower = message.toLowerCase()
  const host = backendHost() || 'the configured Supabase project'

  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('load failed') ||
    lower.includes('network request failed') ||
    lower.includes('fetch failed')
  ) {
    return `Cannot reach Supabase at ${host}. Check VITE_SUPABASE_URL and that the project is active.`
  }
  if (
    lower.includes('relation') && lower.includes('does not exist') ||
    lower.includes('schema cache') ||
    lower.includes('could not find the table')
  ) {
    return 'Database schema is missing. Apply supabase/schema.sql and the migrations in supabase/migrations/ before uploading content.'
  }
  if (
    lower.includes('row-level security') ||
    lower.includes('permission denied') ||
    lower.includes('violates row-level security')
  ) {
    return 'The server rejected the write because of Row Level Security. Sign in with an Editor/Admin account whose profile role is set in the database.'
  }
  if (lower.includes('duplicate key')) {
    return 'This item already exists on the server (duplicate slug or id). Rename the title and try again.'
  }
  if (lower.includes('null value in column')) {
    return `A required database field is missing: ${message}`
  }
  if (lower.includes('foreign key')) {
    return 'Your account is not linked to a server profile yet. Sign out and sign in again after the database schema has been applied.'
  }
  return message
}

/** Probes the auth endpoint and the CMS tables. Never throws. */
export async function checkBackendHealth(): Promise<BackendHealth> {
  const checkedAt = new Date().toISOString()
  const host = backendHost()

  let signedIn = false
  if (supabase) {
    try {
      const { data } = await supabase.auth.getSession()
      signedIn = Boolean(data.session?.user)
    } catch {
      signedIn = false
    }
  }

  if (!isSupabaseConfigured || !supabase || !backendUrl()) {
    return {
      state: 'local',
      host: null,
      message: 'Device-local mode — content is stored in this browser only.',
      checkedAt,
      signedIn: false,
      canWriteToCloud: false,
    }
  }

  // 1. Network reachability (auth health endpoint is cheap and unauthenticated).
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)
  try {
    const response = await fetch(`${backendUrl()}/auth/v1/health`, {
      headers: {
        apikey: (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || '',
      },
      signal: controller.signal,
    })
    if (!response.ok) {
      return {
        state: 'unreachable',
        host,
        message: `Supabase at ${host} responded with HTTP ${response.status}.`,
        detail: 'Verify the project URL/key and that the project is not paused.',
        checkedAt,
        signedIn,
        canWriteToCloud: false,
      }
    }
  } catch (err) {
    const detail =
      err instanceof Error
        ? err.name === 'AbortError'
          ? `Timed out after ${PROBE_TIMEOUT_MS / 1000}s.`
          : err.message
        : 'Network error.'
    return {
      state: 'unreachable',
      host,
      message: `Cannot reach Supabase at ${host}. Content will be saved on this device only.`,
      detail,
      checkedAt,
      signedIn,
      canWriteToCloud: false,
    }
  } finally {
    clearTimeout(timer)
  }

  // 2. Schema probe — a missing table means the migrations were never applied.
  try {
    const { error } = await supabase
      .from('devotionals')
      .select('id', { head: true, count: 'exact' })
      .limit(1)
    if (error) {
      const friendly = friendlyBackendError(error.message)
      const missing = /schema is missing/i.test(friendly)
      return {
        state: missing ? 'schema_missing' : 'connected',
        host,
        message: missing
          ? 'Supabase is reachable, but the CMS tables are not installed.'
          : 'Supabase is reachable (some tables/policies may still need review).',
        detail: friendly,
        checkedAt,
        signedIn,
        canWriteToCloud: !missing && signedIn,
      }
    }
  } catch (err) {
    return {
      state: 'unreachable',
      host,
      message: `Supabase at ${host} could not be queried.`,
      detail: err instanceof Error ? err.message : 'Network error.',
      checkedAt,
      signedIn,
      canWriteToCloud: false,
    }
  }

  return {
    state: 'connected',
    host,
    message: signedIn
      ? 'Cloud CMS connected — changes are saved to Postgres.'
      : 'Supabase is configured, but this session is device-local. Sign in with a Supabase account to write to the database.',
    checkedAt,
    signedIn,
    canWriteToCloud: signedIn,
  }
}
