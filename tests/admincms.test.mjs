/**
 * Admin CMS Verification Suite (`tests/admincms.test.mjs`)
 *
 * Source-level assertions (no DOM, no bundler) covering:
 * 1. `src/lib/permissions.ts` — the real 5-role matrix. The module is
 *    dependency-free, so it is transpiled with TypeScript and imported
 *    directly to assert `can()` behaviour rather than regex-matching it.
 * 2. `src/pages/Admin.tsx` — home stats/section grid, local-state section
 *    router and `can()` gating for Users & Roles / Audit Log.
 * 3. `src/components/admin/ContentTypeManager.tsx` — listContent wiring,
 *    status filters, pagination, schedule pseudo-filter and per-action gates.
 * 4. `src/components/admin/ContentEditorDialog.tsx` — create/edit/publish/
 *    schedule gating and revision history integration.
 * 5. `src/contexts/AuthContext.tsx` — 5-role normalization + raw registry
 *    read/write helpers.
 * 6. `src/App.tsx` — admin guard accepts admin + super_admin.
 * 7. `src/components/admin/AuditLogView.tsx` + `UserRolePanel.tsx` — audit
 *    viewer and role-management safety (no privilege escalation).
 * 8. `package.json` registers `test:admincms` without altering other scripts.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'node:test';
import ts from 'typescript';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function sliceBetween(src, start, end) {
  const i = src.indexOf(start);
  assert.ok(i >= 0, `missing marker: ${start}`);
  const j = end ? src.indexOf(end, i + start.length) : src.length;
  assert.ok(j > i, `missing marker after ${start}: ${end}`);
  return src.slice(i, j);
}

/** Transpiles the dependency-free permissions module and imports it. */
async function loadPermissions(t) {
  const source = read('src/lib/permissions.ts');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: 'permissions.ts',
  }).outputText;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'admincms-perms-'));
  const file = path.join(dir, 'permissions.mjs');
  fs.writeFileSync(file, output, 'utf8');
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return import(pathToFileURL(file).href);
}

const adminSrc = read('src/pages/Admin.tsx');
const managerSrc = read('src/components/admin/ContentTypeManager.tsx');
const editorSrc = read('src/components/admin/ContentEditorDialog.tsx');
const authSrc = read('src/contexts/AuthContext.tsx');
const appSrc = read('src/App.tsx');
const auditViewSrc = read('src/components/admin/AuditLogView.tsx');
const userPanelSrc = read('src/components/admin/UserRolePanel.tsx');
const revisionsSrc = read('src/components/admin/RevisionHistoryDialog.tsx');

// ---------------------------------------------------------------------------
// 1. src/lib/permissions.ts — authoritative matrix (executed, not pattern-matched)
// ---------------------------------------------------------------------------
test('permissions.ts implements the exact five-role matrix', async (t) => {
  const { can, PERMISSION_ACTIONS } = await loadPermissions(t);

  assert.deepEqual(PERMISSION_ACTIONS.slice().sort(), [
    'analytics:view',
    'audit:view',
    'content:archive',
    'content:create',
    'content:delete',
    'content:edit',
    'content:publish',
    'content:schedule',
    'moderation:manage',
    'roles:manage',
    'settings:manage',
    'users:manage',
  ]);

  const allowed = (role) => PERMISSION_ACTIONS.filter((action) => can(role, action)).sort();

  assert.deepEqual(allowed('user'), [], 'user has no CMS permissions');
  assert.deepEqual(allowed('contributor'), ['content:create', 'content:edit'], 'contributor creates/edits only');
  assert.deepEqual(
    allowed('editor'),
    [
      'analytics:view',
      'content:archive',
      'content:create',
      'content:edit',
      'content:publish',
      'content:schedule',
    ],
    'editor adds publish/schedule/archive/analytics'
  );
  assert.deepEqual(
    allowed('admin'),
    [
      'analytics:view',
      'audit:view',
      'content:archive',
      'content:create',
      'content:delete',
      'content:edit',
      'content:publish',
      'content:schedule',
      'moderation:manage',
      'users:manage',
    ],
    'admin adds delete/users/moderation/audit'
  );
  assert.deepEqual(allowed('super_admin'), PERMISSION_ACTIONS.slice().sort(), 'super_admin has everything');

  // Sensitive boundaries called out explicitly.
  assert.equal(can('contributor', 'content:publish'), false);
  assert.equal(can('contributor', 'content:delete'), false);
  assert.equal(can('editor', 'content:delete'), false);
  assert.equal(can('editor', 'users:manage'), false);
  assert.equal(can('admin', 'roles:manage'), false);
  assert.equal(can('admin', 'settings:manage'), false);
  assert.equal(can('super_admin', 'roles:manage'), true);
  assert.equal(can('super_admin', 'settings:manage'), true);

  // Safe defaults for missing/unknown roles.
  assert.equal(can(undefined, 'content:edit'), false);
  assert.equal(can(null, 'content:edit'), false);
  assert.equal(can('owner', 'content:edit'), false);
});

test('permissions.ts exposes role order, labels and normalization helpers', async (t) => {
  const { ROLE_ORDER, ROLE_LABELS, isUserRole, normalizeRole, isHigherRole } = await loadPermissions(t);

  assert.deepEqual(ROLE_ORDER, ['user', 'contributor', 'editor', 'admin', 'super_admin']);
  assert.equal(ROLE_LABELS.super_admin, 'Super Administrator');
  assert.equal(ROLE_LABELS.contributor, 'Ministry Contributor');

  assert.equal(isUserRole('editor'), true);
  assert.equal(isUserRole('owner'), false);
  assert.equal(isUserRole(undefined), false);

  assert.equal(normalizeRole('admin'), 'admin');
  assert.equal(normalizeRole('legacy-garbage'), 'user', 'unknown roles fall back to user');
  assert.equal(normalizeRole(undefined), 'user');
  assert.equal(normalizeRole(null, 'admin'), 'admin', 'fallback is configurable');

  assert.equal(isHigherRole('super_admin', 'admin'), true);
  assert.equal(isHigherRole('admin', 'editor'), true);
  assert.equal(isHigherRole('editor', 'admin'), false);
  assert.equal(isHigherRole('admin', 'admin'), false);
});

// ---------------------------------------------------------------------------
// 2. src/pages/Admin.tsx — dashboard + section router
// ---------------------------------------------------------------------------
test('Admin.tsx registers all eleven CMS sections and gates users/audit by can()', () => {
  const sectionSeg = sliceBetween(adminSrc, 'const SECTIONS: SectionDef[]', 'type Counts');
  for (const key of [
    'devotional',
    'reading_plan',
    'hymn',
    'video',
    'faith_resource',
    'library',
    'prayers',
    'news',
    'moderation',
    'users',
    'audit',
  ]) {
    assert.ok(sectionSeg.includes(`key: '${key}'`), `section grid must include ${key}`);
  }
  assert.match(sectionSeg, /key: 'users',[^\n]*action: 'users:manage'/);
  assert.match(sectionSeg, /key: 'audit',[^\n]*action: 'audit:view'/);

  assert.ok(adminSrc.includes('SECTIONS.filter((s) => !s.action || can(role, s.action))'), 'sections filtered by can()');
  assert.ok(adminSrc.includes('Some sections are hidden because your role lacks the required permission.'));
});

test('Admin.tsx uses real stats, a local-state router and the CMS manager', () => {
  assert.ok(adminSrc.includes('getLibraryItems().length'), 'library count from the store');
  assert.ok(adminSrc.includes("getPrayerAlerts().filter((a) => a.status === 'active').length"), 'active alert count');
  assert.ok(adminSrc.includes('getNewsItems().length'), 'news count');
  assert.ok(adminSrc.includes("getModerationReports().filter((r) => r.status === 'pending').length"), 'pending report count');
  assert.ok(adminSrc.includes('listAuditLog({ limit: 500 }).length'), 'audit count from listAuditLog');
  assert.ok(adminSrc.includes('listContent(type, { pageSize: 1 })'), 'CMS counts from listContent totals');
  assert.ok(adminSrc.includes('CMS_TYPES.reduce'), 'CMS total is derived, not hard-coded');

  assert.ok(adminSrc.includes('const [activeSection, setActiveSection] = useState<SectionKey | null>(null)'), 'local-state router');
  assert.ok(adminSrc.includes('setActiveSection(section.key)'), 'grid opens a section');
  assert.ok(adminSrc.includes('setActiveSection(null)'), 'back button returns home');
  assert.ok(adminSrc.includes('<ContentTypeManager type={activeSection}'), 'CMS types render ContentTypeManager');
  assert.ok(adminSrc.includes('<LibrarySection onChanged={refreshCounts} />'));
  assert.ok(adminSrc.includes('<PrayerSection onChanged={refreshCounts} />'));
  assert.ok(adminSrc.includes('<NewsSection onChanged={refreshCounts} />'));
  assert.ok(adminSrc.includes('<ModerationSection onChanged={refreshCounts} />'));
  assert.ok(adminSrc.includes('<UserRolePanel />'));
  assert.ok(adminSrc.includes('<AuditLogView />'));
  assert.ok(adminSrc.includes('ROLE_LABELS[(role as UserRole) ?? \'user\']'), 'role label in the header');
});

// ---------------------------------------------------------------------------
// 3. src/components/admin/ContentTypeManager.tsx
// ---------------------------------------------------------------------------
test('ContentTypeManager wires listContent, status filters and pagination', () => {
  assert.ok(managerSrc.includes("import { listContent, isScheduled, setStatus, deleteContent, type ContentSort } from '@/lib/contentAdmin'"));
  assert.ok(managerSrc.includes('const PAGE_SIZE = 10'));
  assert.match(managerSrc, /const STATUS_FILTERS = \['all', 'draft', 'published', 'scheduled', 'archived'\] as const/);
  assert.ok(managerSrc.includes('await listContent(type, { ...opts, status: \'published\', page: 1, pageSize: 100 })'), 'scheduled pseudo-filter');
  assert.ok(managerSrc.includes('res.rows.filter((row) => isScheduled(row))'), 'scheduled rows narrowed locally');
  assert.ok(managerSrc.includes('status: statusFilter as ContentStatus | \'all\''), 'status filter forwarded');
  assert.ok(managerSrc.includes('page,'), 'page forwarded');
  assert.ok(managerSrc.includes('pageSize: PAGE_SIZE'), 'page size forwarded');
  assert.ok(managerSrc.includes('const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))'));
  assert.match(managerSrc, /\{rangeStart\}–\{rangeEnd\} of \{total\}/);
  assert.ok(managerSrc.includes('setPage((p) => Math.max(1, p - 1))'));
  assert.ok(managerSrc.includes('setPage((p) => p + 1)'));
});

test('ContentTypeManager gates every row action and protects published deletes', () => {
  for (const gate of [
    "guard('content:publish'",
    "guard('content:archive'",
    "guard('content:schedule'",
    "guard('content:edit'",
    "guard('content:create'",
  ]) {
    assert.ok(managerSrc.includes(gate), `row action must call ${gate}`);
  }
  assert.ok(managerSrc.includes("const canDelete = can(role, 'content:delete')"), 'delete gated by can()');
  assert.ok(managerSrc.includes('const deleteAllowed = row.status !== \'published\''), 'published rows cannot be deleted');
  assert.ok(managerSrc.includes('title={deleteAllowed ? undefined : \'Archive first\'}'), 'archive-first hint');
  assert.ok(managerSrc.includes('<ContentEditorDialog'), 'editor dialog wired');
  assert.ok(managerSrc.includes('onChanged={handleEditorChanged}'), 'list refreshes after edits');
});

// ---------------------------------------------------------------------------
// 4. src/components/admin/ContentEditorDialog.tsx
// ---------------------------------------------------------------------------
test('ContentEditorDialog gates create/edit/publish/schedule independently', () => {
  for (const gate of [
    "can(role, 'content:create')",
    "can(role, 'content:edit')",
    "can(role, 'content:publish')",
    "can(role, 'content:schedule')",
    "can(role, 'content:archive')",
  ]) {
    assert.ok(editorSrc.includes(gate), `editor must evaluate ${gate}`);
  }
  assert.ok(editorSrc.includes("toast.error('Your role cannot publish content')"));
  assert.ok(editorSrc.includes("toast.error('Your role cannot schedule content')"));
  assert.ok(editorSrc.includes('Scheduled time must be in the future'));
  assert.ok(editorSrc.includes("type=\"datetime-local\""));
  assert.match(editorSrc, /disabled=\{record \? \(currentStatus === 'published' \? !canEdit : !canPublish\) : !canPublish\}/);
  assert.ok(editorSrc.includes('Your role can draft and edit, but publishing is limited to Editor and above'));
  assert.ok(editorSrc.includes('<RevisionHistoryDialog'), 'revision history wired');
});

test('RevisionHistoryDialog lists snapshots and gates restore by content:edit', () => {
  assert.ok(revisionsSrc.includes("import { listRevisions, restoreRevision } from '@/lib/contentAdmin'"));
  assert.ok(revisionsSrc.includes('setRevisions(await listRevisions(type, record.id))'));
  assert.ok(revisionsSrc.includes("if (!can(user?.role, 'content:edit'))"));
  assert.ok(revisionsSrc.includes('restoreRevision(type, record.id, version,'));
});

// ---------------------------------------------------------------------------
// 5. src/contexts/AuthContext.tsx — 5 roles + raw registry helpers
// ---------------------------------------------------------------------------
test('AuthContext resolves and persists all five roles safely', () => {
  assert.ok(authSrc.includes("import { normalizeRole, type UserRole } from '@/lib/permissions'"));
  assert.ok(authSrc.includes('export type { UserRole }'), 'UserRole is re-exported for legacy imports');
  assert.ok(authSrc.includes("const LOCAL_REGISTRY_KEY = 'believers_users'"));
  assert.ok(authSrc.includes('role: normalizeRole(data?.role, envRole)'), 'remote roles normalized');
  assert.ok(authSrc.includes('setUser({ ...parsed, role: normalizeRole(parsed.role, \'user\') } as User)'), 'stored session normalized');
  assert.ok(authSrc.includes('function readLocalRegistryRole'), 'raw registry read helper');
  assert.ok(authSrc.includes('function writeLocalRegistryRole'), 'raw registry write helper');
  assert.ok(authSrc.includes('function toRegistryRole'), 'registry narrowing helper');
  assert.ok(authSrc.includes("toRegistryRole(role: UserRole): 'user' | 'admin'"), 'legacy registry stays narrow');
  assert.ok(authSrc.includes('normalizeRole(existing.role'), 'local roles normalized');
  assert.ok(authSrc.includes('writeLocalRegistryRole'), 'updateProfile writes the role back');
});

// ---------------------------------------------------------------------------
// 6. src/App.tsx — guard
// ---------------------------------------------------------------------------
test('App.tsx lets content roles into /admin and redirects everyone else', () => {
  assert.ok(
    appSrc.includes("if (requireAdmin && !can(user.role, 'content:create')) return <AdminAccessDenied />;"),
    'the guard delegates to the permission matrix (contributor and above)'
  );
  assert.ok(appSrc.includes("import { can } from '@/lib/permissions'"), 'the guard uses the shared permission helper');
  assert.ok(appSrc.includes('AdminAccessDenied'), 'unauthorized users get the access-denied screen');
  // Ordinary users may not create content, so they can never pass the guard.
  assert.ok(!appSrc.includes("user.role !== 'super_admin') return <AdminAccessDenied />"), 'the legacy two-role guard is gone');
});

// ---------------------------------------------------------------------------
// 7. Audit viewer + Users & Roles panel
// ---------------------------------------------------------------------------
test('AuditLogView reads listAuditLog and is gated by audit:view', () => {
  assert.ok(auditViewSrc.includes("import { listAuditLog, type AuditEntry, type AuditEntityType } from '@/lib/auditLog'"));
  assert.ok(auditViewSrc.includes("const allowed = can(user?.role, 'audit:view')"));
  assert.ok(auditViewSrc.includes('if (!allowed)'), 'restricted state rendered without permission');
  assert.ok(auditViewSrc.includes('listAuditLog({ limit: 500 })'));
  assert.ok(auditViewSrc.includes('listAuditLog({'), 'filtered read');
  for (const filter of ['entityType:', 'actorId:', 'q:', 'limit: 100']) {
    assert.ok(auditViewSrc.includes(filter), `audit filter ${filter}`);
  }
  assert.ok(auditViewSrc.includes("Audit trail restricted"));
});

test('UserRolePanel prevents privilege escalation and audits role changes', () => {
  assert.ok(userPanelSrc.includes("const LOCAL_REGISTRY_KEY = 'believers_users'"));
  assert.ok(userPanelSrc.includes("const allowed = can(role, 'users:manage')"));
  assert.ok(userPanelSrc.includes('if (!allowed)'), 'restricted state');
  assert.ok(userPanelSrc.includes('isHigherRole(next, myRole)'), 'cannot grant above own role');
  assert.ok(userPanelSrc.includes("can(role, 'roles:manage')"), 'super_admin bypass for roles:manage');
  assert.ok(userPanelSrc.includes("recordAudit("));
  assert.ok(userPanelSrc.includes("'role_change'"));
  assert.ok(userPanelSrc.includes("'role'"));
  assert.ok(userPanelSrc.includes('ROLE_ORDER.map((r) => {'), 'all roles offered');
  assert.ok(userPanelSrc.includes('disabled={locked}'), 'higher roles disabled');
  assert.ok(userPanelSrc.includes('Cloud CMS — roles are server-managed.'), 'cloud mode is read-only');
  assert.ok(userPanelSrc.includes('<Table>'), 'cloud profiles rendered in a table');
});

// ---------------------------------------------------------------------------
// 8. package.json registration
// ---------------------------------------------------------------------------
test('package.json registers test:admincms and leaves existing scripts intact', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.scripts['test:admincms'], 'node --test tests/admincms.test.mjs');
  assert.equal(pkg.scripts.test, 'node --test tests/phase3.test.mjs tests/phase4.test.mjs');
  assert.equal(pkg.scripts['test:cms'], 'node --test tests/cms.test.mjs');
  assert.equal(pkg.scripts['test:notifications'], 'node --test tests/notifications.test.mjs');
});
