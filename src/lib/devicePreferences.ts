import { getSavedFontStyle, type ReadingFontStyleId } from '@/lib/readingFonts'

const KEEP_SCREEN_ON_KEY = 'believers_keep_screen_on_v1'
const DEFAULT_FONT_SIZE_KEY = 'reading_font_size_v1'
const DEFAULT_FONT_STYLE_KEY = 'reading_font_style_v1'

export function getDeviceFontStyle(): ReadingFontStyleId {
  return getSavedFontStyle(
    DEFAULT_FONT_STYLE_KEY,
    getSavedFontStyle('devotional_font_style', 'serif')
  )
}

export function setDeviceFontStyle(style: ReadingFontStyleId): void {
  try {
    localStorage.setItem(DEFAULT_FONT_STYLE_KEY, style)
    localStorage.setItem('devotional_font_style', style)
    localStorage.setItem('hymn_font_style', style)
    localStorage.setItem('bible_font_style', style)
  } catch {
    /* ignore storage errors */
  }
}

export function getDeviceFontSize(): number {
  try {
    const raw =
      localStorage.getItem(DEFAULT_FONT_SIZE_KEY) ??
      localStorage.getItem('devotional_font_size') ??
      localStorage.getItem('hymn_font_size')
    const n = Number(raw)
    return Number.isFinite(n) && n >= 14 && n <= 26 ? n : 17
  } catch {
    return 17
  }
}

export function setDeviceFontSize(size: number): void {
  const clamped = Math.max(14, Math.min(26, Math.round(size)))
  try {
    localStorage.setItem(DEFAULT_FONT_SIZE_KEY, String(clamped))
    localStorage.setItem('devotional_font_size', String(clamped))
    localStorage.setItem('hymn_font_size', String(clamped))
  } catch {
    /* ignore storage errors */
  }
}

export function getKeepScreenOn(): boolean {
  try {
    return localStorage.getItem(KEEP_SCREEN_ON_KEY) === 'true'
  } catch {
    return false
  }
}

export function setKeepScreenOn(enabled: boolean): void {
  try {
    localStorage.setItem(KEEP_SCREEN_ON_KEY, enabled ? 'true' : 'false')
    window.dispatchEvent(new CustomEvent('believers:keep-screen-on', { detail: enabled }))
  } catch {
    /* ignore storage errors */
  }
}

export function isWakeLockSupported(): boolean {
  return typeof navigator !== 'undefined' && 'wakeLock' in navigator
}
