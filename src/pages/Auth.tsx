import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { LogIn, UserPlus, Ghost, Eye, EyeOff, Mail, Lock, User, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { AppIcon } from '@/components/common/AppIcon';
import { getCachedPrivacySettings, loadPrivacySettings, type PrivacySettings } from '@/lib/privacySettings';

export function Auth() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [privacy, setPrivacy] = useState<PrivacySettings>(() => getCachedPrivacySettings());

  useEffect(() => {
    let cancelled = false;
    loadPrivacySettings().then((s) => {
      if (!cancelled) setPrivacy(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
    if (view === 'signup' && !acceptedPrivacy) {
      toast.error('Please read and accept the Privacy Terms to create an account');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setSubmitting(true);
    try {
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
      if (view === 'signup') {
        try {
          localStorage.setItem('believers_privacy_accepted_at', new Date().toISOString());
        } catch {
          /* ignore */
        }
      }
      toast.success(view === 'signin' ? 'Welcome back!' : 'Account created! Welcome to Believers e-Library.');
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
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-[#0d1830] to-slate-950 flex flex-col">
      {/* subtle top glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(60%_60%_at_50%_0%,rgba(212,175,55,0.18),transparent_70%)]" />

      <div className="relative flex-1 flex flex-col items-center justify-center p-5 sm:p-8">
        <div className="w-full max-w-md space-y-5">
          {/* Brand */}
          <div className="text-center space-y-3 px-2">
            <div className="flex justify-center">
              <AppIcon className="h-20 w-20 sm:h-24 sm:w-24 rounded-3xl shadow-xl shadow-black/30 ring-1 ring-white/10" />
            </div>
            <div className="space-y-1">
              <h1 className="text-3xl sm:text-4xl font-serif font-bold text-white tracking-tight">Believers e-Library</h1>
              <p className="text-sm sm:text-base text-slate-300/90">Grow spiritually every day</p>
            </div>
          </div>

          <Card className="border-white/10 bg-white/[0.98] backdrop-blur-xl shadow-2xl shadow-black/25 rounded-3xl overflow-hidden">
            <CardHeader className="pb-2 pt-6 px-6 sm:px-8">
              <div className="flex items-center justify-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setView('signin')}
                  className={`flex-1 h-9 rounded-lg text-sm font-semibold transition-all ${view === 'signin' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setView('signup')}
                  className={`flex-1 h-9 rounded-lg text-sm font-semibold transition-all ${view === 'signup' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Create Account
                </button>
              </div>
              <div className="pt-3 text-center">
                <CardTitle className="text-lg font-semibold text-slate-900">
                  {view === 'signin' ? 'Welcome back' : 'Join the community'}
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm text-slate-600">
                  {view === 'signin'
                    ? 'Sign in to access devotionals, hymns, and your saved content.'
                    : 'Create an account to save progress and access your content anywhere.'}
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="px-6 sm:px-8 pb-7 pt-3 space-y-4">
              <form onSubmit={handleSubmit} className="space-y-3.5">
                {view === 'signup' && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Full name</label>
                    <div className="relative">
                      <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <Input
                        placeholder="Your name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="h-11 pl-10 rounded-xl bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus-visible:ring-primary/30"
                        autoComplete="name"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Email address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-11 pl-10 rounded-xl bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus-visible:ring-primary/30"
                      autoComplete="email"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700">Password</label>
                    {view === 'signin' && (
                      <Link to="/auth/forgot-password" className="text-xs font-semibold text-primary hover:underline">
                        Forgot password?
                      </Link>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="At least 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-11 pl-10 pr-10 rounded-xl bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus-visible:ring-primary/30"
                      autoComplete={view === 'signin' ? 'current-password' : 'new-password'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {view === 'signup' && (
                  <div className="flex items-start gap-2.5 pt-1">
                    <input
                      id="accept-privacy"
                      type="checkbox"
                      checked={acceptedPrivacy}
                      onChange={(e) => setAcceptedPrivacy(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30 cursor-pointer"
                    />
                    <label htmlFor="accept-privacy" className="text-xs text-slate-600 leading-relaxed cursor-pointer">
                      I have read and accept the{' '}
                      <button
                        type="button"
                        onClick={() => setPrivacyOpen(true)}
                        className="font-semibold text-primary underline underline-offset-2 hover:text-primary/80"
                      >
                        Privacy Terms
                      </button>
                      .
                    </label>
                  </div>
                )}

                <Button type="submit" disabled={submitting} className="w-full h-11 rounded-xl font-semibold text-sm mt-1">
                  {view === 'signin' ? <LogIn className="mr-2 w-4 h-4" /> : <UserPlus className="mr-2 w-4 h-4" />}
                  {submitting ? 'Please wait…' : view === 'signin' ? 'Sign In' : 'Create Account'}
                </Button>
              </form>

              <div className="relative py-1">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border/60" /></div>
                <div className="relative flex justify-center text-[11px] uppercase tracking-wide font-semibold">
                  <span className="bg-white px-2.5 text-muted-foreground">or</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={handleGuest}
                className="w-full h-11 rounded-xl font-semibold border-slate-300 bg-slate-50 text-slate-800 hover:bg-slate-100"
              >
                <Ghost className="mr-2 w-4 h-4" /> Continue as Guest
              </Button>

              <p className="text-center text-[11px] text-slate-500 leading-relaxed px-2">
                By continuing, you agree to use Believers e-Library responsibly. Guest access lets you explore without an account.
              </p>
            </CardContent>
          </Card>

          <p className="text-center text-[11px] text-slate-400/80 px-4">
            Need help signing in? Use <Link to="/auth/forgot-password" className="text-amber-300/90 hover:text-amber-200 underline underline-offset-2">Forgot password</Link>.
          </p>
        </div>
      </div>

      <Dialog open={privacyOpen} onOpenChange={setPrivacyOpen}>
        <DialogContent className="max-w-md rounded-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-serif text-primary">
              <ShieldCheck className="w-5 h-5" />
              {privacy.title}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto pr-1 text-xs sm:text-sm text-muted-foreground leading-relaxed whitespace-pre-line flex-1">
            {privacy.content}
          </div>
          <DialogFooter className="gap-2 pt-2 border-t border-border/40">
            <Button type="button" variant="outline" size="sm" onClick={() => setPrivacyOpen(false)}>
              Close
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setAcceptedPrivacy(true);
                setPrivacyOpen(false);
              }}
            >
              Accept &amp; Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
