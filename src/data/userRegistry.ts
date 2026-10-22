/**
 * Local registry of accounts that have signed in on this device.
 * Used when Supabase is not configured so sign-up, sign-in, password reset,
 * and user identity remain consistent across sessions on the same device.
 *
 * Security Hardening (Phase 4):
 * Passwords are never stored in plaintext; only salted deterministic hashes
 * (`passwordHash`) are persisted in `localStorage`.
 */
import { computeSaltedHash, verifySaltedHash } from '@/lib/securityAndSync';
import { normalizeRole, type UserRole } from '@/lib/permissions';

export type RegisteredUser = {
  id: string;
  name: string;
  email: string;
  /** Salted hash (`sh256-v1:<salt>:<hex>`). Legacy `password` field is migrated and removed. */
  passwordHash?: string;
  /** Five-role model (user → contributor → editor → admin → super_admin). */
  role?: UserRole;
  createdAt: string;
};

const REGISTRY_KEY = 'believers_users';

export function getRegisteredUsers(): RegisteredUser[] {
  try {
    const raw = localStorage.getItem(REGISTRY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];

    // Migrate any legacy plaintext password fields on read
    let migrated = false;
    const cleaned: RegisteredUser[] = parsed.map((u: Record<string, unknown>) => {
      const email = String(u.email || '').trim().toLowerCase();
      const id = String(u.id || '');
      let passwordHash = typeof u.passwordHash === 'string' ? u.passwordHash : undefined;
      if (!passwordHash && typeof u.password === 'string' && u.password.length > 0) {
        passwordHash = computeSaltedHash(u.password, email || id);
        migrated = true;
      }
      return {
        id,
        name: String(u.name || ''),
        email,
        ...(passwordHash ? { passwordHash } : {}),
        role: normalizeRole(u.role, 'user'),
        createdAt: String(u.createdAt || new Date().toISOString()),
      };
    });

    if (migrated) {
      saveRegisteredUsers(cleaned);
    }
    return cleaned;
  } catch {
    return [];
  }
}

function saveRegisteredUsers(users: RegisteredUser[]): void {
  try {
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(users));
  } catch {
    /* storage unavailable */
  }
}

export function findRegisteredUserByEmail(email: string): RegisteredUser | undefined {
  const normalized = email.trim().toLowerCase();
  return getRegisteredUsers().find((u) => u.email?.toLowerCase() === normalized);
}

export function verifyRegisteredUserPassword(user: RegisteredUser, candidatePassword?: string): boolean {
  if (!user.passwordHash) return true;
  if (!candidatePassword) return false;
  return verifySaltedHash(candidatePassword, user.passwordHash, user.email.toLowerCase());
}

export function registerUser(user: {
  id: string;
  name: string;
  email?: string;
  password?: string;
  role?: UserRole;
}): RegisteredUser | null {
  if (!user.email) return null; // guests are not registered accounts
  const normalized = user.email.trim().toLowerCase();
  const users = getRegisteredUsers();
  const existingIdx = users.findIndex((u) => u.email?.toLowerCase() === normalized);
  const nextHash = user.password ? computeSaltedHash(user.password, normalized) : undefined;

  if (existingIdx !== -1) {
    const updated: RegisteredUser = {
      ...users[existingIdx],
      name: user.name || users[existingIdx].name,
      role: user.role ?? users[existingIdx].role ?? 'user',
      ...(nextHash ? { passwordHash: nextHash } : {}),
    };
    users[existingIdx] = updated;
    saveRegisteredUsers(users);
    return updated;
  }

  const created: RegisteredUser = {
    id: user.id,
    name: user.name,
    email: normalized,
    ...(nextHash ? { passwordHash: nextHash } : {}),
    role: user.role ?? 'user',
    createdAt: new Date().toISOString(),
  };
  users.push(created);
  saveRegisteredUsers(users);
  return created;
}

export function updateRegisteredUserPassword(email: string, newPassword: string): boolean {
  const normalized = email.trim().toLowerCase();
  const users = getRegisteredUsers();
  const idx = users.findIndex((u) => u.email?.toLowerCase() === normalized);
  if (idx === -1) return false;
  users[idx] = {
    ...users[idx],
    passwordHash: computeSaltedHash(newPassword, normalized),
  };
  saveRegisteredUsers(users);
  return true;
}

export function updateRegisteredUserProfile(
  id: string,
  patch: Partial<Pick<RegisteredUser, 'name' | 'role'>>
): RegisteredUser | null {
  const users = getRegisteredUsers();
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) return null;
  users[idx] = { ...users[idx], ...patch };
  saveRegisteredUsers(users);
  return users[idx];
}

