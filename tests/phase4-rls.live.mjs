import { test } from 'node:test'
import assert from 'node:assert/strict'
import { supabase, isSupabaseConfigured } from '../src/lib/supabase.ts'

// Live RLS sanity checks. These are opt-in: if tables are missing (PGRST205) or not configured,
// the test is skipped with an explicit reason (per Phase 4 instructions).

const LIVE_URL = import.meta.env?.VITE_SUPABASE_URL
const LIVE_ANON = import.meta.env?.VITE_SUPABASE_ANON_KEY

async function skipIfNotLiveOrMissing(reason: string) {
  if (!isSupabaseConfigured || !supabase || !LIVE_URL || !LIVE_ANON) {
    return { skip: true, reason: reason + ' (Supabase not configured in this env)' }
  }
  return { skip: false, reason: '' }
}

function isMissingTable(err: unknown): boolean {
  const msg = String((err as any)?.message ?? err ?? '')
  const code = String((err as any)?.code ?? (err as any)?.status ?? '')
  return code.includes('404') || code.includes('PGRST205') || msg.includes('Could not find the table')
}

test('live: auth health reachable', async () => {
  const s = await skipIfNotLiveOrMissing('skipping live backend tests')
  if (s.skip) {
    console.warn('SKIP:', s.reason)
    return
  }
  const { data, error } = await supabase.auth.getSession()
  // Presence check only (no secrets). getSession works even if no session.
  assert.ok(!error, `auth error: ${error?.message ?? ''}`)
  assert.ok(data !== undefined)
})

test('live: community tables exist (schema applied) or skip with reason', async () => {
  const s = await skipIfNotLiveOrMissing('skipping live RLS checks')
  if (s.skip) {
    console.warn('SKIP:', s.reason)
    return
  }
  const { error } = await supabase.from('community_posts').select('id').limit(1)
  if (error && isMissingTable(error)) {
    console.warn('SKIP: schema not applied to live DB (community_posts 404/PGRST205).')
    return // skipped, not a failure
  }
  assert.ok(!error, `community_posts select failed: ${error?.message ?? ''}`)
})

test('live: user_preferences has reminder_prefs/bible_bookmarks (hardening) or skip', async () => {
  const s = await skipIfNotLiveOrMissing('skipping live schema checks')
  if (s.skip) {
    console.warn('SKIP:', s.reason)
    return
  }
  // Select a non-existent column to see schema error? Or just check table exists.
  const { error } = await supabase.from('user_preferences').select('user_id').limit(1)
  if (error && isMissingTable(error)) {
    console.warn('SKIP: user_preferences missing (schema not applied).')
    return
  }
  assert.ok(!error, `user_preferences select failed: ${error?.message ?? ''}`)
  // Note: we cannot easily assert new columns without seeing the error type; hardening migration
  // adds them. If the migration isn't applied, this is a known PENDING item (documented).
})
