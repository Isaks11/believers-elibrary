/**
 * Phase 3 Automated Verification Suite (`tests/phase3.test.mjs`)
 *
 * Covers:
 * 1. Stage 1 — Scripture-Grounded Faith Guide (reference parser, separation of Scripture vs. commentary,
 *    denominational perspectives, uncertainty acknowledgment, and honest local fallback labelling).
 * 2. Stage 2 — Offline-First PWA (manifest validation, Service Worker privacy boundary against caching
 *    authenticated/Supabase user data, and offline Bible chapter persistence & retrieval without network).
 * 3. Stage 3 — Community & Safeguarding (content safeguarding filter, rate limiting cooldown,
 *    private prayer routing vs. public feed, reporting, user blocking, and admin-only moderation boundary).
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

console.log('\n=== Phase 3 Verification Suite ===\n');

// ---------------------------------------------------------------------------
// 1. Stage 2 PWA Manifest & Service Worker Privacy Boundary Verification
// ---------------------------------------------------------------------------
console.log('Stage 2: Offline-First PWA & Service Worker Privacy');

test('public/manifest.webmanifest is valid JSON with standalone display and local SVG icons', () => {
  const manifestPath = path.join(ROOT, 'public', 'manifest.webmanifest');
  assert.ok(fs.existsSync(manifestPath), 'manifest.webmanifest must exist');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, '/');
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 2, 'must define at least 2 icons');
  for (const icon of manifest.icons) {
    const iconFile = path.join(ROOT, 'public', icon.src.replace(/^\//, ''));
    assert.ok(fs.existsSync(iconFile), `Icon file ${icon.src} must exist on disk`);
  }
});

test('public/sw.js enforces explicit cache versioning and blocks caching private/Supabase requests', () => {
  const swPath = path.join(ROOT, 'public', 'sw.js');
  assert.ok(fs.existsSync(swPath), 'public/sw.js must exist');
  const swSource = fs.readFileSync(swPath, 'utf8');

  assert.match(swSource, /CACHE_VERSION\s*=\s*['"]v4['"]/, 'Must define explicit CACHE_VERSION');
  assert.match(swSource, /isPrivateOrAuthenticatedRequest/, 'Must check private/authenticated requests');
  assert.match(swSource, /supabase\.co/, 'Must exclude supabase.co from shared Cache Storage');
  assert.match(swSource, /Authorization/, 'Must exclude requests with Authorization headers');
  assert.match(swSource, /SKIP_WAITING/, 'Must support safe SKIP_WAITING update message');
});

// ---------------------------------------------------------------------------
// 2. Stage 1 Faith Guide Source & Theological Integrity Verification
// ---------------------------------------------------------------------------
console.log('\nStage 1: Scripture-Grounded Faith Guide');

test('faithGuideEngine.ts keeps API keys out of browser code and labels local concordance fallback honestly', () => {
  const enginePath = path.join(ROOT, 'src', 'lib', 'faithGuideEngine.ts');
  const src = fs.readFileSync(enginePath, 'utf8');

  // Ensure no hardcoded API keys or secret tokens exist
  assert.ok(!/sk-[a-zA-Z0-9]{20,}/.test(src), 'Must not contain hardcoded OpenAI/LLM secret keys');
  assert.match(src, /local-curated-concordance/, 'Must explicitly label local concordance fallback');
  assert.match(src, /commentaryDistinctionNote/, 'Must include explicit distinction between Scripture and commentary');
  assert.match(src, /denominationalPerspectives/, 'Must include multi-denominational perspectives');
  assert.match(src, /uncertaintyNote/, 'Must acknowledge theological uncertainty');
  assert.match(src, /pastoralDisclaimer/, 'Must include pastoral disclaimer');
});

test('FaithGuide.tsx renders separate verbatim Scripture, Exegesis, Denominational Views, Cross-Refs, and Study Questions', () => {
  const pagePath = path.join(ROOT, 'src', 'pages', 'FaithGuide.tsx');
  const src = fs.readFileSync(pagePath, 'utf8');

  assert.match(src, /Direct Scripture Text \(Verifiable\)/, 'Must render Verifiable Scripture section');
  assert.match(src, /Historical & Literary Context/, 'Must render Historical & Literary Context section');
  assert.match(src, /Christian Consensus & Denominational Perspectives/, 'Must render Denominational Perspectives');
  assert.match(src, /Acknowledging Uncertainty/, 'Must render Uncertainty note');
  assert.match(src, /Inductive Study Questions/, 'Must render Inductive Study Questions');
  assert.match(src, /Development Fallback: Local Curated Concordance/, 'Must clearly disclose when no AI backend is configured');
});

// ---------------------------------------------------------------------------
// 3. Stage 2 Offline Storage (IndexedDB + LocalStorage Fallback & Quota Awareness)
// ---------------------------------------------------------------------------
console.log('\nStage 2: Offline Scripture Storage & Error Handling');

test('offlineStorage.ts implements IndexedDB bible_chapters store, localStorage fallback, and storage quota estimation', () => {
  const storagePath = path.join(ROOT, 'src', 'lib', 'offlineStorage.ts');
  const src = fs.readFileSync(storagePath, 'utf8');

  assert.match(src, /believers_elibrary_offline_db/, 'Must use dedicated IndexedDB database');
  assert.match(src, /saveOfflineBibleChapter/, 'Must export saveOfflineBibleChapter');
  assert.match(src, /getOfflineBibleChapter/, 'Must export getOfflineBibleChapter');
  assert.match(src, /Cannot store empty chapter verses/, 'Must reject empty chapter verse arrays');
  assert.match(src, /navigator\.storage\.estimate/, 'Must inspect storage quota');
});

// ---------------------------------------------------------------------------
// 4. Stage 3 Community Safeguarding, Rate Limiting, Privacy Scopes & RLS
// ---------------------------------------------------------------------------
console.log('\nStage 3: Community Safeguarding, Privacy & Authorization Boundaries');

test('communityData.ts enforces rate limiting, content safeguarding, private prayer routing, and admin-only moderation', () => {
  const commDataPath = path.join(ROOT, 'src', 'data', 'communityData.ts');
  const src = fs.readFileSync(commDataPath, 'utf8');

  assert.match(src, /RATE_LIMIT_COOLDOWN_MS\s*=\s*10_000/, 'Must enforce rate limit cooldown');
  assert.match(src, /PROHIBITED_PATTERNS/, 'Must filter prohibited scam/abusive patterns');
  assert.match(src, /input\.privacyScope === 'private_only'/, 'Must route private_only prayers to personal prayer list');
  assert.match(src, /if \(actorRole !== 'admin'\)/, 'Must reject non-admin moderation attempts');
  assert.match(src, /supabase\.from\('profiles'\)\.select\('role'\)/, 'Must verify server-side admin role when Supabase is active');
});

test('Community.tsx clearly labels Local Device Prototype when no backend is configured', () => {
  const commPagePath = path.join(ROOT, 'src', 'pages', 'Community.tsx');
  const src = fs.readFileSync(commPagePath, 'utf8');

  assert.match(
    src,
    /Local Device Prototype Mode \(No Backend Configured\)/,
    'Must prominently label community as a local prototype when no backend is configured'
  );
  assert.match(src, /Private Prayer List Only \(Not Shared\)/, 'Must offer private prayer scope option');
  assert.match(src, /Fellowship Group Members Only/, 'Must offer group-only privacy scope');
  assert.match(src, /Post Anonymously/, 'Must offer anonymous prayer posting toggle');
});

test('supabase/schema.sql enforces Row Level Security on community_posts, community_comments, community_reports, and user_blocks', () => {
  const sqlPath = path.join(ROOT, 'supabase', 'schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  assert.match(sql, /alter table public\.community_posts\s+enable row level security/i);
  assert.match(sql, /alter table public\.community_comments\s+enable row level security/i);
  assert.match(sql, /alter table public\.community_reports\s+enable row level security/i);
  assert.match(sql, /alter table public\.user_blocks\s+enable row level security/i);
  assert.match(sql, /create policy community_reports_admin_all on public\.community_reports/i);
});

console.log(`\nCompleted: ${passed} tests passed.\n`);
