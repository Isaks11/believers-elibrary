/**
 * Users & Roles API.
 *
 * Two honest modes:
 * - Cloud (a real Supabase session): profiles are listed from Postgres, role
 *   assignment goes through the `admin-users` Edge Function first (server-side
 *   caller verification) and falls back to a direct `profiles` update, which
 *   RLS + the escalation trigger still police. User creation always goes
 *   through the Edge Function because it needs the service-role key.
 * - Device-local (no Supabase session, e.g. the demo admin): the browser
 *   registry (`believers_users`) is managed directly by UserRolePanel.
 *
 * Escalation rules mirror `src/lib/permissions.ts`: nobody may grant a role
 * above their own unless they are a super_admin.
 */

import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { friendlyBackendError } from '@/lib/backendHealth';
import { isHigherRole, normalizeRole, type UserRole } from '@/lib/permissions';

export const ADMIN_USERS_FUNCTION = 'admin-users';

export type AdminUser = {
  id: string;
  name: string | null;
  email: string | null;
  role: UserRole;
  createdAt: string | null;
};

export type AdminUsersResult = {
  ok: boolean;
  users?: AdminUser[];
  message?: string;
};

export type AdminUserMutationResult = {
  ok: boolean;
  user?: AdminUser;
  message?: string;
};

/** Extra context returned by the Edge Function (create/set_role/delete). */
type FunctionPayload = {
  ok?: boolean;
  message?: string;
  user?: Record<string, unknown>;
};

function toAdminUser(row: Record<string, unknown>): AdminUser {
  return {
    id: String(row.id ?? ''),
    name: typeof row.name === 'string' ? row.name : null,
    email: typeof row.email === 'string' ? row.email : null,
    role: normalizeRole(row.role, 'user'),
    createdAt: typeof row.created_at === 'string' ? row.created_at : null,
  };
}

/** True when the Edge Function is missing / not deployed (404-style failures). */
function functionMissing(raw: string): boolean {
  const message = (raw || '').toLowerCase();
  return (
    message.includes('not found') ||
    message.includes('404') ||
    message.includes('failed to fetch') ||
    message.includes('functions') && message.includes('error')
  );
}

/**
 * Lists the server-side profiles. Requires the caller to hold `users:manage`
 * (checked in the UI) plus an admin profile server-side (RLS enforced).
 */
export async function listServerUsers(): Promise<AdminUsersResult> {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, message: 'Supabase is not configured — users live on this device only.' };
  }
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, email, role, created_at')
      .order('created_at', { ascending: true })
      .limit(500);
    if (error) {
      return { ok: false, message: friendlyBackendError(error.message) };
    }
    const users = ((data ?? []) as unknown as Record<string, unknown>[]).map(toAdminUser);
    return { ok: true, users };
  } catch (err) {
    return {
      ok: false,
      message: friendlyBackendError(err instanceof Error ? err.message : 'Could not load profiles.'),
    };
  }
}

/**
 * Creates a real auth user (email + password) and assigns its role.
 *
 * Only the `admin-users` Edge Function can do this: it runs with the
 * service-role key after verifying the caller is an admin. Deploy it with
 * `supabase functions deploy admin-users` and set SUPABASE_SERVICE_ROLE_KEY.
 */
export async function createServerUser(input: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}): Promise<AdminUserMutationResult> {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, message: 'Supabase is not configured — users can only be created on this device.' };
  }
  try {
    const { data, error } = await supabase.functions.invoke(ADMIN_USERS_FUNCTION, {
      body: {
        action: 'create',
        name: input.name.trim(),
        email: input.email.trim().toLowerCase(),
        password: input.password,
        role: input.role,
      },
    });
    if (error) {
      return { ok: false, message: friendlyBackendError(error.message) };
    }
    const payload = (data ?? {}) as FunctionPayload;
    if (!payload.ok) {
      return { ok: false, message: payload.message || 'The server rejected the new user.' };
    }
    const user = payload.user ? toAdminUser(payload.user) : undefined;
    return {
      ok: true,
      user,
      message: payload.message || `Account created${user?.email ? ` for ${user.email}` : ''}.`,
    };
  } catch (err) {
    return {
      ok: false,
      message: friendlyBackendError(
        err instanceof Error ? err.message : 'Could not reach the admin-users function.'
      ),
    };
  }
}

/**
 * Assigns a role to an existing user.
 *
 * Prefers the Edge Function (server-verified rules); if it is not deployed the
 * direct `profiles` update is attempted — RLS (`profiles_update_admin`) and
 * the escalation trigger still enforce every rule server-side.
 */
export async function setServerUserRole(
  targetUserId: string,
  next: UserRole,
  self: { id: string | null; role: UserRole }
): Promise<AdminUserMutationResult> {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, message: 'Supabase is not configured — role changes apply to this device only.' };
  }
  if (self.role !== 'super_admin' && isHigherRole(next, self.role)) {
    return {
      ok: false,
      message: `You cannot grant a role higher than your own (${next}).`,
    };
  }
  if (targetUserId === self.id) {
    return { ok: false, message: 'Use your own profile page to change your role.' };
  }

  try {
    const { data, error } = await supabase.functions.invoke(ADMIN_USERS_FUNCTION, {
      body: { action: 'set_role', user_id: targetUserId, role: next },
    });
    if (error && !functionMissing(error.message)) {
      return { ok: false, message: friendlyBackendError(error.message) };
    }
    const payload = (data ?? {}) as FunctionPayload;
    if (!error && payload.ok) {
      const user = payload.user ? toAdminUser(payload.user) : undefined;
      return { ok: true, user, message: payload.message || `Role updated to ${next}.` };
    }

    // Edge Function absent → direct, RLS-guarded update.
    const { data: updated, error: updateError } = await supabase
      .from('profiles')
      .update({ role: next })
      .eq('id', targetUserId)
      .select('id, name, email, role, created_at')
      .maybeSingle();
    if (updateError) {
      return { ok: false, message: friendlyBackendError(updateError.message) };
    }
    const user = updated ? toAdminUser(updated as unknown as Record<string, unknown>) : undefined;
    return { ok: true, user, message: `Role updated to ${next}.` };
  } catch (err) {
    return {
      ok: false,
      message: friendlyBackendError(err instanceof Error ? err.message : 'Could not update the role.'),
    };
  }
}

/** Deletes a user account (Edge Function + service role only). */
export async function deleteServerUser(
  targetUserId: string,
  self: { id: string | null; role: UserRole }
): Promise<AdminUserMutationResult> {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, message: 'Supabase is not configured.' };
  }
  if (targetUserId === self.id) {
    return { ok: false, message: 'You cannot delete your own account here.' };
  }
  try {
    const { data, error } = await supabase.functions.invoke(ADMIN_USERS_FUNCTION, {
      body: { action: 'delete', user_id: targetUserId },
    });
    if (error) {
      return { ok: false, message: friendlyBackendError(error.message) };
    }
    const payload = (data ?? {}) as FunctionPayload;
    if (!payload.ok) {
      return { ok: false, message: payload.message || 'The server rejected the deletion.' };
    }
    return { ok: true, message: payload.message || 'User deleted.' };
  } catch (err) {
    return {
      ok: false,
      message: friendlyBackendError(err instanceof Error ? err.message : 'Could not delete the user.'),
    };
  }
}
