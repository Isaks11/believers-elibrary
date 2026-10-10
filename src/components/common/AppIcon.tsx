import { cn } from '@/lib/utils';

interface AppIconProps {
  className?: string;
  /** Rounded-corner radius (e.g. "rounded-3xl"). Defaults to rounded-square. */
  shape?: string;
}

/**
 * Believers Library app icon - radiant golden cross over a midnight-navy
 * rounded square with a parchment Bible silhouette and subtle halo glow.
 * Replaceable via APP_ICON_URL in src/constants.ts when a raster asset is preferred.
 */
export function AppIcon({ className, shape = 'rounded-[28%]' }: AppIconProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden bg-[radial-gradient(120%_120%_at_50%_0%,#1b2a4a_0%,#0d1830_55%,#070d1d_100%)]',
        shape,
        className
      )}
      aria-label="Believers Library"
      role="img"
    >
      {/* Ambient glow */}
      <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_42%,rgba(212,175,55,0.38)_0%,rgba(212,175,55,0.10)_45%,transparent_70%)]" />
      {/* Gold filigree frame */}
      <div className="absolute inset-[6%] rounded-[20%] border border-amber-300/35" />
      <div className="absolute inset-[10%] rounded-[16%] border border-amber-200/20" />

      {/* Parchment Bible leaves */}
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <linearGradient id="appicon-gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f7e7b4" />
            <stop offset="45%" stopColor="#d4af37" />
            <stop offset="100%" stopColor="#a8821d" />
          </linearGradient>
        </defs>
        {/* Bible */}
        <g transform="translate(34 66)">
          <path
            d="M0 8 C8 2, 16 2, 32 8 L32 26 C16 20, 8 20, 0 26 Z"
            fill="#e8dcc0"
            opacity="0.92"
          />
          <path
            d="M32 8 C40 2, 48 2, 64 8 L64 26 C48 20, 40 20, 32 26 Z"
            fill="#d9c9a3"
            opacity="0.92"
          />
          <path
            d="M32 8 C36 5, 40 5, 32 8 Z"
            fill="#a8821d"
            opacity="0.7"
          />
          <line x1="32" y1="9" x2="32" y2="25" stroke="#a8821d" strokeWidth="0.6" opacity="0.6" />
        </g>
        {/* Radiant cross with halo ring */}
        <circle cx="50" cy="40" r="21" fill="none" stroke="url(#appicon-gold)" strokeWidth="0.8" opacity="0.45" />
        <circle cx="50" cy="40" r="14.5" fill="rgba(212,175,55,0.12)" stroke="rgba(212,175,55,0.3)" strokeWidth="0.5" />
        <g fill="url(#appicon-gold)">
          <rect x="46.6" y="26" width="6.8" height="24" rx="2" />
          <rect x="39" y="35.2" width="22" height="6.8" rx="2" />
        </g>
        {/* Glint */}
        <circle cx="46" cy="33" r="1.4" fill="#fff8e0" opacity="0.9" />
      </svg>
    </div>
  );
}