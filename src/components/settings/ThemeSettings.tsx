import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  ACCENT_THEMES,
  getAccentTheme,
  getThemeMode,
  setAccentTheme,
  setThemeMode,
  type AccentThemeId,
  type ThemeMode,
} from '@/lib/theme';

const MODE_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

/**
 * Presentational "Appearance" card for the Profile settings area.
 * Local state mirrors `src/lib/theme.ts`; every click persists the choice and
 * applies it to <html> immediately.
 */
export function ThemeSettings() {
  const [accent, setAccent] = useState<AccentThemeId>('default');
  const [mode, setMode] = useState<ThemeMode>('system');

  // Sync from storage once on mount (stored values may differ from defaults).
  useEffect(() => {
    setAccent(getAccentTheme());
    setMode(getThemeMode());
  }, []);

  const handleAccentChange = (id: AccentThemeId) => {
    setAccentTheme(id);
    setAccent(id);
  };

  const handleModeChange = (value: ThemeMode) => {
    setThemeMode(value);
    setMode(value);
  };

  const activeDescription =
    ACCENT_THEMES.find((theme) => theme.id === accent)?.description ?? '';

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest pl-1">
        Appearance
      </h3>
      <Card className="border-none bg-secondary/30 shadow-sm py-0 gap-0">
        <CardContent className="p-4 space-y-4">
          {/* Accent color swatches */}
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-primary uppercase block">
              Color Theme
            </span>
            <div className="flex flex-wrap gap-3 pt-1">
              {ACCENT_THEMES.map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  title={theme.label}
                  aria-label={`${theme.label} color theme`}
                  aria-pressed={accent === theme.id}
                  onClick={() => handleAccentChange(theme.id)}
                  className={cn(
                    'w-9 h-9 rounded-full flex items-center justify-center transition-all',
                    accent === theme.id
                      ? 'ring-2 ring-ring ring-offset-2 ring-offset-card scale-110'
                      : 'hover:scale-105'
                  )}
                  style={{ backgroundColor: theme.swatch }}
                >
                  {accent === theme.id && (
                    <Check className="w-4 h-4 text-white drop-shadow-sm" />
                  )}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed pt-1">
              {activeDescription}
            </p>
          </div>

          {/* Light / Dark / System segmented control */}
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-primary uppercase block">
              Theme Mode
            </span>
            <div className="flex gap-2 pt-1">
              {MODE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleModeChange(option.value)}
                  className={cn(
                    'flex-1 py-1.5 rounded-lg text-xs font-bold uppercase transition-all',
                    mode === option.value
                      ? 'bg-primary text-primary-foreground shadow'
                      : 'bg-card text-muted-foreground border'
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Choose how Believers Library looks. Your choice is saved on this device.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
