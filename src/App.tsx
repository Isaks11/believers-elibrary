import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
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

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/auth" />;

  return <>{children}</>;
}

function App() {
  const [showSplash, setShowSplash] = useState(true);

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
            <Route path="/admin" element={<Admin />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="top-center" richColors />
    </AuthProvider>
  );
}

export default App;