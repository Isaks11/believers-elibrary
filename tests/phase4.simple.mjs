import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs/promises'
import path from 'path'

test('no fire-and-forget .then(() => {}) in src (Phase 4)', async () => {
  const srcDir = path.resolve(process.cwd(), 'src')
  async function walk(dir) {
    const files = []
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i]
      const p = path.join(dir, e.name)
      if (e.isDirectory()) {
        files.push(...(await walk(p)))
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

test('phase4 keys exist and threeWayMerge exports', async () => {
  const threeWay = await import('../src/lib/threeWayMerge.ts')
  assert.equal(typeof threeWay.stableStringify, 'function')
  assert.equal(typeof threeWay.mergePreferenceDataset, 'function')
  assert.equal(typeof threeWay.mergePreferenceSets, 'function')
})
