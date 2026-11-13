import { cn } from '@/lib/utils';

interface AppIconProps {
  className?: string;
  /** Rounded-corner radius (e.g. "rounded-3xl"). Defaults to rounded-square. */
  shape?: string;
}

/**
 * Believers e-Library brand icon (official logo).
 * Used throughout the app for header/auth/home branding and install surfaces.
 */
export function AppIcon({ className, shape = 'rounded-[28%]' }: AppIconProps) {
  return (
    <img
      src="/brand-logo.png"
      alt="Believers e-Library"
      className={cn('object-cover bg-[#0d1830] shrink-0', shape, className)}
      loading="eager"
      decoding="async"
      draggable={false}
    />
  );
}