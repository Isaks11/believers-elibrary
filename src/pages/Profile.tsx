import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import { ROLE_LABELS } from '@/lib/permissions';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ThemeSettings } from '@/components/settings/ThemeSettings';
import {
  Settings,
  History,
  Bookmark,
  Download,
  Upload,
  Trophy,
  Calendar,
  LogOut,
  ChevronRight,
  ShieldCheck,
  Database,
  LayoutDashboard,
  Cloud,
  HardDrive,
  BookOpen,
  Music2,
  RefreshCw,
  FileText,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  computeStreak,
  countCompletedDevotionals,
  countEarnedAchievements,
  countAllBookmarks,
  countReadingHistoryEntries,
  exportAllUserData,
  importAllUserData,
} from '@/lib/activity';
import {
  getDevotionals,
  getBookmarkedDevotionalIds,
  getFavoriteHymnIds,
  getHymns,
} from '@/data/mockDevotionalHymnData';
import { getLibraryItems, getUserStats, getLibraryProgressMap, syncFaithDataFromServer } from '@/data/mockFaithData';
import { localDateKey, syncPersonalJournalFromServer } from '@/data/journalData';
import { syncUserPreferencesWithServer, purgeCurrentUserAccountData } from '@/lib/securityAndSync';
import { getSyncHealthSummary } from '@/lib/syncHealth';

export function Profile() {
  const { user, isRemote, updateProfile, logout } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [refreshKey, setRefreshKey] = useState(0);
  const [activeDialog, setActiveDialog] = useState<'settings' | 'history' | 'bookmarks' | 'backup' | 'legal' | null>(null);
  const [nameInput, setNameInput] = useState(user?.name || '');
  const [roleInput, setRoleInput] = useState<UserRole>(user?.role || 'user');
  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);

  const streak = useMemo(() => computeStreak(), [refreshKey]);
  const achievementsCount = useMemo(() => countEarnedAchievements(), [refreshKey]);
  const completedCount = useMemo(() => countCompletedDevotionals(), [refreshKey]);
  const bookmarksCount = useMemo(() => countAllBookmarks(), [refreshKey]);
  const historyCount = useMemo(() => countReadingHistoryEntries(), [refreshKey]);

  const stats = [
    {
      label: 'Reading Streak',
      value: `${streak} ${streak === 1 ? 'Day' : 'Days'}`,
      icon: Calendar,
      color: 'text-orange-500',
    },
    {
      label: 'Achievements',
      value: `${achievementsCount} / 5`,
      icon: Trophy,
      color: 'text-yellow-600',
    },
    {
      label: 'Completed',
      value: `${completedCount}`,
      icon: ShieldCheck,
      color: 'text-emerald-600',
    },
  ];

  const openSettings = () => {
    setNameInput(user?.name || '');
    setRoleInput(user?.role || 'user');
    setConfirmDeleteAccount(false);
    setActiveDialog('settings');
  };

  const handleManualCloudSync = async () => {
    if (!navigator.onLine) {
      toast.error('You are currently offline. Edits are saved locally and will sync when connectivity returns.');
      return;
    }
    if (!isRemote) {
      toast.info('Running in Device-Local mode. Configure VITE_SUPABASE_URL to enable cloud sync.');
      return;
    }
    setSyncState('syncing');
    try {
      const [journalRes, prefRes, faithRes] = await Promise.all([
        syncPersonalJournalFromServer(),
        syncUserPreferencesWithServer(),
        syncFaithDataFromServer(),
      ]);
      const errors = [
        journalRes.error ? `journal: ${journalRes.error}` : null,
        prefRes.error ? `preferences: ${prefRes.error}` : null,
        faithRes.error ? `library/prayer: ${faithRes.error}` : null,
      ].filter((e): e is string => Boolean(e));
      if (errors.length > 0) {
        setSyncState('error');
        toast.error(`Cloud sync incomplete — local data kept. ${errors.join(' | ')}`);
        return;
      }
      if (prefRes.conflicts && prefRes.conflicts.length > 0) {
        toast.info(
          `${prefRes.conflicts.length} sync conflict${prefRes.conflicts.length === 1 ? '' : 's'} resolved — the newest copy was kept (${prefRes.conflicts.join(', ')}).`
        );
      }
      setSyncState('synced');
      setRefreshKey((k) => k + 1);
      const health = getSyncHealthSummary();
      if (health.pending > 0) {
        toast.warning(
          `Synced, but ${health.pending} earlier write${health.pending === 1 ? '' : 's'} still failed (${health.scopes.join(', ')}).`
        );
      } else {
        toast.success('Cloud synchronization complete');
      }
    } catch {
      setSyncState('error');
      toast.error('Cloud synchronization failed. Please retry.');
    }
  };

  const handleDeleteAccountData = async () => {
    if (!user) return;
    const res = await purgeCurrentUserAccountData(user.id);
    if (!res.ok) {
      toast.error(res.error || 'Could not purge account data');
      return;
    }
    toast.success('Your account data and personal records have been permanently deleted.');
    setActiveDialog(null);
    await logout();
    navigate('/auth');
  };

  const handleSaveSettings = async () => {
    if (!nameInput.trim()) {
      toast.error('Display name cannot be empty');
      return;
    }
    const res = await updateProfile({ name: nameInput.trim(), role: roleInput });
    if (!res.ok) {
      toast.error(res.message || 'Could not update profile');
      return;
    }
    toast.success('Profile settings updated');
    setActiveDialog(null);
  };

  const handleExport = () => {
    try {
      const json = exportAllUserData();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `believers-library-backup-${localDateKey()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Backup file downloaded');
    } catch {
      toast.error('Failed to export data');
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      const result = importAllUserData(text);
      if (result.ok) {
        toast.success(result.message);
        setRefreshKey((k) => k + 1);
        setActiveDialog(null);
      } else {
        toast.error(result.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Data for History & Bookmarks modals
  const completedDevotionalsList = useMemo(
    () => getDevotionals().filter((d) => d.isCompleted),
    [refreshKey, activeDialog]
  );
  const inProgressLibraryList = useMemo(() => {
    const prog = getLibraryProgressMap();
    return getLibraryItems().filter((i) => (prog[i.id] ?? 0) > 0);
  }, [refreshKey, activeDialog]);
  const bibleHistoryList = useMemo(() => {
    try {
      const raw = localStorage.getItem('bible_history');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? (parsed as string[]) : [];
    } catch {
      return [];
    }
  }, [refreshKey, activeDialog]);

  const bookmarkedLibraryList = useMemo(() => {
    const ids = new Set(getUserStats().bookmarks);
    return getLibraryItems().filter((i) => ids.has(i.id));
  }, [refreshKey, activeDialog]);
  const bookmarkedDevotionalsList = useMemo(() => {
    const ids = new Set(getBookmarkedDevotionalIds());
    return getDevotionals().filter((d) => ids.has(d.id));
  }, [refreshKey, activeDialog]);
  const favoriteHymnsList = useMemo(() => {
    const ids = new Set(getFavoriteHymnIds());
    return getHymns().filter((h) => ids.has(h.id));
  }, [refreshKey, activeDialog]);
  const bibleBookmarksList = useMemo(() => {
    try {
      const raw = localStorage.getItem('bible_bookmarks');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? (parsed as string[]) : [];
    } catch {
      return [];
    }
  }, [refreshKey, activeDialog]);

  return (
    <div className="space-y-7 pb-20">
      <header className="flex justify-between items-start">
        <h1 className="text-2xl font-serif text-primary">My Profile</h1>
        <Button variant="ghost" size="icon" onClick={openSettings} aria-label="Account Settings">
          <Settings className="w-5 h-5" />
        </Button>
      </header>

      <div className="flex flex-col items-center gap-3 py-2">
        <div className="relative">
          <Avatar className="w-24 h-24 ring-4 ring-primary/10 shadow-xl">
            <AvatarImage src={user?.avatar} />
            <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-serif">
              {user?.name?.[0]?.toUpperCase() || 'B'}
            </AvatarFallback>
          </Avatar>
          {!user?.isGuest && (
            <div className="absolute -bottom-1 -right-1 bg-accent text-accent-foreground p-1.5 rounded-full shadow-lg">
              <ShieldCheck className="w-4 h-4" />
            </div>
          )}
        </div>
        <div className="text-center space-y-1">
          <h2 className="text-xl font-bold text-primary">{user?.name}</h2>
          {user?.email && <p className="text-xs text-muted-foreground">{user.email}</p>}
          <div className="flex items-center justify-center gap-1.5 pt-1 flex-wrap">
            <Badge variant="secondary" className="text-[10px] uppercase">
              {user?.isGuest ? 'Guest Session' : user?.role ? ROLE_LABELS[user.role] : 'Registered Believer'}
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] gap-1',
                isRemote ? 'border-emerald-300 text-emerald-700 bg-emerald-50' : 'border-amber-300 text-amber-800 bg-amber-50'
              )}
            >
              {isRemote ? <Cloud className="w-3 h-3" /> : <HardDrive className="w-3 h-3" />}
              {isRemote ? 'Cloud Synced' : 'Device-Local'}
            </Badge>
          </div>
        </div>

        {user?.isGuest && (
          <Button
            onClick={() => navigate('/auth')}
            className="bg-accent text-accent-foreground hover:bg-accent/90 rounded-full px-6"
          >
            Create Registered Account
          </Button>
        )}

        {(user?.role === 'admin' || user?.role === 'super_admin') && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/admin')}
            className="rounded-full gap-1.5 border-primary/30 text-primary"
          >
            <LayoutDashboard className="w-4 h-4" /> Open Admin Control Panel
          </Button>
        )}
      </div>

      {/* Real Activity Stats */}
      <div className="grid grid-cols-3 gap-3">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-none bg-secondary/30 shadow-sm text-center">
            <CardContent className="p-3 flex flex-col items-center gap-1">
              <stat.icon className={cn('w-5 h-5', stat.color)} />
              <span className="text-lg font-bold text-primary">{stat.value}</span>
              <span className="text-[8px] uppercase font-bold text-muted-foreground">{stat.label}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Functional Activity & Storage Controls */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest pl-1">
          Activity & Personal Data
        </h3>
        {[
          {
            icon: History,
            label: 'Reading History',
            count: `${historyCount} ${historyCount === 1 ? 'entry' : 'entries'}`,
            onClick: () => setActiveDialog('history'),
          },
          {
            icon: Bookmark,
            label: 'Saved Bookmarks & Favorites',
            count: `${bookmarksCount} ${bookmarksCount === 1 ? 'item' : 'items'}`,
            onClick: () => setActiveDialog('bookmarks'),
          },
          {
            icon: Download,
            label: 'Backup & Restore Data',
            count: 'Export or import JSON backup',
            onClick: () => setActiveDialog('backup'),
          },
          {
            icon: RefreshCw,
            label: 'Synchronize Cloud Data',
            count:
              syncState === 'syncing'
                ? 'Synchronizing...'
                : syncState === 'synced'
                ? 'All changes synced'
                : syncState === 'error'
                ? 'Sync failed — tap to retry'
                : isRemote
                ? 'Tap to sync journal, progress & preferences'
                : 'Device-Local mode (configure Supabase for cloud)',
            onClick: handleManualCloudSync,
          },
          {
            icon: Database,
            label: 'Account & Storage Settings',
            count: isRemote ? 'Supabase PostgreSQL + Local Cache' : 'Local Browser Storage',
            onClick: openSettings,
          },
          {
            icon: FileText,
            label: 'Privacy, Terms & Content Licensing',
            count: 'Data protection, Scripture licenses & covenant',
            onClick: () => setActiveDialog('legal'),
          },
        ].map((item) => (
          <Button
            key={item.label}
            variant="outline"
            onClick={item.onClick}
            className="w-full justify-between h-14 border-border/40 bg-card hover:bg-primary/5 hover:border-primary/20 transition-all px-4"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/5">
                <item.icon className="w-5 h-5 text-primary" />
              </div>
              <div className="text-left">
                <span className="text-sm font-bold block">{item.label}</span>
                <span className="text-[10px] text-muted-foreground font-medium uppercase">{item.count}</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </Button>
        ))}
      </div>

      {/* Selectable accent palette + light/dark mode (persisted on this device). */}
      <ThemeSettings />

      <Button
        variant="ghost"
        onClick={logout}
        className="w-full text-rose-500 hover:text-rose-600 hover:bg-rose-50 font-bold"
      >
        <LogOut className="w-4 h-4 mr-2" /> Sign Out
      </Button>

      {/* Settings Dialog */}
      <Dialog open={activeDialog === 'settings'} onOpenChange={(o) => !o && setActiveDialog(null)}>
        <DialogContent className="max-w-sm rounded-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Account & Storage Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase">Display Name</label>
              <Input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Your name"
                className="mt-1"
              />
            </div>

            {!isRemote && (
              <div className="space-y-2 p-3 rounded-xl bg-secondary/40 border border-border/50">
                <label className="text-xs font-semibold text-primary uppercase block">
                  Local Mode Role
                </label>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  In Device-Local mode, you can switch between the CMS roles to test role-protected actions in the admin panel. When connected to Supabase, roles are server-enforced via PostgreSQL Row Level Security and cannot be changed from this device.
                </p>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {(['user', 'contributor', 'editor', 'admin'] as UserRole[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRoleInput(r)}
                      title={ROLE_LABELS[r]}
                      className={cn(
                        'py-1.5 px-2 rounded-lg text-[10px] font-bold uppercase transition-all',
                        roleInput === r
                          ? 'bg-primary text-primary-foreground shadow'
                          : 'bg-card text-muted-foreground border'
                      )}
                    >
                      {ROLE_LABELS[r]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="p-3 rounded-xl border border-rose-200 bg-rose-50/60 space-y-2">
              <p className="text-xs font-bold text-rose-800 flex items-center gap-1.5">
                <Trash2 className="w-3.5 h-3.5" /> Delete Account & Personal Data
              </p>
              <p className="text-[11px] text-rose-700/90 leading-relaxed">
                Permanently erase your private journal entries, prayer requests, bookmarks, reading history, and profile from {isRemote ? 'both Supabase and this device' : 'this device'}.
              </p>
              {!confirmDeleteAccount ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full text-xs border-rose-300 text-rose-700 hover:bg-rose-100"
                  onClick={() => setConfirmDeleteAccount(true)}
                >
                  Request Account & Data Purge
                </Button>
              ) : (
                <div className="flex gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => setConfirmDeleteAccount(false)}
                  >
                    Keep Data
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={handleDeleteAccountData}
                  >
                    Confirm Permanent Delete
                  </Button>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setActiveDialog(null)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleSaveSettings}>
                Save Settings
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reading History Dialog */}
      <Dialog open={activeDialog === 'history'} onOpenChange={(o) => !o && setActiveDialog(null)}>
        <DialogContent className="max-w-sm rounded-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Reading & Study History</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {historyCount === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No reading history recorded yet. Complete a devotional, read a Bible chapter, or open an e-Library resource to begin tracking.
              </p>
            ) : (
              <>
                {completedDevotionalsList.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase text-muted-foreground">
                      Completed Devotionals ({completedDevotionalsList.length})
                    </h4>
                    {completedDevotionalsList.slice(0, 10).map((d) => (
                      <div
                        key={d.id}
                        onClick={() => {
                          setActiveDialog(null);
                          navigate('/devotional');
                        }}
                        className="p-2.5 rounded-xl bg-secondary/30 hover:bg-secondary/50 cursor-pointer flex justify-between items-center"
                      >
                        <div>
                          <p className="text-xs font-bold text-primary">{d.title}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {d.month} {d.day}, {d.year} • {d.scriptureRef}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    ))}
                  </div>
                )}

                {inProgressLibraryList.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase text-muted-foreground">
                      Library Progress ({inProgressLibraryList.length})
                    </h4>
                    {inProgressLibraryList.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          setActiveDialog(null);
                          navigate('/library');
                        }}
                        className="p-2.5 rounded-xl bg-secondary/30 hover:bg-secondary/50 cursor-pointer flex justify-between items-center"
                      >
                        <div>
                          <p className="text-xs font-bold text-primary">{item.title}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {item.author} • {item.progress || 0}% complete
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    ))}
                  </div>
                )}

                {bibleHistoryList.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase text-muted-foreground">
                      Recent Bible Chapters ({bibleHistoryList.length})
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {bibleHistoryList.map((chap) => (
                        <Badge
                          key={chap}
                          variant="secondary"
                          onClick={() => {
                            setActiveDialog(null);
                            navigate('/bible');
                          }}
                          className="cursor-pointer text-xs"
                        >
                          {chap}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Bookmarks Dialog */}
      <Dialog open={activeDialog === 'bookmarks'} onOpenChange={(o) => !o && setActiveDialog(null)}>
        <DialogContent className="max-w-sm rounded-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Saved Bookmarks & Favorites</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {bookmarksCount === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                You haven't bookmarked any items yet. Tap the bookmark or star icon on any Bible verse, devotional, hymn, or library item to save it here.
              </p>
            ) : (
              <>
                {bookmarkedLibraryList.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5" /> Library ({bookmarkedLibraryList.length})
                    </h4>
                    {bookmarkedLibraryList.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          setActiveDialog(null);
                          navigate('/library');
                        }}
                        className="p-2.5 rounded-xl bg-secondary/30 hover:bg-secondary/50 cursor-pointer flex justify-between items-center"
                      >
                        <div>
                          <p className="text-xs font-bold text-primary">{item.title}</p>
                          <p className="text-[10px] text-muted-foreground">{item.author}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    ))}
                  </div>
                )}

                {bookmarkedDevotionalsList.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase text-muted-foreground">
                      Devotionals ({bookmarkedDevotionalsList.length})
                    </h4>
                    {bookmarkedDevotionalsList.map((d) => (
                      <div
                        key={d.id}
                        onClick={() => {
                          setActiveDialog(null);
                          navigate('/devotional');
                        }}
                        className="p-2.5 rounded-xl bg-secondary/30 hover:bg-secondary/50 cursor-pointer flex justify-between items-center"
                      >
                        <div>
                          <p className="text-xs font-bold text-primary">{d.title}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {d.month} {d.day}, {d.year} • {d.scriptureRef}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    ))}
                  </div>
                )}

                {favoriteHymnsList.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1">
                      <Music2 className="w-3.5 h-3.5" /> Favorite Hymns ({favoriteHymnsList.length})
                    </h4>
                    {favoriteHymnsList.map((h) => (
                      <div
                        key={h.id}
                        onClick={() => {
                          setActiveDialog(null);
                          navigate('/hymns');
                        }}
                        className="p-2.5 rounded-xl bg-secondary/30 hover:bg-secondary/50 cursor-pointer flex justify-between items-center"
                      >
                        <div>
                          <p className="text-xs font-bold text-primary">
                            Hymn {h.number}: {h.title}
                          </p>
                          <p className="text-[10px] text-muted-foreground">{h.author}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    ))}
                  </div>
                )}

                {bibleBookmarksList.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase text-muted-foreground">
                      Bible Passages ({bibleBookmarksList.length})
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {bibleBookmarksList.map((ref) => (
                        <Badge
                          key={ref}
                          variant="outline"
                          onClick={() => {
                            setActiveDialog(null);
                            navigate('/bible');
                          }}
                          className="cursor-pointer text-xs"
                        >
                          {ref}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Backup & Restore Dialog */}
      <Dialog open={activeDialog === 'backup'} onOpenChange={(o) => !o && setActiveDialog(null)}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Backup & Restore Personal Data</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Export a complete JSON backup of your journal entries, personal prayer requests, bookmarks, mood logs, and reading progress, or restore from a previous backup file.
            </p>
            <Button className="w-full gap-2" onClick={handleExport}>
              <Download className="w-4 h-4" /> Download JSON Backup
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={handleImportFile}
            />
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-4 h-4" /> Restore from Backup File
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={activeDialog === 'legal'} onOpenChange={(o) => !o && setActiveDialog(null)}>
        <DialogContent className="max-w-md rounded-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Privacy, Terms & Content Licensing</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2 text-xs text-muted-foreground leading-relaxed">
            <div>
              <p className="font-bold text-foreground text-sm mb-1">Privacy Notice</p>
              <p>
                Journal entries, personal prayers, mood logs, and PINs stay on this device unless you sign in —
                signed-in data is stored in your Supabase project under Row Level Security and only you (or an
                admin acting on a reported-content review) can access it. We collect no analytics or advertising
                identifiers.
              </p>
            </div>
            <div>
              <p className="font-bold text-foreground text-sm mb-1">Terms of Use</p>
              <p>
                Use this library for personal study and fellowship. Do not post harmful, abusive, commercial, or
                doctrinally misleading content. Admins may remove content and suspend accounts that breach the
                Community Guidelines.
              </p>
            </div>
            <div>
              <p className="font-bold text-foreground text-sm mb-1">Community Guidelines</p>
              <p>
                Be gracious and truthful. No harassment, spam, solicitation, or sharing of others' private
                information. Report anything concerning via the Report button on a post or comment.
              </p>
            </div>
            <div>
              <p className="font-bold text-foreground text-sm mb-1">Content Licensing</p>
              <p>
                Scripture texts are reproduced under their publishers' licences (public-domain translations may be
                quoted freely; licensed translations are used under fair-use/quotation permissions). Original
                study notes and devotionals in this app are © Believers e-Library contributors.
              </p>
            </div>
            <p className="text-[10px] uppercase font-semibold">
              Full legal texts: docs/PRIVACY_NOTICE.md, docs/TERMS_OF_USE.md, docs/COMMUNITY_GUIDELINES.md,
              docs/CONTENT_LICENSING.md
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
