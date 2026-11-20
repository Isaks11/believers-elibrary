import { getHymns } from '@/data/mockDevotionalHymnData'
import type { HymnRecord } from '@/types/content'

export type HymnSectionType = 'hymn' | 'chorus'

export interface HymnNumberConflict {
  id: string
  title: string
  source: 'built-in' | 'library'
  sectionType: HymnSectionType
}

/**
 * Determines whether a CMS hymn record belongs to the `chorus` sub-section or
 * the main `hymn` section.
 */
export function getHymnSectionType(
  record: Pick<HymnRecord, 'hymn_type' | 'hymn_category' | 'category'>
): HymnSectionType {
  if (record.hymn_type === 'chorus') return 'chorus'
  if (record.hymn_type === 'hymn') return 'hymn'
  const cat = (record.hymn_category || record.category || '').trim().toLowerCase()
  return cat === 'chorus' ? 'chorus' : 'hymn'
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
 * Checks whether a positive hymn/chorus number is already assigned within the
 * same sub-section (`hymn` vs `chorus`), excluding `excludeCmsId` when editing.
 */
export function findHymnNumberConflict(
  hymnNumber: number | null | undefined,
  cmsHymns: HymnRecord[],
  excludeCmsId?: string | null,
  sectionType: HymnSectionType = 'hymn'
): HymnNumberConflict | null {
  if (typeof hymnNumber !== 'number' || !Number.isFinite(hymnNumber) || hymnNumber <= 0) {
    return null
  }
  const normalized = Math.floor(hymnNumber)

  if (sectionType === 'hymn') {
    for (const builtIn of getHymns()) {
      if ((builtIn.hymnType ?? 'hymn') === 'hymn' && builtIn.number === normalized) {
        return { id: builtIn.id, title: builtIn.title, source: 'built-in', sectionType: 'hymn' }
      }
    }
  }

  for (const row of cmsHymns) {
    if (excludeCmsId && row.id === excludeCmsId) continue
    const rowSection = getHymnSectionType(row)
    if (rowSection !== sectionType) continue
    if (typeof row.number === 'number' && row.number === normalized) {
      const { title } = splitHymnTitleAndTune(row.title, row.tune)
      return { id: row.id, title, source: 'library', sectionType: rowSection }
    }
  }

  return null
}

/**
 * Returns the next unused positive number within the specified sub-section
 * (`hymn` or `chorus`).
 */
export function getNextAvailableHymnNumber(
  cmsHymns: HymnRecord[],
  sectionType: HymnSectionType = 'hymn'
): number {
  let maxNumber = 0
  if (sectionType === 'hymn') {
    for (const builtIn of getHymns()) {
      if ((builtIn.hymnType ?? 'hymn') === 'hymn' && typeof builtIn.number === 'number' && builtIn.number > maxNumber) {
        maxNumber = builtIn.number
      }
    }
  }
  for (const row of cmsHymns) {
    if (getHymnSectionType(row) !== sectionType) continue
    if (typeof row.number === 'number' && Number.isFinite(row.number) && row.number > maxNumber) {
      maxNumber = row.number
    }
  }
  return maxNumber + 1
}
