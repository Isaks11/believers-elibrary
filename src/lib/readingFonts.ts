export const READING_FONT_STYLES = [
  {
    id: 'serif',
    label: 'Classic Serif',
    family: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
  },
  {
    id: 'editorial',
    label: 'Editorial',
    family: '"Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif',
  },
  {
    id: 'bookish',
    label: 'Bookish',
    family: 'Garamond, "Baskerville Old Face", "Times New Roman", serif',
  },
  {
    id: 'sans',
    label: 'Modern Sans',
    family: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  {
    id: 'readable',
    label: 'Readable',
    family: '"Trebuchet MS", "Segoe UI", Verdana, sans-serif',
  },
  {
    id: 'soft',
    label: 'Soft Sans',
    family: '"Gill Sans", "Segoe UI", Candara, Calibri, sans-serif',
  },
  {
    id: 'warm',
    label: 'Warm',
    family: 'ui-rounded, "Arial Rounded MT", Calibri, system-ui, sans-serif',
  },
  {
    id: 'slab',
    label: 'Slab',
    family: 'Rockwell, "Roboto Slab", Georgia, serif',
  },
  {
    id: 'mono',
    label: 'Typewriter',
    family: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
] as const

export type ReadingFontStyleId = (typeof READING_FONT_STYLES)[number]['id']

export function getSavedFontStyle(storageKey: string, fallback: ReadingFontStyleId = 'serif'): ReadingFontStyleId {
  try {
    const v = localStorage.getItem(storageKey) as ReadingFontStyleId | null
    return READING_FONT_STYLES.some((s) => s.id === v) ? (v as ReadingFontStyleId) : fallback
  } catch {
    return fallback
  }
}

export function getFontFamily(id: ReadingFontStyleId): string {
  return READING_FONT_STYLES.find((s) => s.id === id)?.family || READING_FONT_STYLES[0].family
}
