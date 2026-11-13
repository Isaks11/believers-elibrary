import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { isSupabaseConfigured } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AppIcon } from '@/components/common/AppIcon';
import { ArrowLeft, Mail, KeyRound, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

export function ForgotPassword() {
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Please enter your email address');
      return;
    }
    if (!isSupabaseConfigured) {
      if (!newPassword || newPassword.length < 6) {
        toast.error('New password must be at least 6 characters');
        return;
      }
      if (newPassword !== confirmPassword) {
        toast.error('Passwords do not match');
        return;
      }
    }
    setSubmitting(true);
    try {
      const res = await resetPassword(email.trim(), newPassword);
      if (!res.ok) {
        toast.error(res.message || 'Could not process request');
        return;
      }
      toast.success(res.message || 'Request processed');
      if (isSupabaseConfigured) {
        setSent(true);
      } else {
        navigate('/auth');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-[#0d1830] to-slate-950 flex flex-col">
      <div className="flex-1 flex items-center justify-center p-5 sm:p-8">
        <Card className="w-full max-w-md border-white/10 bg-white/[0.98] backdrop-blur-xl shadow-2xl shadow-black/20 rounded-3xl overflow-hidden">
          <CardHeader className="text-center space-y-4 pb-2 pt-8 px-6 sm:px-8">
            <div className="flex justify-center">
              <AppIcon className="h-16 w-16 sm:h-20 sm:w-20 shadow-lg rounded-2xl" />
            </div>
            <div className="space-y-1.5">
              <CardTitle className="text-2xl sm:text-3xl font-serif text-primary tracking-tight">Forgot Password</CardTitle>
              <CardDescription className="text-sm text-muted-foreground leading-relaxed">
                {isSupabaseConfigured
                  ? 'Enter your email and we’ll send you a secure link to set a new password.'
                  : 'Reset your account password securely on this device.'}
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="px-6 sm:px-8 pb-8 pt-4">
            {sent ? (
              <div className="space-y-5 text-center">
                <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                  <Mail className="w-7 h-7" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-base font-semibold text-primary">Check your email</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    We sent a password reset link to <span className="font-medium text-foreground">{email}</span>. Open the link to create a new password.
                  </p>
                </div>
                <div className="space-y-2 pt-1">
                  <Button asChild className="w-full h-11 rounded-xl">
                    <Link to="/auth">Back to Sign In</Link>
                  </Button>
                  <Button variant="ghost" className="w-full h-11 rounded-xl" onClick={() => setSent(false)}>
                    Use a different email
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Email address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-11 pl-10 rounded-xl bg-secondary/30 border-border/60"
                      autoComplete="email"
                    />
                  </div>
                </div>

                {!isSupabaseConfigured && (
                  <>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">New password</label>
                      <div className="relative">
                        <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          type="password"
                          placeholder="At least 6 characters"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="h-11 pl-10 rounded-xl bg-secondary/30 border-border/60"
                          autoComplete="new-password"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">Confirm new password</label>
                      <div className="relative">
                        <ShieldCheck className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          type="password"
                          placeholder="Re-enter new password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="h-11 pl-10 rounded-xl bg-secondary/30 border-border/60"
                          autoComplete="new-password"
                        />
                      </div>
                    </div>
                  </>
                )}

                <Button type="submit" disabled={submitting} className="w-full h-11 rounded-xl font-semibold mt-2">
                  {submitting ? 'Please wait…' : isSupabaseConfigured ? 'Send reset link' : 'Update password'}
                </Button>

                <Button asChild variant="ghost" className="w-full h-11 rounded-xl text-muted-foreground">
                  <Link to="/auth"><ArrowLeft className="w-4 h-4 mr-2" /> Back to Sign In</Link>
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
