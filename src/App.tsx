import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { initDailyReminderScheduler } from '@/lib/notifications';
import { can } from '@/lib/permissions';
import { AppLayout } from '@/components/layout/AppLayout';
import { syncFaithDataFromServer } from '@/data/mockFaithData';
import { syncPersonalJournalFromServer } from '@/data/journalData';
import { loadAllPublishedDevotionals, loadPublishedHymns, loadPublishedReadingPlans, loadPublishedVideos, loadPublishedFaithResources, loadDailyVerse } from '@/lib/contentSource';
import { loadDonationSettings } from '@/lib/donationSettings';
import { recordAppVisit } from '@/lib/visitorAnalytics';
import { getKeepScreenOn } from '@/lib/devicePreferences';
import { Home } from '@/pages/Home';
import { Auth } from '@/pages/Auth';
import { ForgotPassword } from '@/pages/ForgotPassword';
import { ResetPassword } from '@/pages/ResetPassword';
import { Devotional } from '@/pages/Devotional';
import { HymnBook } from '@/pages/HymnBook';
import { Bible } from '@/pages/Bible';
import { Profile } from '@/pages/Profile';
import { Admin } from '@/pages/Admin';
import { Journal } from '@/pages/Journal';
import { ELibrary } from '@/pages/ELibrary';
import { PrayerAlertsNews } from '@/pages/PrayerAlertsNews';
import { UserDashboard } from '@/pages/UserDashboard';
import { SplashScreen } from '@/components/layout/SplashScreen';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldAlert, ArrowLeft, Settings } from 'lucide-react';

function AdminAccessDenied() {
  const navigate = useNavigate();
  return (
    <div className="py-12 px-2">
      <Card className="border-none shadow-lg bg-card">
        <CardContent className="p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-serif font-bold text-primary">Administrator Access Required</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Your account does not have permission to manage this section. Please contact an administrator if you need access.
            </p>
          </div>
          <div className="flex flex-col gap-2 pt-2">
            <Button size="sm" onClick={() => navigate('/dashboard')} className="w-full gap-1.5">
              <ArrowLeft className="w-4 h-4" /> Return to Dashboard
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate('/profile')} className="w-full gap-1.5">
              <Settings className="w-4 h-4" /> Account Settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ContentSync() {
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!('wakeLock' in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const syncWakeLock = async () => {
      const enabled = getKeepScreenOn();
      if (!enabled) {
        if (sentinel) {
          await sentinel.release().catch(() => {});
          sentinel = null;
        }
        return;
      }
      if (document.visibilityState !== 'visible') return;
      try {
        if (!sentinel) {
          sentinel = await navigator.wakeLock.request('screen');
          if (cancelled && sentinel) {
            await sentinel.release().catch(() => {});
            sentinel = null;
          }
        }
      } catch {
        /* Wake lock may fail on battery saver or unsupported contexts */
      }
    };

    void syncWakeLock();
    const onToggle = () => void syncWakeLock();
    const onVisibility = () => void syncWakeLock();
    window.addEventListener('believers:keep-screen-on', onToggle);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      window.removeEventListener('believers:keep-screen-on', onToggle);
      document.removeEventListener('visibilitychange', onVisibility);
      if (sentinel) {
        void sentinel.release().catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    if (isLoading || !user) return;
    void recordAppVisit(!user.isGuest);

    const preloadImages = () => {
      const urls = [
        '/brand-logo.png',
        'https://storage.googleapis.com/dala-prod-public-storage/generated-images/f095a220-d4e4-4a6a-8aec-8a5aa9c8ce04/devotional-cover-1-cb4ac9fc-1782601932817.webp',
        'https://storage.googleapis.com/dala-prod-public-storage/generated-images/f095a220-d4e4-4a6a-8aec-8a5aa9c8ce04/bible-module-bg-2d68d807-1782601933195.webp',
        'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=1400&q=80',
        'https://images.unsplash.com/photo-1474511320723-9a56873867b5?auto=format&fit=crop&w=1400&q=80',
      ];
      urls.forEach((url) => {
        try {
          const img = new Image();
          img.decoding = 'async';
          img.src = url;
        } catch { /* ignore */ }
      });
    };

    const syncAndCache = async () => {
      preloadImages();
      if (!navigator.onLine) return;
      try {
        // After first successful connection, persist key server content locally
        // so the app can work offline with cached data.
        await Promise.allSettled([
          loadAllPublishedDevotionals(),
          loadPublishedHymns(),
          loadPublishedReadingPlans(),
          loadPublishedVideos(),
          loadPublishedFaithResources(),
          syncFaithDataFromServer(),
          syncPersonalJournalFromServer(),
          loadDailyVerse(),
          loadDonationSettings(),
        ]);
      } catch {
        // Local cached content remains available offline.
      }
    };

    void syncAndCache();
    window.addEventListener('online', syncAndCache);
    return () => window.removeEventListener('online', syncAndCache);
  }, [isLoading, user?.id]);

  return null;
}

function ProtectedRoute({ children, requireAdmin = false }: { children: React.ReactNode; requireAdmin?: boolean }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  // Anyone who can contribute content (contributor/editor/admin/super_admin) may open the CMS shell;
  // individual sections and actions are gated by permissions in the page.
  if (requireAdmin && !can(user.role, 'content:create')) return <AdminAccessDenied />;

  return <>{children}</>;
}

function App() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const stop = initDailyReminderScheduler();
    return stop;
  }, []);

  return (
    <AuthProvider>
      <ContentSync />
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/auth/forgot-password" element={<ForgotPassword />} />
          <Route path="/auth/reset-password" element={<ResetPassword />} />
          <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route path="/" element={<Home />} />
            <Route path="/bible" element={<Bible />} />
            <Route path="/devotional" element={<Devotional />} />
            <Route path="/hymns" element={<HymnBook />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/journal" element={<Journal />} />
            <Route path="/library" element={<ELibrary />} />
            <Route path="/prayer-news" element={<PrayerAlertsNews />} />
            <Route path="/dashboard" element={<UserDashboard />} />
            <Route path="/admin" element={<ProtectedRoute requireAdmin><Admin /></ProtectedRoute>} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="top-center" richColors />
    </AuthProvider>
  );
}

export default App;