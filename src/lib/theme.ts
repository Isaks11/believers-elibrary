/**
 * User-selectable accent theme + light/dark mode.
 *
 * Palettes live in `src/styles/theme.css`, applied through the
 * `data-accent-theme` attribute on <html>. Light/dark uses the same `.dark`
 * class convention as `src/index.css` (Tailwind v4 `@custom-variant dark`).
 *
 * Both choices persist in localStorage and apply instantly via
 * `document.documentElement`. `initTheme()` is called once from `main.tsx`
 * before the first render so there is no flash of the wrong palette.
 */

export type AccentThemeId =
  | 'default'
  | 'emerald'
  | 'royal'
  | 'rose'
  | 'amethyst'
  | 'sunset';

export interface AccentTheme {
  id: AccentThemeId;
  label: string;
  /** Plain CSS color string (the palette's light-mode primary) for the picker UI. */
  swatch: string;
  description: string;
}

/** Catalog shown in the ThemeSettings picker. `swatch` mirrors theme.css light primaries. */
export const ACCENT_THEMES: AccentTheme[] = [
  {
    id: 'default',
    label: 'Navy',
    swatch: 'oklch(0.2 0.08 260)',
    description: 'Classic navy, green and gold — the stock Believers Library colors.',
  },
  {
    id: 'emerald',
    label: 'Emerald',
    swatch: 'oklch(0.43 0.11 163)',
    description: 'Deep emerald greens with a soft mint highlight.',
  },
  {
    id: 'royal',
    label: 'Royal',
    swatch: 'oklch(0.32 0.12 265)',
    description: 'Royal blue with slate tones and a gold accent.',
  },
  {
    id: 'rose',
    label: 'Rose',
    swatch: 'oklch(0.5 0.17 12)',
    description: 'Raspberry rose with mauve and blush pink.',
  },
  {
    id: 'amethyst',
    label: 'Amethyst',
    swatch: 'oklch(0.43 0.15 300)',
    description: 'Rich amethyst purple with plum and lilac.',
  },
  {
    id: 'sunset',
    label: 'Sunset',
    swatch: 'oklch(0.55 0.15 45)',
    description: 'Warm orange with terracotta and peach.',
  },
];

export type ThemeMode = 'light' | 'dark' | 'system';

/** localStorage keys — bump the suffix if the stored shape ever changes. */
export const ACCENT_THEME_STORAGE_KEY = 'believers_accent_theme_v1';
export const THEME_MODE_STORAGE_KEY = 'believers_theme_mode_v1';

const DARK_MODE_CLASS = 'dark';
const ACCENT_ATTRIBUTE = 'data-accent-theme';

function isAccentThemeId(value: string | null): value is AccentThemeId {
  return ACCENT_THEMES.some((theme) => theme.id === value);
}

function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system';
}

function prefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Resolve a stored mode to an actual light/dark decision. */
function resolveIsDark(mode: ThemeMode): boolean {
  if (mode === 'system') return prefersDark();
  return mode === 'dark';
}

/** Push the current accent + resolved mode onto <html>. */
function applyToDocument(accent: AccentThemeId, mode: ThemeMode): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute(ACCENT_ATTRIBUTE, accent);
  root.classList.toggle(DARK_MODE_CLASS, resolveIsDark(mode));
}

/** Read the persisted accent palette, falling back to 'default'. */
export function getAccentTheme(): AccentThemeId {
  try {
    const stored = localStorage.getItem(ACCENT_THEME_STORAGE_KEY);
    return isAccentThemeId(stored) ? stored : 'default';
  } catch {
    return 'default';
  }
}

/** Persist and apply an accent palette. */
export function setAccentTheme(id: AccentThemeId): void {
  try {
    localStorage.setItem(ACCENT_THEME_STORAGE_KEY, id);
  } catch {
    /* storage unavailable — apply for this session anyway */
  }
  applyToDocument(id, getThemeMode());
}

/** Read the persisted light/dark mode, falling back to 'system'. */
export function getThemeMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME_MODE_STORAGE_KEY);
    return isThemeMode(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

/** Persist and apply a light/dark/system mode. */
export function setThemeMode(mode: ThemeMode): void {
  try {
    localStorage.setItem(THEME_MODE_STORAGE_KEY, mode);
  } catch {
    /* storage unavailable — apply for this session anyway */
  }
  applyToDocument(getAccentTheme(), mode);
}

let systemListenerAttached = false;

/**
 * Keep the `.dark` class in sync with the OS while mode === 'system'.
 * Attached at most once; a no-op outside the browser.
 */
function ensureSystemThemeListener(): void {
  if (systemListenerAttached) return;
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
  const query = window.matchMedia('(prefers-color-scheme: dark)');
  query.addEventListener('change', () => {
    if (getThemeMode() === 'system') {
      applyToDocument(getAccentTheme(), 'system');
    }
  });
  systemListenerAttached = true;
}

/**
 * Apply the persisted theme (or defaults) to <html> and start the
 * system-preference listener. Idempotent and safe to call before first render.
 */
export function initTheme(): void {
  if (typeof document === 'undefined') return;
  applyToDocument(getAccentTheme(), getThemeMode());
  ensureSystemThemeListener();
}
