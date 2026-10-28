/**
 * Devotionals CMS, Bible Reference Picker, and Bulk Upload Test Suite
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8')
}

const mockDataSrc = read('src/data/mockDevotionalHymnData.ts')
const managerSrc = read('src/components/admin/ContentTypeManager.tsx')
const editorSrc = read('src/components/admin/ContentEditorDialog.tsx')
const bulkDialogSrc = read('src/components/admin/BulkDevotionalDialog.tsx')
const pickerSrc = read('src/components/admin/BibleReferencePicker.tsx')
const csvParserSrc = read('src/lib/csvParser.ts')
const bibleServiceSrc = read('src/lib/bibleService.ts')
const contentAdminSrc = read('src/lib/contentAdmin.ts')
const devotionalPageSrc = read('src/pages/Devotional.tsx')
const homePageSrc = read('src/pages/Home.tsx')

test('mockDevotionalHymnData does not seed fake mock devotionals', () => {
  // buildSeedDevotionals must return an empty array []
  assert.match(mockDataSrc, /function buildSeedDevotionals\(\): DevotionalEntry\[\]\s*\{\s*\/\/[^\n]*\s*return \[\]\s*\}/)
  // getDevotionals reads CMS devotionals configured by admin
  assert.match(mockDataSrc, /function loadCmsDevotionals\(\): DevotionalEntry\[\]/)
  assert.match(mockDataSrc, /localStorage\.getItem\('cms_devotionals_v1'\)/)
})

test('contentAdmin exports bulkCreateContent for devotional bulk upload', () => {
  assert.match(contentAdminSrc, /export function bulkCreateContent<K extends ContentEntityType>/)
  assert.match(contentAdminSrc, /takenSlugs\.add\(slug\)/)
  assert.match(contentAdminSrc, /cms:content-changed/)
})

test('csvParser exports parseDevotionalsCsv and generateDevotionalsTemplateCsv', () => {
  assert.match(csvParserSrc, /export function parseDevotionalsCsv\(csvText: string\): ParseDevotionalsResult/)
  assert.match(csvParserSrc, /export function generateDevotionalsTemplateCsv\(\): string/)
  assert.match(csvParserSrc, /'date',\s*'title',\s*'verse_ref',\s*'verse_text'/)
})

test('bibleService exports BIBLE_BOOKS, parseBibleRef, formatBibleRef, and fetchVerseText', () => {
  assert.match(bibleServiceSrc, /export const BIBLE_BOOKS: BibleBookMeta\[\]/)
  assert.match(bibleServiceSrc, /export function parseBibleRef\(rawRef: string\)/)
  assert.match(bibleServiceSrc, /export function formatBibleRef\(/)
  assert.match(bibleServiceSrc, /export async function fetchVerseText\(/)
  assert.match(bibleServiceSrc, /https:\/\/bible-api\.com/)
})

test('ContentTypeManager includes Bulk Upload button and BulkDevotionalDialog for devotionals', () => {
  assert.match(managerSrc, /import \{ BulkDevotionalDialog \} from '@\/components\/admin\/BulkDevotionalDialog'/)
  assert.match(managerSrc, /type === 'devotional' && canCreate/)
  assert.match(managerSrc, /<Upload className="w-3\.5 h-3\.5" \/> Bulk Upload/)
  assert.match(managerSrc, /<BulkDevotionalDialog/)
})

test('ContentEditorDialog integrates BibleReferencePicker for structured Scripture reference selection', () => {
  assert.match(editorSrc, /import \{ BibleReferencePicker \} from '@\/components\/admin\/BibleReferencePicker'/)
  assert.match(editorSrc, /<BibleReferencePicker/)
  assert.match(editorSrc, /onVerseTextFetched=\{\(text\) => set\('verse_text', text\)\}/)
})

test('DevotionalDetail allows users to dynamically switch and load Bible translations', () => {
  const detailSrc = read('src/components/devotional/DevotionalDetail.tsx')
  assert.match(detailSrc, /import \{ fetchVerseText \} from '@\/lib\/bibleService'/)
  assert.match(detailSrc, /fetchVerseText\(entry\.scriptureRef, version\)/)
  assert.match(detailSrc, /Loading \{BIBLE_VERSION_LABELS\[version\]\} translation/)
})

test('Devotional page and Home page render only admin-configured devotionals and handle empty states', () => {
  assert.match(devotionalPageSrc, /No devotionals scheduled for \{month\} \{year\}/)
  assert.match(devotionalPageSrc, /toast\.info\('No devotional has been published for today yet\.'\)/)
  assert.match(homePageSrc, /No devotional scheduled for today/)
})
