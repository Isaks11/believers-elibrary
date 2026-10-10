import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { AppIcon } from '@/components/common/AppIcon';

const LOADING_VERSE = [
  'For I know the plans I have for you... — Jeremiah 29:11',
  'Your word is a lamp to my feet. — Psalm 119:105',
  'I can do all things through Christ. — Philippians 4:13',
];

export function SplashScreen({ onFinish }: { onFinish?: () => void }) {
  const verse = LOADING_VERSE[Math.floor(Math.random() * LOADING_VERSE.length)];

  useEffect(() => {
    const timer = window.setTimeout(() => onFinish?.(), 2200);
    return () => window.clearTimeout(timer);
  }, [onFinish]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-[radial-gradient(120%_120%_at_50%_0%,#13213d_0%,#0d1830_55%,#060b18_100%)] text-white">
      {/* Ambient light rays */}
      <div className="pointer-events-none absolute inset-0">
        <motion.div
          className="absolute left-1/2 top-1/2 h-[120vmax] w-[120vmax] -translate-x-1/2 -translate-y-1/2"
          style={{
            background:
              'conic-gradient(from 0deg at 50% 50%, transparent 0deg, rgba(212,175,55,0.10) 12deg, transparent 26deg, rgba(212,175,55,0.06) 44deg, transparent 60deg, rgba(212,175,55,0.10) 82deg, transparent 100deg, rgba(212,175,55,0.06) 128deg, transparent 150deg, rgba(212,175,55,0.10) 176deg, transparent 200deg, rgba(212,175,55,0.06) 228deg, transparent 250deg, rgba(212,175,55,0.10) 276deg, transparent 300deg, rgba(212,175,55,0.06) 330deg, transparent 360deg)',
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
        />
      </div>

      {/* Icon with glowing aura */}
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="relative"
      >
        <motion.div
          className="absolute inset-0 -z-10 rounded-[28%] bg-amber-300/30 blur-2xl"
          animate={{ opacity: [0.5, 0.9, 0.5], scale: [0.95, 1.08, 0.95] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <AppIcon className="h-28 w-28 shadow-2xl shadow-amber-500/20 sm:h-32 sm:w-32" />
        </motion.div>
      </motion.div>

      {/* Brand */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.6, ease: 'easeOut' }}
        className="mt-8 text-center"
      >
        <h1 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl">
          Believers <span className="text-amber-300">Library</span>
        </h1>
        <p className="mt-2 text-sm font-medium italic text-white/70 sm:text-base">
          Grow spiritually every day
        </p>
      </motion.div>

      {/* Progress bar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.55, duration: 0.5 }}
        className="mt-10 w-56 sm:w-64"
      >
        <div className="h-1 overflow-hidden rounded-full bg-white/15">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 via-amber-300 to-amber-500"
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 1.6, ease: 'easeInOut' }}
          />
        </div>
        <p className="mt-4 text-center text-xs leading-relaxed text-white/60">
          {verse}
        </p>
      </motion.div>
    </div>
  );
}