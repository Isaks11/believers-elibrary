import { supabase } from '@/lib/supabase'

export interface DailyVerseRecord {
  id: string
  verse_ref: string
  verse_text: string
  verse_date: string | null // YYYY-MM-DD
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export interface DailyVerseInput {
  verse_ref: string
  verse_text: string
  verse_date?: string | null
  is_active?: boolean
}

const TABLE = 'daily_verses'
const STORAGE_KEY = 'daily_verses_v1'

function makeLocalId() {
  try { return crypto.randomUUID() } catch { return `dv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }
}

function todayKey(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function normalizeDate(raw: string | null | undefined): string | null {
  const v = (raw || '').trim()
  if (!v) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v
  const iso = /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/.exec(v)
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`
  const ms = Date.parse(v)
  if (!Number.isFinite(ms)) return null
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function normalizeRow(raw: any): DailyVerseRecord {
  return {
    id: String(raw?.id || makeLocalId()),
    verse_ref: String(raw?.verse_ref || raw?.reference || '').trim(),
    verse_text: String(raw?.verse_text || raw?.text || '').trim(),
    verse_date: normalizeDate(raw?.verse_date ?? raw?.date ?? null),
    is_active: raw?.is_active === false ? false : true,
    created_at: raw?.created_at || null,
    updated_at: raw?.updated_at || null,
  }
}

function readLocal(): DailyVerseRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []
    return parsed.map(normalizeRow)
  } catch { return [] }
}

function writeLocal(rows: DailyVerseRecord[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(rows)) } catch {}
}

export async function listDailyVerses(): Promise<DailyVerseRecord[]> {
  if (!supabase) return readLocal().sort(sortVerses)
  try {
    const { data, error } = await supabase.from(TABLE).select('*').order('verse_date', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false })
    if (error || !data) return readLocal().sort(sortVerses)
    const rows = (data as any[]).map(normalizeRow).sort(sortVerses)
    writeLocal(rows)
    return rows
  } catch {
    return readLocal().sort(sortVerses)
  }
}

function sortVerses(a: DailyVerseRecord, b: DailyVerseRecord) {
  const ad = a.verse_date || ''
  const bd = b.verse_date || ''
  if (ad !== bd) return bd.localeCompare(ad)
  return (b.created_at || '').localeCompare(a.created_at || '')
}

export async function saveDailyVerse(input: DailyVerseInput, actorUserId?: string | null, existingId?: string): Promise<{ ok: boolean; row?: DailyVerseRecord; error?: string; storage: 'cloud' | 'local' }> {
  const now = new Date().toISOString()
  const base: DailyVerseRecord = normalizeRow({
    id: existingId || makeLocalId(),
    verse_ref: input.verse_ref,
    verse_text: input.verse_text,
    verse_date: normalizeDate(input.verse_date ?? null),
    is_active: input.is_active !== false,
    created_at: now,
    updated_at: now,
  })
  if (!base.verse_ref || !base.verse_text) return { ok: false, error: 'Verse reference and text are required.', storage: 'local' }

  if (!supabase) {
    const rows = readLocal()
    const idx = rows.findIndex((r) => r.id === base.id)
    const next = idx >= 0 ? rows.map((r) => r.id === base.id ? { ...base, created_at: r.created_at || now } : r) : [base, ...rows]
    writeLocal(next)
    return { ok: true, row: base, storage: 'local' }
  }

  try {
    const payload: any = {
      verse_ref: base.verse_ref,
      verse_text: base.verse_text,
      verse_date: base.verse_date,
      is_active: base.is_active,
      updated_by: actorUserId || null,
      updated_at: now,
    }
    let query
    if (existingId) {
      query = supabase.from(TABLE).update(payload).eq('id', existingId).select('*').single()
    } else {
      query = supabase.from(TABLE).insert({ ...payload, id: base.id, created_by: actorUserId || null, created_at: now }).select('*').single()
    }
    const { data, error } = await query
    if (error) {
      const rows = readLocal()
      writeLocal(existingId ? rows.map((r) => r.id === base.id ? { ...base, created_at: r.created_at || now } : r) : [base, ...rows])
      return { ok: false, row: base, error: error.message, storage: 'local' }
    }
    const row = normalizeRow(data)
    const rows = readLocal()
    const idx = rows.findIndex((r) => r.id === row.id)
    writeLocal(idx >= 0 ? rows.map((r) => (r.id === row.id ? row : r)) : [row, ...rows])
    return { ok: true, row, storage: 'cloud' }
  } catch (err) {
    const rows = readLocal()
    writeLocal(existingId ? rows.map((r) => r.id === base.id ? { ...base, created_at: r.created_at || now } : r) : [base, ...rows])
    return { ok: false, row: base, error: err instanceof Error ? err.message : 'Could not save verse', storage: 'local' }
  }
}

export async function deleteDailyVerse(id: string): Promise<{ ok: boolean; error?: string; storage: 'cloud' | 'local' }> {
  if (!supabase) {
    writeLocal(readLocal().filter((r) => r.id !== id))
    return { ok: true, storage: 'local' }
  }
  try {
    const { error } = await supabase.from(TABLE).delete().eq('id', id)
    if (error) {
      writeLocal(readLocal().filter((r) => r.id !== id))
      return { ok: false, error: error.message, storage: 'local' }
    }
    writeLocal(readLocal().filter((r) => r.id !== id))
    return { ok: true, storage: 'cloud' }
  } catch (err) {
    writeLocal(readLocal().filter((r) => r.id !== id))
    return { ok: false, error: err instanceof Error ? err.message : 'Could not delete verse', storage: 'local' }
  }
}

export function pickDailyVerseForToday(rows: DailyVerseRecord[]): { text: string; ref: string } | null {
  const active = rows.filter((r) => r.is_active && r.verse_ref && r.verse_text)
  if (active.length === 0) return null
  const today = todayKey()
  const exact = active.find((r) => r.verse_date === today)
  if (exact) return { text: exact.verse_text, ref: exact.verse_ref }
  // fallback: most recent dated active verse, else most recently added
  const sorted = [...active].sort(sortVerses)
  const chosen = sorted[0]
  return chosen ? { text: chosen.verse_text, ref: chosen.verse_ref } : null
}

export async function loadDailyVerseFromSettings(): Promise<{ text: string; ref: string } | null> {
  try {
    const rows = await listDailyVerses()
    return pickDailyVerseForToday(rows)
  } catch {
    return pickDailyVerseForToday(readLocal())
  }
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  const chars = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i]
    const n = chars[i + 1]
    if (inQuotes) {
      if (c === '"' && n === '"') { field += '"'; i++ }
      else if (c === '"') inQuotes = false
      else field += c
    } else {
      if (c === '"') inQuotes = true
      else if (c === ',') { row.push(field.trim()); field = '' }
      else if (c === '\n') { row.push(field.trim()); if (row.some(x => x.length)) rows.push(row); row = []; field = '' }
      else field += c
    }
  }
  if (field.length || row.length) { row.push(field.trim()); if (row.some(x => x.length)) rows.push(row) }
  return rows
}

function normHeader(h: string): string {
  const k = h.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (['date','versedate','day'].includes(k)) return 'verse_date'
  if (['reference','verseref','scripture','ref'].includes(k)) return 'verse_ref'
  if (['text','versetext','verse','scripturetext','content'].includes(k)) return 'verse_text'
  if (['active','isactive','enabled','status'].includes(k)) return 'is_active'
  return k
}

export function parseDailyVersesCsv(csvText: string): { valid: DailyVerseInput[]; errors: { rowNumber: number; message: string }[] } {
  const grid = parseCsv(csvText)
  if (grid.length === 0) return { valid: [], errors: [{ rowNumber: 0, message: 'CSV file is empty.' }] }
  const headers = grid[0].map(normHeader)
  const refIdx = headers.indexOf('verse_ref')
  const textIdx = headers.indexOf('verse_text')
  const dateIdx = headers.indexOf('verse_date')
  const activeIdx = headers.indexOf('is_active')
  if (refIdx === -1 || textIdx === -1) {
    return { valid: [], errors: [{ rowNumber: 1, message: 'Missing required columns. Include: reference (or verse_ref) and text (or verse_text). Optional: date (YYYY-MM-DD), active (true/false).' }] }
  }
  const valid: DailyVerseInput[] = []
  const errors: { rowNumber: number; message: string }[] = []
  grid.slice(1).forEach((row, i) => {
    const rowNum = i + 2
    const verse_ref = (row[refIdx] || '').trim()
    const verse_text = (row[textIdx] || '').trim()
    const verse_date = normalizeDate(dateIdx >= 0 ? row[dateIdx] : '')
    const activeRaw = (activeIdx >= 0 ? row[activeIdx] : 'true').toLowerCase()
    if (!verse_ref || !verse_text) {
      errors.push({ rowNumber: rowNum, message: 'Reference and text are required.' })
      return
    }
    valid.push({
      verse_ref,
      verse_text,
      verse_date,
      is_active: !(activeRaw === 'false' || activeRaw === '0' || activeRaw === 'no' || activeRaw === 'inactive'),
    })
  })
  return { valid, errors }
}

export function generateDailyVersesTemplateCsv(): string {
  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`
  const header = ['date', 'reference', 'text', 'active']
  const rows = [
    ['2026-11-19', 'John 3:16', 'For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.', 'true'],
    ['', 'Psalm 23:1', 'The LORD is my shepherd; I shall not want.', 'true'],
  ]
  return [header.join(','), ...rows.map(r => r.map(esc).join(','))].join('\n')
}
