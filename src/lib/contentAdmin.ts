/**
 * CMS Data-Access API (device-local first, best-effort cloud sync).
 *
 * Follows the established dual-write pattern from `src/data/mockFaithData.ts`:
 * 1. Write localStorage synchronously first so the UI and the device keep
 *    working even when the network/Supabase is unavailable or RLS rejects the
 *    write.
 * 2. Push to Supabase best-effort, recording failures via `syncHealth` so the
 *    Profile/Community "N changes not yet synced" indicators stay truthful.
 *
 * Server contract (supabase/migrations/20261020_cms_content_and_roles.sql):
 * `devotionals`, `reading_plans`, `hymns`, `videos`, `faith_resources` carry the
 * full publication columns (slug/status/version/published_at/scheduled_for/...).
 * The three legacy tables (`library_items`, `prayer_alerts`, `news_items`)
 * predate that contract — the CMS keeps those records device-local (their
 * server rows keep being written by their own feature modules in
 * `mockFaithData.ts`); audit entries and revision snapshots still sync.
 *
 * Workflow: draft → published (optionally scheduled) → archived, with
 * `archived → draft` as restore. Published content must be archived before it
 * can be permanently deleted.
 */

import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import {
  clearSyncFailure,
  recordSyncFailure,
  recordWriteError,
  recordWriteOutcome,
} from '@/lib/syncHealth';
import { recordAudit, type AuditActor } from '@/lib/auditLog';
import {
  ContentTypeMeta,
  type AnyContentRecord,
  type ContentDraft,
  type ContentEntityType,
  type ContentRecordMap,
  type ContentRevision,
  type ContentStatus,
  type OfflinePolicy,
} from '@/types/content';

const CMS_SCOPE = 'cms';
const REVISIONS_LOCAL_KEY = 'cms_content_revisions_v1';
const REVISIONS_LOCAL_CAP = 1000;
const DEFAULT_PAGE_SIZE = 20;

/** Tables with the full publication contract — the only server-backed content rows. */
const CMS_SERVER_TYPES: ContentEntityType[] = [
  'devotional',
  'reading_plan',
  'hymn',
  'video',
  'faith_resource',
];

/** Columns searched per entity type (local filter + PostgREST `.or()` filter). */
const SEARCH_COLUMNS: Record<ContentEntityType, string[]> = {
  devotional: ['title', 'body', 'verse_ref'],
  reading_plan: ['title', 'description'],
  hymn: ['title', 'lyrics', 'composer'],
  video: ['title', 'description', 'speaker'],
  faith_resource: ['title', 'description', 'scripture_ref'],
  library_item: ['title', 'description'],
  prayer_alert: ['title', 'description'],
  news: ['title', 'content'],
};

export interface ContentMutationResult<T> {
  ok: boolean;
  record?: T;
  errors: string[];
}

export interface ContentStatusResult {
  ok: boolean;
  errors: string[];
}

export interface ContentSort {
  field: 'updated_at' | 'created_at' | 'title' | 'published_at' | 'status';
  dir: 'asc' | 'desc';
}

export interface ListContentOptions {
  status?: ContentStatus | 'all';
  q?: string;
  category?: string;
  sort?: ContentSort;
  page?: number;
  pageSize?: number;
}

export interface ContentListResult<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  categories: string[];
}

function isServerBacked(type: ContentEntityType): boolean {
  return CMS_SERVER_TYPES.includes(type);
}

// --- Local store helpers (per-type `cms_<table>_v1` keys, guarded JSON I/O) ---

type WriteOutcome = { error?: { message?: string } | null } | null | undefined;

/** Best-effort Supabase write with explicit success/failure handlers (syncHealth). */
function bestEffortWrite(promise: PromiseLike<WriteOutcome>): void {
  promise.then(
    (result) => {
      recordWriteOutcome(CMS_SCOPE, result);
    },
    (err) => {
      recordWriteError(CMS_SCOPE, err);
    }
  );
}

function readLocalRecords(type: ContentEntityType): AnyContentRecord[] {
  try {
    const raw = localStorage.getItem(ContentTypeMeta[type].localStoreKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AnyContentRecord[]) : [];
  } catch {
    return [];
  }
}

function writeLocalRecords(type: ContentEntityType, rows: AnyContentRecord[]): void {
  try {
    localStorage.setItem(ContentTypeMeta[type].localStoreKey, JSON.stringify(rows));
  } catch {
    /* quota / private mode — local copy stays as it was */
  }
}

function readLocalRevisions(): ContentRevision[] {
  try {
    const raw = localStorage.getItem(REVISIONS_LOCAL_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (rev): rev is ContentRevision =>
        Boolean(rev) && typeof rev.entity_id === 'string' && typeof rev.version === 'number'
    );
  } catch {
    return [];
  }
}

function writeLocalRevisions(revisions: ContentRevision[]): void {
  try {
    // Newest first, hard cap so the key cannot grow without bound.
    localStorage.setItem(REVISIONS_LOCAL_KEY, JSON.stringify(revisions.slice(0, REVISIONS_LOCAL_CAP)));
  } catch {
    /* quota / private mode */
  }
}

/** Snapshots the given version locally and pushes a best-effort cloud copy. */
function appendRevision(type: ContentEntityType, revision: ContentRevision): void {
  const next = readLocalRevisions().filter(
    (rev) =>
      !(
        rev.entity_type === revision.entity_type &&
        rev.entity_id === revision.entity_id &&
        rev.version === revision.version
      )
  );
  writeLocalRevisions([revision, ...next]);

  if (isSupabaseConfigured && supabase) {
    bestEffortWrite(
      supabase.from('content_revisions').insert({
        entity_type: revision.entity_type,
        entity_id: revision.entity_id,
        version: revision.version,
        snapshot: revision.snapshot,
        edited_by: toUuidOrNull(revision.edited_by),
        created_at: revision.created_at,
      })
    );
  }
}

// --- Server payload mapping --------------------------------------------------

/**
 * Legacy tables reference auth.users(uuid) — non-uuid ids (guest-local) would
 * make PostgREST reject the whole write, so they are nulled server-side while
 * the real actor id stays in the local record and audit trail.
 */
function toUuidOrNull(value: unknown): string | null {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

/**
 * Maps a CMS record to the columns of its table. The five CMS tables carry the
 * full contract so the record is sent as-is (with uuid-safe `created_by`).
 * The legacy tables have narrower, differently-named NOT NULL columns
 * (library_items.type, news_items.content, ...) and no slug/status/version, so
 * only the compatible content columns are sent — workflow state for those
 * three types stays device-local.
 */
function payloadFor(type: ContentEntityType, record: AnyContentRecord): Record<string, unknown> {
  const row = record as unknown as Record<string, unknown>;
  switch (type) {
    case 'library_item':
      return {
        id: row.id,
        title: row.title,
        author: row.author || 'Unknown Author',
        type: row.media_type || 'material',
        category: row.category || 'General',
        description: row.description ?? null,
        created_by: toUuidOrNull(row.created_by),
        created_at: row.created_at,
      };
    case 'prayer_alert':
      return {
        id: row.id,
        title: row.title,
        description: typeof row.description === 'string' ? row.description : '',
        urgency: row.urgency || 'community',
        submitted_by: row.author ?? null,
        created_by: toUuidOrNull(row.created_by),
        created_at: row.created_at,
      };
    case 'news':
      return {
        id: row.id,
        title: row.title,
        excerpt: row.excerpt ?? null,
        content: typeof row.content === 'string' ? row.content : '',
        category: row.category || 'church',
        author: row.author ?? null,
        ...(typeof row.published_at === 'string' && row.published_at
          ? { publish_date: row.published_at.slice(0, 10) }
          : {}),
        created_by: toUuidOrNull(row.created_by),
        created_at: row.created_at,
      };
    default:
      // CMS tables: the record already matches the table's columns exactly.
      return { ...row, created_by: toUuidOrNull(row.created_by) };
  }
}

// --- Filtering / sorting -----------------------------------------------------

function matchesQuery(row: AnyContentRecord, type: ContentEntityType, q: string): boolean {
  const needle = q.toLowerCase();
  const source = row as unknown as Record<string, unknown>;
  for (const column of SEARCH_COLUMNS[type]) {
    const value = source[column];
    if (typeof value === 'string' && value.toLowerCase().includes(needle)) return true;
  }
  if (Array.isArray(row.tags) && row.tags.some((tag) => String(tag).toLowerCase().includes(needle))) {
    return true;
  }
  return false;
}

function matchesFilters(
  row: AnyContentRecord,
  type: ContentEntityType,
  status: ContentStatus | 'all' | undefined,
  q: string,
  category: string | undefined
): boolean {
  if (status && status !== 'all' && row.status !== status) return false;
  if (category && (row.category ?? '').toLowerCase() !== category.toLowerCase()) return false;
  if (q && !matchesQuery(row, type, q)) return false;
  return true;
}

function compareRows(a: AnyContentRecord, b: AnyContentRecord, sort: ContentSort): number {
  let result = 0;
  if (sort.field === 'title' || sort.field === 'status') {
    const av = String((a as unknown as Record<string, unknown>)[sort.field] ?? '').toLowerCase();
    const bv = String((b as unknown as Record<string, unknown>)[sort.field] ?? '').toLowerCase();
    result = av.localeCompare(bv);
  } else {
    const av = (a as unknown as Record<string, unknown>)[sort.field];
    const bv = (b as unknown as Record<string, unknown>)[sort.field];
    const at = Date.parse(typeof av === 'string' ? av : '') || 0;
    const bt = Date.parse(typeof bv === 'string' ? bv : '') || 0;
    result = at - bt;
  }
  return sort.dir === 'asc' ? result : -result;
}

function collectCategories(rows: AnyContentRecord[]): string[] {
  const set = new Set<string>();
  rows.forEach((row) => {
    if (row.category) set.add(row.category);
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

/** PostgREST `.or()` ilike filter; strips characters that break the grammar. */
function serverOrFilter(type: ContentEntityType, q: string): string {
  const term = q.toLowerCase().replace(/[,()*:~"']/g, '').trim();
  return SEARCH_COLUMNS[type].map((column) => `${column}.ilike.*${term}*`).join(',');
}

function updatedTs(row: { updated_at?: string }): number {
  return Date.parse(row.updated_at || '') || 0;
}

// --- Small utilities ---------------------------------------------------------

function generateId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `cms-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** URL/file slug from a title; empty string when the title has no slug-safe chars. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}

function uniqueSlug(type: ContentEntityType, title: string): string {
  const base = slugify(title) || 'untitled';
  const taken = new Set(readLocalRecords(type).map((row) => row.slug));
  if (!taken.has(base)) return base;
  for (let n = 2; n <= 500; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/** Per-type optional-field defaults applied (before the input) at create time. */
function defaultFields(type: ContentEntityType): Record<string, unknown> {
  switch (type) {
    case 'devotional':
      return { verse_text: null, translation: null, devotional_date: null };
    case 'reading_plan':
      return { description: null, structure: [] };
    case 'hymn':
      return {
        number: null,
        audio_url: null,
        public_domain: true,
        hymn_category: null,
        meter: null,
        composer: null,
      };
    case 'video':
      return {
        description: null,
        thumbnail_url: null,
        speaker: null,
        duration_seconds: null,
        video_category: null,
      };
    case 'faith_resource':
      return { description: null, resource_type: null, scripture_ref: null, curated_by: null };
    case 'library_item':
      return { media_type: 'material', description: null };
    case 'prayer_alert':
      return { description: '', urgency: 'community' };
    case 'news':
      return { content: '', excerpt: null };
  }
}

// --- Validation --------------------------------------------------------------

/**
 * Per-type required fields (from `ContentTypeMeta`) plus minimal sanity checks:
 * video_url / resource_url must be http(s), reading plan days > 0, and titles
 * must produce a non-empty URL slug.
 */
export function validateContent(type: ContentEntityType, input: unknown): string[] {
  const errors: string[] = [];
  if (!input || typeof input !== 'object') return ['Content payload must be an object.'];
  const record = input as Record<string, unknown>;

  for (const field of ContentTypeMeta[type].requires) {
    const value = record[field];
    if (field === 'days') {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 1) {
        errors.push('days must be a number greater than 0.');
      }
      continue;
    }
    if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
      errors.push(`${field} is required.`);
    }
  }

  if (type === 'video') {
    const url = record.video_url;
    if (typeof url === 'string' && url.trim() && !/^https?:\/\//i.test(url.trim())) {
      errors.push('video_url must start with http:// or https://.');
    }
  }
  if (type === 'faith_resource') {
    const url = record.resource_url;
    if (typeof url === 'string' && url.trim() && !/^https?:\/\//i.test(url.trim())) {
      errors.push('resource_url must start with http:// or https://.');
    }
  }

  const title = record.title;
  if (typeof title === 'string' && title.trim() && !slugify(title)) {
    errors.push('Title must include letters or numbers so a URL slug can be generated.');
  }

  return errors;
}

// --- Reads -------------------------------------------------------------------

/**
 * Lists content with search / status / category filters, sorting and
 * pagination. Scheduled items that are due are published first, so `published`
 * content is always live. In Supabase mode the page (with `count: 'exact'`)
 * is fetched from the table — status, category and search filters are merged
 * server-side — with a local-filtered fallback on any server error.
 */
export async function listContent<K extends ContentEntityType>(
  type: K,
  opts: ListContentOptions = {}
): Promise<ContentListResult<ContentRecordMap[K]>> {
  publishDueContent(type);

  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const pageSize = Math.max(1, Math.floor(opts.pageSize ?? DEFAULT_PAGE_SIZE));
  const sort: ContentSort = opts.sort ?? { field: 'updated_at', dir: 'desc' };
  const q = (opts.q ?? '').trim();

  const localAll = readLocalRecords(type) as ContentRecordMap[K][];
  const localFiltered = localAll.filter((row) => matchesFilters(row, type, opts.status, q, opts.category));
  const localSorted = [...localFiltered].sort((a, b) => compareRows(a, b, sort));
  const from = (page - 1) * pageSize;
  const localPage = localSorted.slice(from, from + pageSize);

  const fallback: ContentListResult<ContentRecordMap[K]> = {
    rows: localPage,
    total: localFiltered.length,
    page,
    pageSize,
    categories: collectCategories(localAll),
  };

  if (!isSupabaseConfigured || !supabase || !isServerBacked(type)) return fallback;

  try {
    const meta = ContentTypeMeta[type];
    let query = supabase.from(meta.table).select('*', { count: 'exact' });
    if (opts.status && opts.status !== 'all') query = query.in('status', [opts.status]);
    if (opts.category) query = query.eq('category', opts.category);
    if (q) query = query.or(serverOrFilter(type, q));
    const { data, error, count } = await query
      .order(sort.field, { ascending: sort.dir === 'asc' })
      .range(from, from + pageSize - 1);
    if (error) {
      recordSyncFailure(CMS_SCOPE, error.message);
      return fallback;
    }
    clearSyncFailure(CMS_SCOPE);

    const serverRows = (data ?? []) as unknown as ContentRecordMap[K][];
    const localById = new Map(localAll.map((row) => [row.id, row]));
    const rows = serverRows.map((row) => {
      const local = localById.get(row.id);
      // Never let a stale server row overwrite a newer local edit.
      return local && updatedTs(local) > updatedTs(row) ? local : row;
    });
    return { rows, total: count ?? rows.length, page, pageSize, categories: fallback.categories };
  } catch (err) {
    recordSyncFailure(CMS_SCOPE, err instanceof Error ? err.message : 'network unavailable');
    return fallback;
  }
}

/** Fetches one record by id (local first, then server; newest copy wins). */
export async function getContent<K extends ContentEntityType>(
  type: K,
  id: string
): Promise<ContentRecordMap[K] | null> {
  const local = readLocalRecords(type).find((row) => row.id === id) as
    | ContentRecordMap[K]
    | undefined;
  if (!isSupabaseConfigured || !supabase || !isServerBacked(type)) return local ?? null;

  try {
    const { data, error } = await supabase
      .from(ContentTypeMeta[type].table)
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      recordSyncFailure(CMS_SCOPE, error.message);
      return local ?? null;
    }
    clearSyncFailure(CMS_SCOPE);
    const serverRow = data as ContentRecordMap[K] | null;
    if (!serverRow) return local ?? null;
    if (local && updatedTs(local) > updatedTs(serverRow)) return local;
    return serverRow;
  } catch (err) {
    recordSyncFailure(CMS_SCOPE, err instanceof Error ? err.message : 'network unavailable');
    return local ?? null;
  }
}

/** Fetches one record by URL slug (local first, then server; newest wins). */
export async function getContentBySlug<K extends ContentEntityType>(
  type: K,
  slug: string
): Promise<ContentRecordMap[K] | null> {
  const local = readLocalRecords(type).find((row) => row.slug === slug) as
    | ContentRecordMap[K]
    | undefined;
  if (!isSupabaseConfigured || !supabase || !isServerBacked(type)) return local ?? null;

  try {
    const { data, error } = await supabase
      .from(ContentTypeMeta[type].table)
      .select('*')
      .eq('slug', slug)
      .maybeSingle();
    if (error) {
      recordSyncFailure(CMS_SCOPE, error.message);
      return local ?? null;
    }
    clearSyncFailure(CMS_SCOPE);
    const serverRow = data as ContentRecordMap[K] | null;
    if (!serverRow) return local ?? null;
    if (local && updatedTs(local) > updatedTs(serverRow)) return local;
    return serverRow;
  } catch (err) {
    recordSyncFailure(CMS_SCOPE, err instanceof Error ? err.message : 'network unavailable');
    return local ?? null;
  }
}

// --- Mutations ---------------------------------------------------------------

/** Creates a draft record: validated input, generated id + unique slug, version 1. */
export function createContent<K extends ContentEntityType>(
  type: K,
  input: ContentDraft<ContentRecordMap[K]>,
  actor: AuditActor
): ContentMutationResult<ContentRecordMap[K]> {
  const errors = validateContent(type, input);
  if (errors.length > 0) return { ok: false, errors };

  const now = new Date().toISOString();
  const draft = input as unknown as Record<string, unknown>;
  const title = String(draft.title ?? '').trim();
  const id = generateId();
  const slug = uniqueSlug(type, title);

  const record = {
    ...defaultFields(type),
    ...draft,
    id,
    slug,
    status: 'draft',
    published_at: null,
    scheduled_for: null,
    version: 1,
    category: typeof draft.category === 'string' && draft.category ? draft.category : null,
    tags: Array.isArray(draft.tags) ? draft.tags.map(String) : [],
    author: typeof draft.author === 'string' && draft.author ? draft.author : null,
    license_attribution:
      typeof draft.license_attribution === 'string' && draft.license_attribution
        ? draft.license_attribution
        : null,
    offline_policy: (draft.offline_policy as OfflinePolicy | undefined) || 'optional',
    created_by: actor.id,
    created_at: now,
    updated_at: now,
  } as unknown as ContentRecordMap[K];

  // 1. localStorage first — device keeps working offline.
  const rows = readLocalRecords(type);
  writeLocalRecords(type, [record, ...rows]);

  // 2. best-effort Supabase insert.
  if (isSupabaseConfigured && supabase && isServerBacked(type)) {
    bestEffortWrite(
      supabase.from(ContentTypeMeta[type].table).insert(payloadFor(type, record))
    );
  }

  recordAudit(actor, 'create', type, id, { slug, title });
  return { ok: true, record, errors: [] };
}

/**
 * Applies an editor patch to an existing record: bumps `version`, snapshots the
 * new state into `content_revisions`, dual-writes the row and audits the edit.
 * Status/workflow fields are immutable here — use `setStatus`.
 */
export function updateContent<K extends ContentEntityType>(
  type: K,
  id: string,
  patch: ContentDraft<ContentRecordMap[K]>,
  actor: AuditActor
): ContentMutationResult<ContentRecordMap[K]> {
  const rows = readLocalRecords(type);
  const index = rows.findIndex((row) => row.id === id);
  if (index === -1) return { ok: false, errors: [`${ContentTypeMeta[type].singularLabel} not found.`] };

  const existing = rows[index];
  const record = {
    ...existing,
    ...(patch as unknown as Record<string, unknown>),
    id: existing.id,
    slug: existing.slug,
    status: existing.status,
    published_at: existing.published_at,
    scheduled_for: existing.scheduled_for,
    version: (existing.version || 1) + 1,
    created_at: existing.created_at,
    created_by: existing.created_by,
    updated_at: new Date().toISOString(),
  } as unknown as ContentRecordMap[K];

  const errors = validateContent(type, record);
  if (errors.length > 0) return { ok: false, errors };

  // 1. localStorage first (record + revision snapshot).
  const next = rows.slice();
  next[index] = record;
  writeLocalRecords(type, next);
  appendRevision(type, {
    entity_type: type,
    entity_id: id,
    version: record.version,
    snapshot: record,
    edited_by: actor.id,
    created_at: record.updated_at,
  });

  // 2. best-effort Supabase update.
  if (isSupabaseConfigured && supabase && isServerBacked(type)) {
    bestEffortWrite(
      supabase.from(ContentTypeMeta[type].table).update(payloadFor(type, record)).eq('id', id)
    );
  }

  recordAudit(actor, 'update', type, id, { version: record.version });
  return { ok: true, record, errors: [] };
}

export interface SetStatusOptions {
  /** Future ISO timestamp — publishing becomes a scheduled (pending) go-live. */
  scheduledFor?: string;
}

/**
 * Publication workflow:
 * - draft → published sets `published_at` (a future `scheduledFor` keeps the
 *   item in the scheduled state instead: status published, `scheduled_for` set,
 *   `published_at` null — see `isScheduled` / `publishDueContent`).
 * - published → draft (unpublish) nulls `published_at`.
 * - → archived is allowed from any state (cancels a pending schedule).
 * - archived → draft restores the item.
 * Scheduling in the past is rejected. Every transition is audited.
 */
export function setStatus<K extends ContentEntityType>(
  type: K,
  id: string,
  status: ContentStatus,
  actor: AuditActor,
  opts: SetStatusOptions = {}
): ContentStatusResult {
  const rows = readLocalRecords(type);
  const index = rows.findIndex((row) => row.id === id);
  if (index === -1) return { ok: false, errors: [`${ContentTypeMeta[type].singularLabel} not found.`] };

  const existing = rows[index];
  const from = existing.status;
  const scheduledOption = opts.scheduledFor ? opts.scheduledFor.trim() : '';
  if (from === status && !scheduledOption) return { ok: true, errors: [] };

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  let publishedAt = existing.published_at;
  let scheduledFor = existing.scheduled_for;

  if (scheduledOption) {
    if (status !== 'published') {
      return { ok: false, errors: ['Scheduling only applies when publishing.'] };
    }
    const scheduledMs = Date.parse(scheduledOption);
    if (!Number.isFinite(scheduledMs)) {
      return { ok: false, errors: ['Scheduled time must be a valid ISO date.'] };
    }
    if (scheduledMs <= nowMs) {
      return { ok: false, errors: ['Scheduled time must be in the future.'] };
    }
    // Scheduled publish: stays a pending "published" row until it is due.
    scheduledFor = new Date(scheduledMs).toISOString();
    publishedAt = null;
  } else if (status === 'published') {
    // Publish now (draft→published, or go-live immediately while scheduled).
    publishedAt = nowIso;
    scheduledFor = null;
  } else if (status === 'draft') {
    // Unpublish (published→draft) / restore (archived→draft).
    publishedAt = null;
    scheduledFor = null;
  } else if (status === 'archived') {
    // Allowed from any state; archiving cancels a pending scheduled publish.
    scheduledFor = null;
  }

  const record = {
    ...existing,
    status,
    published_at: publishedAt,
    scheduled_for: scheduledFor,
    updated_at: nowIso,
  } as ContentRecordMap[K];

  // 1. localStorage first.
  const next = rows.slice();
  next[index] = record;
  writeLocalRecords(type, next);

  // 2. best-effort Supabase update.
  if (isSupabaseConfigured && supabase && isServerBacked(type)) {
    bestEffortWrite(
      supabase.from(ContentTypeMeta[type].table).update(payloadFor(type, record)).eq('id', id)
    );
  }

  const action =
    status === 'published'
      ? publishedAt === null && scheduledFor
        ? 'schedule'
        : 'publish'
      : status === 'archived'
        ? 'archive'
        : from === 'archived'
          ? 'restore'
          : 'unpublish';
  recordAudit(actor, action, type, id, {
    from,
    to: status,
    ...(scheduledFor ? { scheduled_for: scheduledFor } : {}),
  });
  return { ok: true, errors: [] };
}

/** True while a published row is waiting for its scheduled go-live time. */
export function isScheduled(record: { status: ContentStatus; scheduled_for: string | null }): boolean {
  if (record.status !== 'published' || !record.scheduled_for) return false;
  const dueMs = Date.parse(record.scheduled_for);
  return Number.isFinite(dueMs) && dueMs > Date.now();
}

/**
 * Publishes any scheduled rows whose `scheduled_for` time has passed (sets
 * `published_at`, clears `scheduled_for`, audits `publish`). Called from
 * `listContent`, so scheduled content goes live whenever the CMS is opened.
 * Returns how many rows went live.
 */
export function publishDueContent(type: ContentEntityType): number {
  const rows = readLocalRecords(type);
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const due: AnyContentRecord[] = [];

  const next = rows.map((row) => {
    if (row.status !== 'published' || !row.scheduled_for) return row;
    const dueMs = Date.parse(row.scheduled_for);
    if (!Number.isFinite(dueMs) || dueMs > nowMs) return row;
    const wasScheduledFor = row.scheduled_for;
    const updated = { ...row, published_at: nowIso, scheduled_for: null, updated_at: nowIso };
    due.push(updated);
    recordAudit({ id: row.created_by, role: 'system' }, 'publish', type, row.id, {
      scheduled: true,
      scheduled_for: wasScheduledFor,
    });
    return updated;
  });

  if (due.length > 0) {
    // 1. localStorage first.
    writeLocalRecords(type, next);
    // 2. best-effort Supabase updates.
    if (isSupabaseConfigured && supabase && isServerBacked(type)) {
      due.forEach((row) => {
        bestEffortWrite(
          supabase
            .from(ContentTypeMeta[type].table)
            .update(payloadFor(type, row))
            .eq('id', row.id)
        );
      });
    }
  }
  return due.length;
}

/**
 * Permanently deletes a draft or archived record (and its revision history).
 * Published content must be archived first. Audited before removal so the
 * trail keeps the id/title even after the row is gone.
 */
export function deleteContent<K extends ContentEntityType>(
  type: K,
  id: string,
  actor: AuditActor
): ContentStatusResult {
  const rows = readLocalRecords(type);
  const existing = rows.find((row) => row.id === id);
  if (!existing) return { ok: false, errors: [`${ContentTypeMeta[type].singularLabel} not found.`] };
  if (existing.status === 'published') {
    return {
      ok: false,
      errors: ['Published content must be archived before it can be deleted.'],
    };
  }

  // Audit first — the entry must outlive the record it describes.
  recordAudit(actor, 'delete', type, id, {
    title: (existing as unknown as Record<string, unknown>).title,
    status: existing.status,
  });

  // 1. localStorage first (record + its revision snapshots).
  writeLocalRecords(type, rows.filter((row) => row.id !== id));
  writeLocalRevisions(
    readLocalRevisions().filter((rev) => !(rev.entity_type === type && rev.entity_id === id))
  );

  // 2. best-effort Supabase deletes.
  if (isSupabaseConfigured && supabase) {
    if (isServerBacked(type)) {
      bestEffortWrite(
        supabase.from(ContentTypeMeta[type].table).delete().eq('id', id)
      );
    }
    bestEffortWrite(
      supabase.from('content_revisions').delete().eq('entity_type', type).eq('entity_id', id)
    );
  }

  return { ok: true, errors: [] };
}

// --- Revisions ---------------------------------------------------------------

function sortRevisions(revisions: ContentRevision[]): ContentRevision[] {
  return [...revisions].sort((a, b) => b.version - a.version);
}

/** Lists revision snapshots for a record (newest version first). */
export async function listRevisions<K extends ContentEntityType>(
  type: K,
  id: string
): Promise<ContentRevision[]> {
  const local = readLocalRevisions().filter(
    (rev) => rev.entity_type === type && rev.entity_id === id
  );
  if (!isSupabaseConfigured || !supabase) return sortRevisions(local);

  try {
    const { data, error } = await supabase
      .from('content_revisions')
      .select('*')
      .eq('entity_type', type)
      .eq('entity_id', id)
      .order('version', { ascending: false });
    if (error) {
      recordSyncFailure(CMS_SCOPE, error.message);
      return sortRevisions(local);
    }
    clearSyncFailure(CMS_SCOPE);
    const server = ((data ?? []) as unknown as ContentRevision[]).filter(
      (rev) => rev && typeof rev.version === 'number'
    );
    const byVersion = new Map<number, ContentRevision>();
    server.forEach((rev) => byVersion.set(rev.version, rev));
    local.forEach((rev) => byVersion.set(rev.version, rev)); // local copy wins
    return sortRevisions(Array.from(byVersion.values()));
  } catch (err) {
    recordSyncFailure(CMS_SCOPE, err instanceof Error ? err.message : 'network unavailable');
    return sortRevisions(local);
  }
}

/**
 * Restores the content fields of a stored revision as a new version (the
 * workflow state — status / published_at / scheduled_for — is kept as-is).
 * The restored state is itself snapshotted so the history stays contiguous.
 */
export function restoreRevision<K extends ContentEntityType>(
  type: K,
  id: string,
  version: number,
  actor: AuditActor
): ContentMutationResult<ContentRecordMap[K]> {
  const rows = readLocalRecords(type);
  const index = rows.findIndex((row) => row.id === id);
  if (index === -1) return { ok: false, errors: [`${ContentTypeMeta[type].singularLabel} not found.`] };

  const existing = rows[index];
  const revision = readLocalRevisions().find(
    (rev) => rev.entity_type === type && rev.entity_id === id && rev.version === version
  );
  if (!revision) {
    return { ok: false, errors: [`No revision found for version ${version}.`] };
  }

  const nowIso = new Date().toISOString();
  const nextVersion = (existing.version || 1) + 1;
  const record = {
    ...(revision.snapshot as unknown as Record<string, unknown>),
    id: existing.id,
    slug: existing.slug,
    status: existing.status,
    published_at: existing.published_at,
    scheduled_for: existing.scheduled_for,
    version: nextVersion,
    created_at: existing.created_at,
    created_by: existing.created_by,
    updated_at: nowIso,
  } as unknown as ContentRecordMap[K];

  // 1. localStorage first (record + revision snapshot of the restored state).
  const next = rows.slice();
  next[index] = record;
  writeLocalRecords(type, next);
  appendRevision(type, {
    entity_type: type,
    entity_id: id,
    version: nextVersion,
    snapshot: record,
    edited_by: actor.id,
    created_at: nowIso,
  });

  // 2. best-effort Supabase update.
  if (isSupabaseConfigured && supabase && isServerBacked(type)) {
    bestEffortWrite(
      supabase.from(ContentTypeMeta[type].table).update(payloadFor(type, record)).eq('id', id)
    );
  }

  recordAudit(actor, 'restore_revision', type, id, {
    restored_version: revision.version,
    version: nextVersion,
  });
  return { ok: true, record, errors: [] };
}
