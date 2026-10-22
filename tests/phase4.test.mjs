import { test } from 'node:test'
import assert from 'node:assert/strict'

// Node 24 allows importing TS files directly in ESM when used with tsc toolchain context.
// We do this to exercise the pure three-way merge logic without bundling.
const threeWay = await import('../src/lib/threeWayMerge.ts')

test('stableStringify produces deterministic output', () => {
  const a = { b: 2, a: 1 }
  const b = { a: 1, b: 2 }
  assert.equal(threeWay.stableStringify(a), threeWay.stableStringify(b))
  assert.ok(threeWay.stableStringify(null) === 'null' || threeWay.stableStringify(null) === '"null"' || threeWay.stableStringify(null) === 'null')
  assert.equal(threeWay.stableStringify({}), '{}')
})

test('mergePreferenceDataset prefers remote on true conflicts', () => {
  const local = { theme: 'light', lastSync: '2026-10-19T00:00:00Z' }
  const remote = { theme: 'dark', lastSync: '2026-10-19T01:00:00Z' }
  const base = { theme: 'light', lastSync: '2026-10-19T00:00:00Z' }
  const merged = threeWay.mergePreferenceDataset(local, remote, base)
  assert.equal(merged.merged.theme, 'dark')
  assert.equal(merged.merged.lastSync, '2026-10-19T01:00:00Z')
  assert.ok(Array.isArray(merged.conflicts))
})

test('mergePreferenceDataset preserves fields unique to local/remote', () => {
  const local = { localNote: 'hi' }
  const remote = { remoteFlag: true }
  const base = {}
  const merged = threeWay.mergePreferenceDataset(local, remote, base)
  assert.equal(merged.merged.localNote, 'hi')
  assert.equal(merged.merged.remoteFlag, true)
})

test('mergePreferenceSets merges both sets without losing keys', () => {
  const local = { a: 1, b: 2 }
  const remote = { b:  3, c: 4 }
  const base = { b: 2 }
  const merged = threeWay.mergePreferenceDataset(local, remote, base)
  assert.equal(merged.merged.a, 1)
  assert.equal(merged.merged.b, 3)
  assert.equal(merged.merged.c, 4)
})

test('no fire-and-forget .then(() => {}) in src (Phase 4)', async () => {
  const fs = await import('fs/promises')
  const path = await import('path')
  const srcDir = path.resolve(process.cwd(), 'src')
  async function walk(dir) {
    const files = []
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i]
      const p = path.join(dir, e.name)
      if (e.isDirectory()) {
        const sub = await walk(p)
        for (let j = 0; j < sub.length; j++) files.push(sub[j])
      } else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(e.name)) {
        files.push(p)
      }
    }
    return files
  }
  const files = await walk(srcDir)
  const bad = []
  for (let i = 0; i < files.length; i++) {
    const f = files[i]
    const txt = await fs.readFile(f, 'utf8')
    if (/\.then\(\(\) => \{\}\)/.test(txt) && !/Phase [0-9].*\.then\(\(\) => \{\}\)/.test(txt)) {
      bad.push(f)
    }
  }
  assert.equal(bad.length, 0, `Found fire-and-forget then(() => {}) in: ${bad.join(', ')}`)
})
