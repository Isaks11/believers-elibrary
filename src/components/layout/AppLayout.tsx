import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { Home, BookOpen, Library, Bell, LayoutDashboard, User, Sparkles, Music2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { AppIcon } from '@/components/common/AppIcon';

export function AppLayout() {
  const { user } = useAuth();
  const location = useLocation();

  const navItems = [
    { icon: Home, label: 'Home', path: '/' },
    { icon: BookOpen, label: 'Devotional', path: '/devotional' },
    { icon: Music2, label: 'Hymns', path: '/hymns' },
    { icon: Bell, label: 'Prayer', path: '/prayer-news' },
    { icon: LayoutDashboard, label: 'Profile', path: '/profile' },
  ];

  const isAdmin = user && !user.isGuest;

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-md mx-auto shadow-2xl relative border-x border-border/50">
      <main className="flex-1 overflow-y-auto pb-20 pt-4 px-4">
        <Outlet />
      </main>

      {/* App brand badge (floating top-left) */}
      <NavLink
        to="/"
        className="fixed top-4 left-4 flex items-center gap-2 p-1.5 pr-3 bg-card/80 backdrop-blur-md rounded-full shadow-md border border-border/60"
        aria-label="Believers Library Home"
      >
        <AppIcon className="h-8 w-8" />
        <span className="hidden xs:inline text-sm font-serif font-bold text-primary">Believers Library</span>
      </NavLink>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-card/80 backdrop-blur-lg border-t border-border/50 px-4 py-3 flex justify-between items-center z-50">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center gap-1 transition-colors px-2",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )
            }
          >
            <item.icon className="w-5 h-5" />
            <span className="text-[9px] font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Library + Dashboard side shortcuts (also reachable from Home grid) */}
      <NavLink
        to="/library"
        className="fixed top-16 right-4 p-2 bg-card rounded-full shadow-md border border-border"
        aria-label="Library"
      >
        <Library className="w-5 h-5 text-muted-foreground" />
      </NavLink>
      <NavLink
        to="/dashboard"
        className="fixed top-28 right-4 p-2 bg-card rounded-full shadow-md border border-border"
        aria-label="Dashboard"
      >
        <LayoutDashboard className="w-5 h-5 text-muted-foreground" />
      </NavLink>

      {/* FaithGuide Floating Action Button */}
      <NavLink
        to="/faithguide"
        className={({ isActive }) =>
          cn(
            "fixed bottom-24 right-6 w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:scale-110 transition-transform z-50",
            isActive && "ring-4 ring-primary/20"
          )
        }
      >
        <Sparkles className="w-7 h-7" />
      </NavLink>

      {isAdmin && (
        <NavLink
          to="/admin"
          className="fixed top-4 right-4 p-2 bg-card rounded-full shadow-md border border-border"
        >
          <BookOpen className="w-5 h-5 text-muted-foreground" />
        </NavLink>
      )}
    </div>
  );
}