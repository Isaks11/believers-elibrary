import { useEffect, useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import {
  Home,
  BookOpen,
  Music2,
  WifiOff,
  Download,
  RefreshCw,
  LayoutDashboard,
  Library,
  Compass,
  NotebookPen,
  Bell,
  Users,
  UserRound,
  ShieldCheck,
  MoreHorizontal,
  Sunrise,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { AppIcon } from '@/components/common/AppIcon';
import { applyServiceWorkerUpdate } from '@/lib/offlineStorage';
import { can } from '@/lib/permissions';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { toast } from 'sonner';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function AppLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Connection restored — back online');
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.info('Offline mode active — downloaded Bible chapters, hymns & journal are available');
    };
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    const handleSwUpdate = () => {
      setUpdateAvailable(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('sw-update-available', handleSwUpdate);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('sw-update-available', handleSwUpdate);
    };
  }, []);

  const handleInstallPwa = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      toast.success('Believers e-Library installed!');
      setInstallPrompt(null);
    }
  };

  const isAdmin = can(user?.role, 'content:create');

  /** Primary destinations — always visible in the bottom bar. */
  const navItems = [
    { icon: Home, label: 'Home', path: '/' },
    { icon: BookOpen, label: 'Bible', path: '/bible' },
    { icon: Sunrise, label: 'Devotion', path: '/devotional' },
    { icon: Music2, label: 'Hymns', path: '/hymns' },
  ];

  /** Secondary destinations — grouped in the "More" sheet so nothing floats over content. */
  const moreItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: Library, label: 'E-Library', path: '/library' },
    { icon: Compass, label: 'Faith Guide', path: '/faithguide' },
    { icon: NotebookPen, label: 'Journal', path: '/journal' },
    { icon: Bell, label: 'Prayer & News', path: '/prayer-news' },
    { icon: Users, label: 'Community', path: '/community' },
    { icon: UserRound, label: 'Profile', path: '/profile' },
    ...(isAdmin ? [{ icon: ShieldCheck, label: 'Admin CMS', path: '/admin' }] : []),
  ];

  const morePaths = moreItems.map((i) => i.path);
  const moreActive = morePaths.includes(location.pathname);

  return (
    <div className="app-shell h-dvh bg-background flex flex-col max-w-md mx-auto shadow-2xl relative border-x border-border/50 overflow-hidden">
      {/* Offline Status Banner */}
      {!isOnline && (
        <div
          role="status"
          aria-live="polite"
          className="bg-amber-600 text-white px-4 py-1.5 text-[11px] font-semibold flex items-center justify-between gap-2 z-50 shrink-0"
        >
          <span className="flex items-center gap-1.5">
            <WifiOff className="w-3.5 h-3.5 shrink-0" />
            Offline Mode — Downloaded Bible chapters, hymns & journal are available
          </span>
        </div>
      )}

      {/* Safe Service Worker Update Banner */}
      {updateAvailable && (
        <div className="bg-primary text-primary-foreground px-4 py-2 text-xs flex items-center justify-between gap-2 z-50 shrink-0">
          <span>A new version of Believers Library is ready.</span>
          <button
            onClick={applyServiceWorkerUpdate}
            className="px-2.5 py-1 rounded-md bg-accent text-accent-foreground font-bold text-[11px] flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" /> Update Now
          </button>
        </div>
      )}

      {/* App bar — in-flow header (replaces the old floating brand badge that covered page titles) */}
      <header className="shrink-0 z-40 flex items-center gap-2.5 px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 bg-background/85 backdrop-blur-md border-b border-border/40">
        <NavLink to="/" className="flex items-center gap-2.5 min-w-0" aria-label="Believers Library Home">
          <AppIcon className="h-8 w-8 shrink-0" />
          <span className="font-serif font-bold text-primary truncate">Believers Library</span>
        </NavLink>

        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          {installPrompt && (
            <button
              onClick={handleInstallPwa}
              className="p-2 rounded-full bg-accent text-accent-foreground border border-border"
              title="Install Believers Library App"
              aria-label="Install Believers Library App"
            >
              <Download className="w-4 h-4" />
            </button>
          )}
          {isAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                cn(
                  'p-2 rounded-full border border-border text-muted-foreground hover:text-foreground',
                  isActive && 'bg-primary text-primary-foreground'
                )
              }
              aria-label="Admin CMS"
              title="Admin CMS"
            >
              <ShieldCheck className="w-4 h-4" />
            </NavLink>
          )}
        </div>
      </header>

      <main id="main-content" className="flex-1 min-h-0 overflow-y-auto overscroll-contain pb-8 pt-4 px-4">
        <Outlet />
      </main>

      {/* "More" destinations sheet */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl border-t max-h-[80vh] overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]">
          <SheetHeader>
            <SheetTitle className="font-serif text-primary">More destinations</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-3 gap-3">
            {moreItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    'flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-border/50 bg-card px-2 py-4 text-center transition-colors',
                    isActive
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'text-foreground hover:border-primary/40'
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="text-[11px] font-medium leading-tight">{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>

      {/* Bottom Navigation — in-flow so it can never overlap page content */}
      <nav
        aria-label="Primary"
        className="shrink-0 z-50 bg-card/90 backdrop-blur-lg border-t border-border/50 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] flex justify-around items-center"
      >
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-1 transition-colors px-3 py-1 rounded-xl',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )
            }
          >
            <item.icon className="w-5 h-5" />
            <span className="text-[9px] font-medium">{item.label}</span>
          </NavLink>
        ))}
        <button
          onClick={() => setMoreOpen(true)}
          aria-expanded={moreOpen}
          aria-haspopup="dialog"
          className={cn(
            'flex flex-col items-center gap-1 transition-colors px-3 py-1 rounded-xl',
            moreActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <MoreHorizontal className="w-5 h-5" />
          <span className="text-[9px] font-medium">More</span>
        </button>
      </nav>
    </div>
  );
}
