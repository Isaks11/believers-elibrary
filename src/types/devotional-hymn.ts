export type BibleVersion = 'KJV' | 'WEB' | 'BBE' | 'ASV' | 'ESV'

export interface DevotionalEntry {
  id: string
  year: number
  month: string
  day: number
  dayOfWeek: string
  title: string
  theme: string
  scriptureRef: string
  bibleVersions: Partial<Record<BibleVersion, string>>
  mainBody: string
  keyThought: string
  prayer: string
  prayerPoints: string[]
  author: string
  audioUrl?: string
  readTimeMinutes: number
  tags: string[]
  isCompleted?: boolean
  isBookmarked?: boolean
}

export interface Hymn {
  id: string
  number: number
  title: string
  category: string
  author: string
  yearWritten?: string
  tuneName?: string
  keySignature?: string
  meter?: string
  stanzas: string[]
  chorus?: string
  audioUrl?: string
  isFavorite?: boolean
}

export const BIBLE_VERSIONS: BibleVersion[] = ['KJV', 'WEB', 'BBE', 'ASV', 'ESV']
export const BIBLE_VERSION_LABELS: Record<BibleVersion, string> = {
  KJV: 'King James Version',
  WEB: 'World English Bible',
  BBE: 'Bible in Basic English',
  ASV: 'American Standard Version',
  ESV: 'English Standard Version',
}

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export const HYMN_CATEGORIES = ['Praise', 'Worship', 'Grace', 'Morning', 'Evening', 'Assurance', 'Easter', 'Thanksgiving', 'Faith', 'Christmas']

export const DEVOTIONAL_YEARS = [2024, 2025, 2026]