/**
 * CMS Verification Suite (`tests/cms.test.mjs`)
 *
 * Source-level assertions (no DOM, no bundler) covering:
 * 1. `src/types/content.ts` — documented entities, shared `BaseContentRecord`
 *    contract and the `ContentTypeMeta` map (table / labels / `cms_<table>_v1`
 *    local keys / required fields).
 * 2. `src/lib/contentAdmin.ts` — every documented function is exported, the
 *    localStorage-first dual-write pattern is used, slug/version/status
 *    workflow logic is present (version bump on update, audit on
 *    create/publish/delete, scheduled-in-past rejected, published must be
 *    archived before delete, due scheduled content published from listContent).
 * 3. `src/lib/auditLog.ts` — local trail capped at 500 entries (newest first),
 *    best-effort `audit_log` insert behind the `isSupabaseConfigured` guard.
 * 4. No fire-and-forget empty then-callbacks in the new CMS files.
 * 5. package.json registers `test:cms` and keeps the existing `test` script.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

/** Extracts the source between two markers (used for ordering assertions). */
function sliceBetween(src, start, end) {
  const i = src.indexOf(start);
  assert.ok(i >= 0, `missing marker: ${start}`);
  const j = end ? src.indexOf(end, i + start.length) : src.length;
  assert.ok(j > i, `missing marker after ${start}: ${end}`);
  return src.slice(i, j);
}

const typesSrc = read('src/types/content.ts');
const adminSrc = read('src/lib/contentAdmin.ts');
const auditSrc = read('src/lib/auditLog.ts');

// ---------------------------------------------------------------------------
// 1. src/types/content.ts — documented entities + meta map
// ---------------------------------------------------------------------------
test('content.ts exports the documented unions and shared record contract', () => {
  assert.match(typesSrc, /export type ContentStatus = 'draft' \| 'published' \| 'archived'/);
  assert.match(typesSrc, /export type OfflinePolicy = 'online_only' \| 'optional' \| 'essential'/);
  assert.match(
    typesSrc,
    /export type ContentEntityType =\s*\|?\s*'devotional'\s*\|\s*'reading_plan'\s*\|\s*'hymn'\s*\|\s*'video'\s*\|\s*'faith_resource'\s*\|\s*'library_item'\s*\|\s*'prayer_alert'\s*\|\s*'news'/
  );
  assert.match(typesSrc, /export interface BaseContentRecord/);
  // Every BaseContentRecord field from the contract
  for (const field of [
    'id:',
    'slug:',
    'status:',
    'published_at:',
    'scheduled_for:',
    'version:',
    'category:',
    'tags:',
    'author:',
    'license_attribution:',
    'offline_policy:',
    'created_by:',
    'created_at:',
    'updated_at:',
  ]) {
    assert.ok(typesSrc.includes(field), `BaseContentRecord must declare ${field}`);
  }
});

test('content.ts exports every documented entity record + PlanStep', () => {
  for (const name of [
    'PlanStep',
    'DevotionalRecord',
    'ReadingPlanRecord',
    'HymnRecord',
    'VideoRecord',
    'FaithResourceRecord',
    'LibraryItemCmsRecord',
    'PrayerAlertCmsRecord',
    'NewsCmsRecord',
    'ContentRecordMap',
    'AnyContentRecord',
    'ContentDraft',
    'ContentTypeMetaEntry',
    'ContentRevision',
  ]) {
    assert.match(
      typesSrc,
      new RegExp(`export (interface|type) ${name}\\b`),
      `${name} must be exported from src/types/content.ts`
    );
  }
  // Per-type fields from the contract
  assert.ok(typesSrc.includes('devotional_date'));
  assert.ok(typesSrc.includes('verse_ref'));
  assert.ok(typesSrc.includes('structure: PlanStep[]'));
  assert.ok(typesSrc.includes('lyrics'));
  assert.ok(typesSrc.includes('public_domain'));
  assert.ok(typesSrc.includes('hymn_category'));
  assert.ok(typesSrc.includes('meter'));
  assert.ok(typesSrc.includes('composer'));
  assert.ok(typesSrc.includes('video_url'));
  assert.ok(typesSrc.includes('thumbnail_url'));
  assert.ok(typesSrc.includes('duration_seconds'));
  assert.ok(typesSrc.includes('resource_url'));
  assert.ok(typesSrc.includes('resource_type'));
  assert.ok(typesSrc.includes('scripture_ref'));
  assert.ok(typesSrc.includes('curated_by'));
});

test('ContentTypeMeta maps every entity type to table, labels, local key and requires', () => {
  assert.match(typesSrc, /export const ContentTypeMeta: Record<ContentEntityType, ContentTypeMetaEntry>/);
  const expected = {
    devotional: 'devotionals',
    reading_plan: 'reading_plans',
    hymn: 'hymns',
    video: 'videos',
    faith_resource: 'faith_resources',
    library_item: 'library_items',
    prayer_alert: 'prayer_alerts',
    news: 'news_items',
  };
  for (const [entity, table] of Object.entries(expected)) {
    assert.ok(typesSrc.includes(`table: '${table}'`), `${entity} → table ${table}`);
    assert.ok(
      typesSrc.includes(`localStoreKey: 'cms_${table}_v1'`),
      `${entity} → cms_${table}_v1 local key`
    );
    assert.ok(typesSrc.includes(`singularLabel: '`), `${entity} needs a singularLabel`);
  }
  // Required fields per type
  assert.ok(typesSrc.includes("requires: ['title', 'body', 'verse_ref']"), 'devotional requires');
  assert.ok(typesSrc.includes("requires: ['title', 'days']"), 'reading_plan requires');
  assert.ok(typesSrc.includes("requires: ['title', 'lyrics']"), 'hymn requires');
  assert.ok(typesSrc.includes("requires: ['title', 'video_url']"), 'video requires');
  assert.ok(typesSrc.includes("requires: ['title', 'resource_url']"), 'faith_resource requires');
});

// ---------------------------------------------------------------------------
// 2. src/lib/contentAdmin.ts — documented API surface
// ---------------------------------------------------------------------------
test('contentAdmin exports every documented function', () => {
  const documented = [
    'listContent',
    'getContent',
    'getContentBySlug',
    'createContent',
    'updateContent',
    'setStatus',
    'deleteContent',
    'listRevisions',
    'restoreRevision',
    'validateContent',
    'isScheduled',
    'publishDueContent',
    'slugify',
  ];
  for (const fn of documented) {
    assert.match(
      adminSrc,
      new RegExp(`export (async )?function ${fn}\\b`),
      `contentAdmin must export ${fn}`
    );
  }
});

test('contentAdmin uses the localStorage-first dual-write pattern with syncHealth', () => {
  assert.ok(adminSrc.includes('localStorage.setItem'), 'must write localStorage first');
  assert.ok(adminSrc.includes('isSupabaseConfigured'), 'must guard on isSupabaseConfigured');
  assert.ok(adminSrc.includes('recordWriteOutcome'), 'must reuse syncHealth recordWriteOutcome');
  assert.ok(adminSrc.includes('recordWriteError'), 'must reuse syncHealth recordWriteError');

  // createContent: local write happens BEFORE the Supabase insert
  const createSeg = sliceBetween(adminSrc, 'export function createContent', 'export function updateContent');
  const localIdx = createSeg.indexOf('writeLocalRecords(');
  const insertIdx = createSeg.indexOf('.insert(');
  assert.ok(localIdx >= 0, 'createContent must write localStorage');
  assert.ok(insertIdx > localIdx, 'createContent must insert to Supabase after the local write');
  assert.match(createSeg, /if \(isSupabaseConfigured && supabase/);

  // updateContent: local write before server update
  const updateSeg = sliceBetween(adminSrc, 'export function updateContent', 'export interface SetStatusOptions');
  const uLocalIdx = updateSeg.indexOf('writeLocalRecords(');
  const updateIdx = updateSeg.indexOf('.update(');
  assert.ok(uLocalIdx >= 0, 'updateContent must write localStorage');
  assert.ok(updateIdx > uLocalIdx, 'updateContent must update Supabase after the local write');

  // deleteContent: local write before server delete
  const deleteSeg = sliceBetween(adminSrc, 'export function deleteContent', 'function sortRevisions');
  const dLocalIdx = deleteSeg.indexOf('writeLocalRecords(');
  const deleteIdx = deleteSeg.indexOf('.delete(');
  assert.ok(dLocalIdx >= 0, 'deleteContent must write localStorage');
  assert.ok(deleteIdx > dLocalIdx, 'deleteContent must delete from Supabase after the local write');
});

test('contentAdmin generates slugs with -2/-3 suffix uniqueness', () => {
  assert.match(adminSrc, /export function slugify\(/);
  const slugSeg = sliceBetween(adminSrc, 'function uniqueSlug', '/** Per-type optional-field defaults');
  assert.ok(slugSeg.includes('`${base}-${n}`'), 'duplicate slugs must get -2/-3 style suffixes');
  assert.ok(slugSeg.includes('for (let n = 2'), 'suffix counter must start at 2');
  assert.ok(adminSrc.includes("recordAudit(actor, 'create', type, id"), 'create must be audited');
});

test('contentAdmin bumps versions, snapshots revisions and audits updates', () => {
  const updateSeg = sliceBetween(adminSrc, 'export function updateContent', 'export interface SetStatusOptions');
  assert.ok(
    updateSeg.includes('(existing.version || 1) + 1'),
    'updateContent must bump the version'
  );
  const createSeg = sliceBetween(adminSrc, 'export function createContent', 'export function updateContent');
  assert.ok(createSeg.includes('version: 1'), 'createContent sets version 1');
  assert.ok(updateSeg.includes('appendRevision'), 'updateContent must snapshot a revision');
  assert.ok(
    adminSrc.includes("supabase.from('content_revisions')"),
    'revisions must be pushed to content_revisions best-effort'
  );
  assert.ok(
    updateSeg.includes("recordAudit(actor, 'update', type, id"),
    'update must be audited'
  );
  // Restore re-applies a snapshot as a new version
  const restoreSeg = sliceBetween(adminSrc, 'export function restoreRevision', null);
  assert.ok(restoreSeg.includes('revision.snapshot'), 'restore must read the snapshot');
  assert.ok(restoreSeg.includes('nextVersion'), 'restore must bump to a new version');
});

test('contentAdmin enforces the publish/schedule/unpublish/archive workflow', () => {
  const statusSeg = sliceBetween(
    adminSrc,
    'export function setStatus',
    'export function isScheduled'
  );
  // Scheduling rules
  assert.match(statusSeg, /Scheduled time must be in the future/);
  assert.ok(statusSeg.includes('scheduledMs <= nowMs'), 'scheduled-in-past must be rejected');
  assert.match(statusSeg, /Scheduling only applies when publishing/);
  // Transition audit actions
  for (const action of ["'publish'", "'schedule'", "'unpublish'", "'archive'", "'restore'"]) {
    assert.ok(statusSeg.includes(action), `setStatus must audit ${action}`);
  }
  assert.ok(statusSeg.includes("recordAudit(actor, action, type, id"), 'transitions must be audited');
  // Unpublish nulls published_at
  assert.ok(statusSeg.includes('publishedAt = null'), 'unpublish must null published_at');

  // isScheduled + publishDueContent
  assert.ok(adminSrc.includes('export function isScheduled('), 'isScheduled helper must exist');
  const dueBody = sliceBetween(adminSrc, 'export function publishDueContent', 'export function deleteContent');
  assert.ok(dueBody.includes("'publish'"), 'due scheduled items must be audited as published');
  assert.ok(dueBody.includes('published_at: nowIso'), 'due scheduled items get published_at');
  assert.ok(dueBody.includes('scheduled_for: null'), 'due scheduled items clear scheduled_for');

  // listContent publishes due content first
  const listSeg = sliceBetween(adminSrc, 'export async function listContent', 'export async function getContent');
  assert.ok(listSeg.includes('publishDueContent(type)'), 'listContent must publish due scheduled content');

  // Delete rules
  const deleteSeg = sliceBetween(adminSrc, 'export function deleteContent', 'function sortRevisions');
  assert.match(deleteSeg, /Published content must be archived before/);
  assert.ok(deleteSeg.includes("recordAudit(actor, 'delete', type, id"), 'delete must be audited');
});

test('listContent filters, sorts, paginates and merges server pages with count exact', () => {
  const listSeg = sliceBetween(adminSrc, 'export async function listContent', 'export async function getContent');
  assert.ok(listSeg.includes("count: 'exact'"), 'server page must request exact count');
  assert.ok(listSeg.includes(".in('status'"), 'status filter must be merged server-side');
  assert.ok(adminSrc.includes('.ilike'), 'search must use ilike server-side');
  assert.ok(listSeg.includes('.or('), 'search must span multiple columns via .or()');
  assert.ok(listSeg.includes('.order('), 'sorting must be applied server-side');
  assert.ok(listSeg.includes('.range('), 'pagination must use .range()');
  assert.ok(listSeg.includes('recordSyncFailure'), 'server errors must fall back + record failure');
  assert.ok(listSeg.includes('categories'), 'result must expose category facets');
  // Local search spans title + body/lyrics/description + tags
  assert.ok(adminSrc.includes('SEARCH_COLUMNS'), 'per-type search columns must exist');
  assert.ok(adminSrc.includes('row.tags'), 'local search must include tags');
});

// ---------------------------------------------------------------------------
// 3. src/lib/auditLog.ts — capped local trail + best-effort cloud copy
// ---------------------------------------------------------------------------
test('auditLog exports the documented API and caps the local trail at 500', () => {
  assert.match(auditSrc, /export function recordAudit\b/);
  assert.match(auditSrc, /export function listAuditLog\b/);
  assert.match(auditSrc, /export function clearLocalAuditLog\b/);
  assert.ok(auditSrc.includes('cms_audit_log_v1'), 'local key must be cms_audit_log_v1');
  assert.match(auditSrc, /AUDIT_LOG_CAP = 500/, 'cap must be 500 entries');
  assert.ok(auditSrc.includes('slice(0, AUDIT_LOG_CAP)'), 'writes must enforce the cap');
  assert.ok(auditSrc.includes('[entry, ...readLocalAuditLog()]'), 'newest entries go first');
  assert.ok(
    auditSrc.includes("ContentEntityType | 'auth' | 'role'"),
    'entityType must accept content entities plus auth/role'
  );
});

test('auditLog writes localStorage first, then a guarded best-effort cloud copy', () => {
  const localIdx = auditSrc.indexOf('localStorage.setItem(AUDIT_LOCAL_KEY');
  const guardIdx = auditSrc.indexOf('if (isSupabaseConfigured && supabase)');
  const insertIdx = auditSrc.indexOf(".from('audit_log')");
  assert.ok(localIdx >= 0, 'must write the local trail');
  assert.ok(guardIdx >= 0, 'must guard the cloud copy on isSupabaseConfigured');
  assert.ok(insertIdx >= 0, 'must insert into audit_log');
  assert.ok(localIdx < insertIdx, 'local write must come before the cloud insert');
  assert.ok(guardIdx < insertIdx, 'cloud insert must be inside the configured guard');
  assert.ok(auditSrc.includes('recordWriteOutcome'), 'cloud write must record its outcome');
  assert.ok(auditSrc.includes('recordWriteError'), 'network failures must be recorded');
});

test('auditLog supports entity/actor/text/limit filters', () => {
  const seg = sliceBetween(auditSrc, 'export function listAuditLog', 'export function clearLocalAuditLog');
  assert.ok(seg.includes('filter.entityType'), 'filter by entityType');
  assert.ok(seg.includes('filter.actorId'), 'filter by actorId');
  assert.ok(seg.includes('filter.q'), 'full-text-ish filter');
  assert.ok(seg.includes('filter.limit'), 'limit support');
});

// ---------------------------------------------------------------------------
// 4. No fire-and-forget empty then-callbacks in the new CMS files
// ---------------------------------------------------------------------------
test('new CMS files contain no fire-and-forget empty then-callbacks', () => {
  for (const rel of ['src/types/content.ts', 'src/lib/contentAdmin.ts', 'src/lib/auditLog.ts']) {
    const src = read(rel);
    assert.doesNotMatch(
      src,
      /\.then\(\(\)\s*=>\s*\{\s*\}\)/,
      `${rel} must not swallow writes with an empty then callback`
    );
  }
});

// ---------------------------------------------------------------------------
// 5. package.json — test:cms registered, existing test script untouched
// ---------------------------------------------------------------------------
test('package.json registers the test:cms script and keeps the existing test script', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.scripts['test:cms'], 'node --test tests/cms.test.mjs');
  assert.equal(pkg.scripts.test, 'node --test tests/phase3.test.mjs tests/phase4.test.mjs');
});
