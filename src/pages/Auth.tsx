import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { isSupabaseConfigured } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { LogIn, UserPlus, Ghost, Eye, EyeOff, KeyRound, ArrowLeft, Cloud, HardDrive } from 'lucide-react';
import { toast } from 'sonner';
import { AppIcon } from '@/components/common/AppIcon';

export function Auth() {
  const { login, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState<'signin' | 'signup' | 'recover'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Please enter your email address');
      return;
    }
    if (view === 'signup' && !name.trim()) {
      toast.error('Please enter your full name');
      return;
    }
    if (view !== 'recover' && password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setSubmitting(true);
    try {
      if (view === 'recover') {
        const res = await resetPassword(email, newPassword);
        if (!res.ok) {
          toast.error(res.message || 'Could not reset password');
          return;
        }
        toast.success(res.message || 'Password recovery complete');
        setNewPassword('');
        setView('signin');
        return;
      }

      const res = await login(
        name.trim() || email.split('@')[0],
        false,
        email.trim(),
        password,
        view
      );
      if (!res.ok) {
        toast.error(res.message || 'Authentication failed');
        return;
      }
      toast.success(view === 'signin' ? 'Welcome back!' : 'Account created! Welcome to Believers Library.');
      navigate('/dashboard');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGuest = async () => {
    await login('Guest', true);
    toast.success('Welcome! You are browsing as a guest.');
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 bg-[url('https://storage.googleapis.com/dala-prod-public-storage/generated-images/f095a220-d4e4-4a6a-8aec-8a5aa9c8ce04/splash-screen-b8278544-1782601932220.webp')] bg-cover bg-center">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" />

      <Card className="w-full max-w-sm relative z-10 border-none bg-white/95 backdrop-blur-md shadow-2xl">
        <CardHeader className="text-center space-y-3 pb-4">
          <div className="flex justify-center">
            <AppIcon className="h-20 w-20 shadow-lg shadow-primary/10" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-3xl font-serif text-primary">
              Believers Library
            </CardTitle>
            <CardDescription className="text-muted-foreground italic">
              Grow spiritually every day
            </CardDescription>
          </div>
          <div className="flex justify-center pt-1">
            {isSupabaseConfigured ? (
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 border-none text-[10px] gap-1">
                <Cloud className="w-3 h-3" /> Cloud Sync Enabled
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-none text-[10px] gap-1" title="Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env to enable cloud sync">
                <HardDrive className="w-3 h-3" /> Device-Local Storage Mode
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {view === 'recover' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1 text-center">
                <h3 className="text-sm font-bold text-primary">Account Recovery</h3>
                <p className="text-xs text-muted-foreground">
                  {isSupabaseConfigured
                    ? 'Enter your email to receive a password reset link.'
                    : 'Enter your registered email and choose a new password for this device.'}
                </p>
              </div>
              <Input
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-white/70 border-primary/20"
                autoComplete="email"
              />
              {!isSupabaseConfigured && (
                <Input
                  type="password"
                  placeholder="New Password (min. 6 characters)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="bg-white/70 border-primary/20"
                  autoComplete="new-password"
                />
              )}
              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <KeyRound className="mr-2 w-4 h-4" />
                {submitting
                  ? 'Processing...'
                  : isSupabaseConfigured
                  ? 'Send Recovery Email'
                  : 'Reset Password'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full text-xs"
                onClick={() => setView('signin')}
              >
                <ArrowLeft className="mr-1.5 w-3.5 h-3.5" /> Back to Sign In
              </Button>
            </form>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-3.5">
                {view === 'signup' && (
                  <Input
                    placeholder="Full Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-white/70 border-primary/20"
                    autoComplete="name"
                  />
                )}
                <Input
                  type="email"
                  placeholder="Email Address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-white/70 border-primary/20"
                  autoComplete="email"
                />
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Password (min. 6 characters)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-white/70 border-primary/20 pr-10"
                    autoComplete={view === 'signin' ? 'current-password' : 'new-password'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {view === 'signin' && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setView('recover')}
                      className="text-xs text-primary/80 hover:text-primary hover:underline font-medium"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {view === 'signin' ? (
                    <LogIn className="mr-2 w-4 h-4" />
                  ) : (
                    <UserPlus className="mr-2 w-4 h-4" />
                  )}
                  {submitting
                    ? 'Please wait...'
                    : view === 'signin'
                    ? 'Sign In'
                    : 'Create Account'}
                </Button>
              </form>

              <div className="relative py-1">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase font-bold">
                  <span className="bg-white/95 px-2 text-muted-foreground">
                    Or explore first
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleGuest}
                  className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  <Ghost className="mr-2 w-4 h-4" /> Continue as Guest
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  {view === 'signin' ? "Don't have an account?" : 'Already have an account?'}{' '}
                  <button
                    type="button"
                    onClick={() => setView(view === 'signin' ? 'signup' : 'signin')}
                    className="text-primary font-semibold hover:underline"
                  >
                    {view === 'signin' ? 'Sign Up' : 'Sign In'}
                  </button>
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
