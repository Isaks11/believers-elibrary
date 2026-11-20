import { getHymns } from '@/data/mockDevotionalHymnData'
import type { HymnRecord } from '@/types/content'

export interface HymnNumberConflict {
  id: string
  title: string
  source: 'built-in' | 'library'
}

/**
 * Separates an inline `Tune: ...` or `Tune by ...` suffix from a hymn title so
 * the tune is never mistaken for part of the hymn title.
 */
export function splitHymnTitleAndTune(
  rawTitle: string,
  explicitTune?: string | null
): { title: string; tune: string | null } {
  const trimmedTitle = (rawTitle || '').trim()
  const cleanExplicit = typeof explicitTune === 'string' && explicitTune.trim() ? explicitTune.trim() : null

  const match = trimmedTitle.match(/^(.*?)\s+Tune(?:\s*[:\-]\s*|\s+(?=by\b))(.+)$/i)
  if (!match) {
    return { title: trimmedTitle, tune: cleanExplicit }
  }

  const title = match[1].trim() || trimmedTitle
  const extractedTune = match[2].trim() || null
  return {
    title,
    tune: cleanExplicit ?? extractedTune,
  }
}

/**
 * Checks whether a positive hymn number is already assigned to a built-in or
 * CMS library hymn (excluding `excludeCmsId` when editing an existing record).
 */
export function findHymnNumberConflict(
  hymnNumber: number | null | undefined,
  cmsHymns: HymnRecord[],
  excludeCmsId?: string | null
): HymnNumberConflict | null {
  if (typeof hymnNumber !== 'number' || !Number.isFinite(hymnNumber) || hymnNumber <= 0) {
    return null
  }
  const normalized = Math.floor(hymnNumber)

  for (const builtIn of getHymns()) {
    if (builtIn.number === normalized) {
      return { id: builtIn.id, title: builtIn.title, source: 'built-in' }
    }
  }

  for (const row of cmsHymns) {
    if (excludeCmsId && row.id === excludeCmsId) continue
    if (typeof row.number === 'number' && row.number === normalized) {
      const { title } = splitHymnTitleAndTune(row.title, row.tune)
      return { id: row.id, title, source: 'library' }
    }
  }

  return null
}

/**
 * Returns the next unused positive hymn number across built-in and CMS hymns.
 */
export function getNextAvailableHymnNumber(cmsHymns: HymnRecord[]): number {
  let maxNumber = 0
  for (const builtIn of getHymns()) {
    if (typeof builtIn.number === 'number' && builtIn.number > maxNumber) {
      maxNumber = builtIn.number
    }
  }
  for (const row of cmsHymns) {
    if (typeof row.number === 'number' && Number.isFinite(row.number) && row.number > maxNumber) {
      maxNumber = row.number
    }
  }
  return maxNumber + 1
}
