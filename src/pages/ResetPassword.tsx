import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AppIcon } from '@/components/common/AppIcon';
import { ArrowLeft, KeyRound, ShieldCheck, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export function ResetPassword() {
  const { updatePassword, isPasswordRecovery, clearPasswordRecovery } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [ready, setReady] = useState(!isSupabaseConfigured);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setReady(true);
      return;
    }
    // Supabase processes the recovery token from URL hash/query and may emit PASSWORD_RECOVERY.
    // Give it a moment; also check for existing session (recovery creates a session).
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        if (data.session) {
          setReady(true);
          setErrorMsg(null);
        } else if (!isPasswordRecovery) {
          setErrorMsg('This password reset link is invalid or has expired. Please request a new one.');
        } else {
          setReady(true);
        }
      } catch {
        if (!cancelled) setErrorMsg('Could not verify reset link. Please request a new one.');
      }
    }, 800);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isPasswordRecovery]);

  useEffect(() => {
    if (isPasswordRecovery) setReady(true);
  }, [isPasswordRecovery]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (password !== confirm) {
      toast.error('Passwords do not match');
      return;
    }
    setSubmitting(true);
    try {
      const res = await updatePassword(password);
      if (!res.ok) {
        toast.error(res.message || 'Could not update password');
        return;
      }
      toast.success(res.message || 'Password updated successfully');
      clearPasswordRecovery();
      navigate('/auth');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-[#0d1830] to-slate-950 flex items-center justify-center p-5">
        <Card className="w-full max-w-md rounded-3xl">
          <CardContent className="p-8 text-center space-y-4">
            <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
            <p className="text-sm text-muted-foreground">To reset a password on this device, use the Forgot Password page.</p>
            <Button asChild className="w-full"><Link to="/auth/forgot-password">Go to Forgot Password</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-[#0d1830] to-slate-950 flex items-center justify-center p-5 sm:p-8">
      <Card className="w-full max-w-md border-white/10 bg-white/[0.98] backdrop-blur-xl shadow-2xl shadow-black/20 rounded-3xl overflow-hidden">
        <CardHeader className="text-center space-y-4 pb-2 pt-8 px-6 sm:px-8">
          <div className="flex justify-center">
            <AppIcon className="h-16 w-16 sm:h-20 sm:w-20 shadow-lg rounded-2xl" />
          </div>
          <div className="space-y-1.5">
            <CardTitle className="text-2xl sm:text-3xl font-serif text-primary tracking-tight">Set New Password</CardTitle>
            <CardDescription className="text-sm text-muted-foreground leading-relaxed">
              Choose a strong password to secure your account.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="px-6 sm:px-8 pb-8 pt-4">
          {errorMsg && !ready ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <p className="text-sm text-muted-foreground">{errorMsg}</p>
              <div className="space-y-2">
                <Button asChild className="w-full h-11 rounded-xl"><Link to="/auth/forgot-password">Request new link</Link></Button>
                <Button asChild variant="ghost" className="w-full h-11 rounded-xl"><Link to="/auth"><ArrowLeft className="w-4 h-4 mr-2" /> Back to Sign In</Link></Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {!ready && (
                <div className="text-xs text-muted-foreground text-center py-2">Verifying secure reset link…</div>
              )}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">New password</label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="password"
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 pl-10 rounded-xl bg-secondary/30 border-border/60"
                    autoComplete="new-password"
                    disabled={!ready}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Confirm password</label>
                <div className="relative">
                  <ShieldCheck className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="password"
                    placeholder="Re-enter new password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="h-11 pl-10 rounded-xl bg-secondary/30 border-border/60"
                    autoComplete="new-password"
                    disabled={!ready}
                  />
                </div>
              </div>
              <div className="rounded-xl bg-secondary/40 border border-border/50 p-3 text-[11px] text-muted-foreground flex gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>Use at least 6 characters. After updating, you can sign in with your new password.</span>
              </div>
              <Button type="submit" disabled={submitting || !ready} className="w-full h-11 rounded-xl font-semibold">
                {submitting ? 'Updating…' : 'Update password'}
              </Button>
              <Button asChild variant="ghost" className="w-full h-11 rounded-xl text-muted-foreground">
                <Link to="/auth"><ArrowLeft className="w-4 h-4 mr-2" /> Back to Sign In</Link>
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
