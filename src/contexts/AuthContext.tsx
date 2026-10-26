import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  findRegisteredUserByEmail,
  registerUser,
  updateRegisteredUserPassword,
  updateRegisteredUserProfile,
  verifyRegisteredUserPassword,
} from '@/data/userRegistry';
import { syncUserPreferencesWithServer } from '@/lib/securityAndSync';
import { syncPersonalJournalFromServer } from '@/data/journalData';
import { normalizeRole, type UserRole } from '@/lib/permissions';

// Single source of truth for the role union lives in `src/lib/permissions.ts`.
export type { UserRole };

export type User = {
  id: string;
  name: string;
  email?: string;
  isGuest: boolean;
  avatar?: string;
  /** Authoritative role: `profiles.role` from Postgres (server-enforced by RLS). */
  role: UserRole;
  /**
   * True for the optional, env-gated demo administrator. Demo sessions are
   * device-local only (no Supabase session), so they must never be enabled in
   * production — see `demoAdminConfig`.
   */
  isDemo?: boolean;
};

export type LoginResult = { ok: boolean; message?: string };

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  /** True when the session is backed by Supabase (server) rather than device-local-only. */
  isRemote: boolean;
  login: (
    name: string,
    isGuest: boolean,
    email?: string,
    password?: string,
    mode?: 'signin' | 'signup'
  ) => Promise<LoginResult>;
  resetPassword: (email: string, localNewPassword?: string) => Promise<LoginResult>;
  updateProfile: (patch: { name?: string; role?: UserRole }) => Promise<LoginResult>;
  logout: () => Promise<void>;
};

const USER_KEY = 'believers_user';

/** Device-local account registry key (mirrors `REGISTRY_KEY` in src/data/userRegistry.ts). */
const LOCAL_REGISTRY_KEY = 'believers_users';

/**
 * Reads the raw stored role for a local account.
 *
 * The registry helper (`getRegisteredUsers`) narrows stored roles to the legacy
 * 'user' | 'admin' pair, which would silently erase the 5-role values written
 * by the Users & Roles panel — so the raw entry is read here and normalized
 * with `normalizeRole` (unknown/legacy values → 'user').
 */
function readLocalRegistryRole(email: string): UserRole | undefined {
  try {
    const raw = localStorage.getItem(LOCAL_REGISTRY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return undefined;
    const match = parsed.find(
      (entry) =>
        entry &&
        typeof entry === 'object' &&
        String((entry as Record<string, unknown>).email || '').trim().toLowerCase() === email
    );
    if (!match) return undefined;
    const role = (match as Record<string, unknown>).role;
    return role === undefined ? undefined : normalizeRole(role, 'user');
  } catch {
    return undefined;
  }
}

/** Writes a (possibly 5-role) role straight into the raw local registry. */
function writeLocalRegistryRole(userId: string, role: UserRole): void {
  try {
    const raw = localStorage.getItem(LOCAL_REGISTRY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return;
    const idx = parsed.findIndex(
      (entry) =>
        entry && typeof entry === 'object' && (entry as Record<string, unknown>).id === userId
    );
    if (idx === -1) return;
    parsed[idx] = { ...parsed[idx], role };
    localStorage.setItem(LOCAL_REGISTRY_KEY, JSON.stringify(parsed));
  } catch {
    /* storage unavailable — role stays as it is */
  }
}

/**
 * Narrows a role for `registerUser`, whose local registry type only accepts the
 * legacy 'user' | 'admin' pair (the authoritative role always comes from the
 * session / profiles table, never from this mirror).
 */
function toRegistryRole(role: UserRole): 'user' | 'admin' {
  return role === 'admin' || role === 'super_admin' ? 'admin' : 'user';
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type DemoAdminConfig = {
  id: string;
  email: string;
  password: string;
  name: string;
};

/**
 * Built-in credentials for the demo administrator.
 *
 * Only used by `npm run dev` (Vite's DEV flag); production builds have no demo
 * account unless `VITE_DEMO_ADMIN_ENABLED=true` and both credentials are set.
 * These are intentionally public demo credentials, not a secret.
 */
const DEMO_ADMIN_DEFAULTS = {
  email: 'demo.admin@believerslibrary.com',
  password: 'DemoAdmin2026!',
  name: 'Demo Admin',
} as const;

/**
 * Optional device-local demo administrator.
 *
 * The explicit `VITE_DEMO_ADMIN_*` values always win. When they are absent, the
 * public demo account above is enabled automatically in development only, so a
 * fresh clone can review the Admin CMS without any `.env` setup. Production
 * builds get no demo account unless explicitly opted in.
 *
 * The demo session never touches Supabase Auth (no server session, no profiles
 * row) — it is device-local only.
 */
function demoAdminConfig(): DemoAdminConfig | null {
  const rawEnabled = (import.meta.env.VITE_DEMO_ADMIN_ENABLED as string | undefined)
    ?.trim()
    .toLowerCase();
  // An explicit flag always wins (so `false` can opt out of the dev default).
  const enabled = rawEnabled ? rawEnabled === 'true' : import.meta.env.DEV;
  if (!enabled) return null;

  const email = (
    (import.meta.env.VITE_DEMO_ADMIN_EMAIL as string | undefined)?.trim() ||
    (import.meta.env.DEV ? DEMO_ADMIN_DEFAULTS.email : '')
  ).toLowerCase();
  const password =
    (import.meta.env.VITE_DEMO_ADMIN_PASSWORD as string | undefined) ||
    (import.meta.env.DEV ? DEMO_ADMIN_DEFAULTS.password : '');
  if (!email || !password) return null;

  return {
    id: 'demo-admin-local',
    email,
    password,
    name: (import.meta.env.VITE_DEMO_ADMIN_NAME as string | undefined)?.trim() || DEMO_ADMIN_DEFAULTS.name,
  };
}

/** Bootstrap allow-list used only when the profiles table is unreachable or in local mode. */
function envAdminEmails(): string[] {
  const raw = import.meta.env.VITE_ADMIN_EMAILS as string | undefined;
  return (raw || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

async function loadProfile(userId: string, email: string | undefined, fallbackName: string): Promise<User> {
  const envRole: UserRole = email && envAdminEmails().includes(email.toLowerCase()) ? 'admin' : 'user';

  if (!supabase) {
    return { id: userId, name: fallbackName, email, isGuest: false, role: envRole };
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('name, role, email')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw error;
    return {
      id: userId,
      name: data?.name || fallbackName,
      email: data?.email || email,
      isGuest: false,
      // profiles.role may carry any of the five roles; unknown/legacy values
      // fall back to the env allow-list resolution ('admin' | 'user').
      role: normalizeRole(data?.role, envRole),
    };
  } catch {
    // Profiles table missing/unreachable — fall back to the env allow-list.
    return { id: userId, name: fallbackName, email, isGuest: false, role: envRole };
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRemote, setIsRemote] = useState(false);

  // --- Session bootstrap ---------------------------------------------------
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    const handleOnlineReconnect = () => {
      if (isSupabaseConfigured && supabase) {
        syncPersonalJournalFromServer().catch(() => {});
        syncUserPreferencesWithServer().catch(() => {});
      }
    };
    window.addEventListener('online', handleOnlineReconnect);

    if (isSupabaseConfigured && supabase) {
      (async () => {
        try {
          const { data } = await supabase.auth.getSession();
          const sessionUser = data.session?.user;
          if (sessionUser && !cancelled) {
            const profile = await loadProfile(
              sessionUser.id,
              sessionUser.email,
              (sessionUser.user_metadata?.name as string) || sessionUser.email?.split('@')[0] || 'Believer'
            );
            if (!cancelled) {
              setUser(profile);
              setIsRemote(true);
              localStorage.setItem(USER_KEY, JSON.stringify(profile));
              syncPersonalJournalFromServer().catch(() => {});
              syncUserPreferencesWithServer().catch(() => {});
            }
          } else if (!cancelled) {
            // Check if a guest or demo session was active. Real accounts always
            // come from Supabase, so only these device-local sessions restore.
            const savedUser = localStorage.getItem(USER_KEY);
            if (savedUser) {
              try {
                const parsed = JSON.parse(savedUser) as Partial<User>;
                if (parsed.isGuest) {
                  setUser({ ...parsed, role: 'user' } as User);
                } else if (parsed.isDemo) {
                  const demo = demoAdminConfig();
                  if (demo && parsed.email?.toLowerCase() === demo.email) {
                    setUser({ ...parsed, role: 'admin', isDemo: true } as User);
                  } else {
                    localStorage.removeItem(USER_KEY);
                  }
                }
              } catch {
                localStorage.removeItem(USER_KEY);
              }
            }
          }
        } catch {
          /* offline or not configured — fall through to local */
        }

        const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
          setTimeout(async () => {
            if (cancelled) return;
            if (!session?.user) return;
            const profile = await loadProfile(
              session.user.id,
              session.user.email,
              (session.user.user_metadata?.name as string) || session.user.email?.split('@')[0] || 'Believer'
            );
            if (!cancelled) {
              setUser(profile);
              setIsRemote(true);
              localStorage.setItem(USER_KEY, JSON.stringify(profile));
              syncPersonalJournalFromServer().catch(() => {});
              syncUserPreferencesWithServer().catch(() => {});
            }
          }, 0);
        });
        unsubscribe = () => sub.subscription.unsubscribe();

        if (!cancelled) setIsLoading(false);
      })();
    } else {
      // Device-local mode (no Supabase configured)
      const savedUser = localStorage.getItem(USER_KEY);
      if (savedUser) {
        try {
          const parsed = JSON.parse(savedUser) as Partial<User>;
          if (parsed.isDemo && !demoAdminConfig()) {
            localStorage.removeItem(USER_KEY);
          } else {
            setUser({ ...parsed, role: normalizeRole(parsed.role, 'user') } as User);
          }
        } catch {
          localStorage.removeItem(USER_KEY);
        }
      }
      setIsLoading(false);
    }

    return () => {
      cancelled = true;
      window.removeEventListener('online', handleOnlineReconnect);
      unsubscribe?.();
    };
  }, []);

  // --- Login / sign-up ----------------------------------------------------
  const login = useCallback(
    async (
      name: string,
      isGuest: boolean,
      email?: string,
      password?: string,
      mode: 'signin' | 'signup' = 'signin'
    ): Promise<LoginResult> => {
      if (isGuest) {
        const guestUser: User = {
          id: 'guest-local',
          name: name || 'Guest',
          isGuest: true,
          role: 'user',
        };
        setUser(guestUser);
        setIsRemote(false);
        localStorage.setItem(USER_KEY, JSON.stringify(guestUser));
        return { ok: true };
      }

      const normalizedEmail = email?.trim().toLowerCase();
      if (!normalizedEmail) {
        return { ok: false, message: 'Email address is required.' };
      }

      // Optional demo administrator (env-gated, device-local only).
      const demo = demoAdminConfig();
      if (demo && normalizedEmail === demo.email) {
        if (mode === 'signup') {
          return {
            ok: false,
            message: 'This email is reserved for the demo administrator. Switch to Sign In to use it.',
          };
        }
        if (password !== demo.password) {
          return { ok: false, message: 'Incorrect password for the demo administrator account.' };
        }
        const registered = registerUser({
          id: demo.id,
          name: demo.name,
          email: demo.email,
          password: demo.password,
          role: 'admin',
        });
        const demoUser: User = {
          id: registered?.id ?? demo.id,
          name: demo.name,
          email: demo.email,
          isGuest: false,
          role: 'admin',
          isDemo: true,
        };
        setUser(demoUser);
        setIsRemote(false);
        localStorage.setItem(USER_KEY, JSON.stringify(demoUser));
        return { ok: true, message: 'Signed in with the demo administrator account.' };
      }

      // Unconfigured backend → deterministic device-local authentication.
      if (!isSupabaseConfigured || !supabase) {
        const existing = findRegisteredUserByEmail(normalizedEmail);
        const isEnvAdmin = envAdminEmails().includes(normalizedEmail);

        if (mode === 'signin' && existing) {
          if (existing.passwordHash && !verifyRegisteredUserPassword(existing, password)) {
            return { ok: false, message: 'Incorrect password for this account.' };
          }
          // Env allow-list keeps its bootstrap precedence; otherwise the raw
          // stored role decides (registry reads narrow to 'user' | 'admin').
          const resolvedRole: UserRole = isEnvAdmin
            ? 'admin'
            : readLocalRegistryRole(normalizedEmail) ?? normalizeRole(existing.role, 'user');
          const localUser: User = {
            id: existing.id,
            name: existing.name || name || normalizedEmail.split('@')[0],
            email: normalizedEmail,
            isGuest: false,
            role: resolvedRole,
          };
          setUser(localUser);
          setIsRemote(false);
          localStorage.setItem(USER_KEY, JSON.stringify(localUser));
          return { ok: true };
        }

        if (mode === 'signup' && existing) {
          return { ok: false, message: 'An account with this email already exists. Please sign in.' };
        }

        const newId = existing?.id || `usr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
        const resolvedRole: UserRole = isEnvAdmin
          ? 'admin'
          : readLocalRegistryRole(normalizedEmail) ?? normalizeRole(existing?.role, 'user');
        const displayName = name.trim() || existing?.name || normalizedEmail.split('@')[0];

        registerUser({
          id: newId,
          name: displayName,
          email: normalizedEmail,
          password,
          role: toRegistryRole(resolvedRole),
        });

        const localUser: User = {
          id: newId,
          name: displayName,
          email: normalizedEmail,
          isGuest: false,
          role: resolvedRole,
        };
        setUser(localUser);
        setIsRemote(false);
        localStorage.setItem(USER_KEY, JSON.stringify(localUser));
        return { ok: true };
      }

      // Remote Supabase authentication
      if (!password || password.length < 6) {
        return { ok: false, message: 'Password must be at least 6 characters.' };
      }

      try {
        if (mode === 'signup') {
          const { data: signUp, error: signUpError } = await supabase.auth.signUp({
            email: normalizedEmail,
            password,
            options: { data: { name: name.trim() || normalizedEmail.split('@')[0] } },
          });
          if (signUpError) {
            return { ok: false, message: signUpError.message };
          }
          if (!signUp.session || !signUp.user) {
            return {
              ok: false,
              message: 'Account created! Please check your email inbox to confirm your account, then sign in.',
            };
          }
          const profile = await loadProfile(
            signUp.user.id,
            normalizedEmail,
            name.trim() || normalizedEmail.split('@')[0]
          );
          setUser(profile);
          setIsRemote(true);
          localStorage.setItem(USER_KEY, JSON.stringify(profile));
          registerUser({ id: profile.id, name: profile.name, email: normalizedEmail, role: toRegistryRole(profile.role) });
          return { ok: true };
        }

        const { data: signIn, error: signInError } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

        if (signInError) {
          return { ok: false, message: signInError.message };
        }

        if (!signIn.session || !signIn.user) {
          return { ok: false, message: 'Sign-in failed. Please try again.' };
        }
        const profile = await loadProfile(
          signIn.user.id,
          normalizedEmail,
          name.trim() || (signIn.user.user_metadata?.name as string) || normalizedEmail.split('@')[0]
        );
        setUser(profile);
        setIsRemote(true);
        localStorage.setItem(USER_KEY, JSON.stringify(profile));
        registerUser({ id: profile.id, name: profile.name, email: normalizedEmail, role: toRegistryRole(profile.role) });
        return { ok: true };
      } catch {
        return { ok: false, message: 'Could not reach the server. Check your connection and try again.' };
      }
    },
    []
  );

  const resetPassword = useCallback(async (email: string, localNewPassword?: string): Promise<LoginResult> => {
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      return { ok: false, message: 'Please enter your email address.' };
    }

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(normalized, {
          redirectTo: `${window.location.origin}/auth`,
        });
        if (error) return { ok: false, message: error.message };
        return { ok: true, message: 'Password reset instructions sent to your email.' };
      } catch {
        return { ok: false, message: 'Failed to send reset email. Check your network connection.' };
      }
    }

    // Device-local password reset
    const existing = findRegisteredUserByEmail(normalized);
    if (!existing) {
      return { ok: false, message: 'No local account found with that email address.' };
    }
    if (!localNewPassword || localNewPassword.length < 6) {
      return { ok: false, message: 'Please enter a new password (at least 6 characters).' };
    }
    updateRegisteredUserPassword(normalized, localNewPassword);
    return { ok: true, message: 'Local password updated! You can now sign in.' };
  }, []);

  const updateProfile = useCallback(
    async (patch: { name?: string; role?: UserRole }): Promise<LoginResult> => {
      if (!user) return { ok: false, message: 'Not signed in.' };

      const nextName = patch.name?.trim() || user.name;
      // Only allow local role switching when running in device-local mode (never override Supabase RLS role)
      const nextRole = !isRemote && patch.role ? patch.role : user.role;

      if (isRemote && supabase) {
        try {
          const { error } = await supabase
            .from('profiles')
            .update({ name: nextName })
            .eq('id', user.id);
          if (error) return { ok: false, message: error.message };
        } catch {
          return { ok: false, message: 'Could not update profile on server.' };
        }
      } else if (!user.isGuest) {
        // Name via the registry helper; the (possibly 5-role) role is written
        // raw so the Users & Roles panel / local switcher round-trips.
        updateRegisteredUserProfile(user.id, { name: nextName });
        writeLocalRegistryRole(user.id, nextRole);
      }

      const updatedUser: User = { ...user, name: nextName, role: nextRole };
      setUser(updatedUser);
      localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
      return { ok: true };
    },
    [user, isRemote]
  );

  const logout = async () => {
    try {
      if (supabase && isRemote) await supabase.auth.signOut();
    } catch {
      /* ignore network errors on sign-out */
    }
    setUser(null);
    setIsRemote(false);
    localStorage.removeItem(USER_KEY);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, isRemote, login, resetPassword, updateProfile, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
