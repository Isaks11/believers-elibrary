import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { initDailyReminderScheduler } from '@/lib/notifications';
import { can } from '@/lib/permissions';
import { AppLayout } from '@/components/layout/AppLayout';
import { Home } from '@/pages/Home';
import { Auth } from '@/pages/Auth';
import { Devotional } from '@/pages/Devotional';
import { HymnBook } from '@/pages/HymnBook';
import { Bible } from '@/pages/Bible';
import { Community } from '@/pages/Community';
import { Profile } from '@/pages/Profile';
import { FaithGuide } from '@/pages/FaithGuide';
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
              Your account does not have administrator permissions to view or modify platform content. Server writes are protected by PostgreSQL Row Level Security.
            </p>
          </div>
          <div className="flex flex-col gap-2 pt-2">
            <Button size="sm" onClick={() => navigate('/dashboard')} className="w-full gap-1.5">
              <ArrowLeft className="w-4 h-4" /> Return to Dashboard
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate('/profile')} className="w-full gap-1.5">
              <Settings className="w-4 h-4" /> Account & Role Settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ProtectedRoute({ children, requireAdmin = false }: { children: React.ReactNode; requireAdmin?: boolean }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  // Frontend guard for UX; Supabase RLS (`public.has_role(...)`) is the authoritative server enforcement.
  // Anyone who can contribute content (contributor/editor/admin/super_admin) may open the CMS shell;
  // individual sections and actions are gated by `can()` inside the page.
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
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route path="/" element={<Home />} />
            <Route path="/bible" element={<Bible />} />
            <Route path="/devotional" element={<Devotional />} />
            <Route path="/hymns" element={<HymnBook />} />
            <Route path="/community" element={<Community />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/faithguide" element={<FaithGuide />} />
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