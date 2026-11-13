// Supabase Edge Function: admin-users
// ---------------------------------------------------------------------------
// Secure user management for the Believers e-Library Admin "Users & Roles"
// page. Deploy with:
//
//   supabase functions deploy admin-users --no-verify-jwt=false
//
// Environment (provided automatically by Supabase for functions):
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
//
// Actions:
//   list     → every profile (caller must hold users:manage server-side)
//   create   → create an auth user (email + password) and assign its role
//   set_role → change a profile's role
//   delete   → remove an auth user (cascades to their profile)
//
// Escalation rules (also enforced in Postgres by
// prevent_profile_role_escalation(), see
// supabase/migrations/20261110_admin_user_management.sql):
//   - the caller must be `admin` or `super_admin`;
//   - nobody may grant a role above their own unless they are super_admin;
//   - nobody may modify a super_admin's role unless they are super_admin;
//   - nobody may change their own role through this function;
//   - admin (not super_admin) may never create/promote a super_admin.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const ROLE_ORDER = ['user', 'contributor', 'editor', 'admin', 'super_admin'] as const;
type Role = (typeof ROLE_ORDER)[number];

function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLE_ORDER as readonly string[]).includes(value);
}

function normalizeRole(value: unknown): Role {
  return isRole(value) ? value : 'user';
}

function isHigherRole(role: Role, other: Role): boolean {
  return ROLE_ORDER.indexOf(role) > ROLE_ORDER.indexOf(other);
}

interface Env {
  url: string;
  anonKey: string;
  serviceKey: string;
}

function readEnv(): Env | null {
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) return null;
  return { url, anonKey, serviceKey };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ ok: false, message: 'Use POST with a JSON body.' }, 405);
  }

  const env = readEnv();
  if (!env) {
    return json(
      { ok: false, message: 'Function is missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY secrets.' },
      500
    );
  }

  const authorization = req.headers.get('Authorization');
  if (!authorization) {
    return json({ ok: false, message: 'Missing authorization header.' }, 401);
  }

  // 1. Verify the caller's JWT with the anon-key client (no service powers).
  const callerClient = createClient(env.url, env.anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const {
    data: { user: caller },
    error: callerError,
  } = await callerClient.auth.getUser();
  if (callerError || !caller) {
    return json({ ok: false, message: 'Invalid or expired session.' }, 401);
  }

  // 2. Resolve the caller's profile role (RLS allows admins to read profiles).
  const { data: callerProfile, error: profileError } = await callerClient
    .from('profiles')
    .select('id, role')
    .eq('id', caller.id)
    .maybeSingle();
  const callerRole = normalizeRole(profileError ? undefined : callerProfile?.role);
  if (callerRole !== 'admin' && callerRole !== 'super_admin') {
    return json(
      { ok: false, message: 'Your account is not allowed to manage users (admin or super_admin required).' },
      403
    );
  }

  // 3. Service-role client for the actual mutation.
  const service = createClient(env.url, env.serviceKey, {
    auth: { persistSession: false },
  });

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, message: 'Body must be valid JSON.' }, 400);
  }

  const action = String(body.action ?? '');
  const self = { id: caller.id, role: callerRole };

  try {
    switch (action) {
      case 'list': {
        const { data, error } = await service
          .from('profiles')
          .select('id, name, email, role, created_at')
          .order('created_at', { ascending: true })
          .limit(500);
        if (error) return json({ ok: false, message: error.message }, 500);
        return json({ ok: true, users: data ?? [] });
      }

      case 'create': {
        const email = String(body.email ?? '').trim().toLowerCase();
        const password = String(body.password ?? '');
        const name = String(body.name ?? '').trim();
        const role = normalizeRole(body.role);

        if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
          return json({ ok: false, message: 'A valid email address is required.' }, 400);
        }
        if (password.length < 8) {
          return json({ ok: false, message: 'Password must be at least 8 characters.' }, 400);
        }
        if (isHigherRole(role, callerRole)) {
          return json(
            { ok: false, message: `You cannot grant the ${role} role (above your own).` },
            403
          );
        }

        const { data: created, error: createError } = await service.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { name: name || email.split('@')[0] },
        });
        if (createError || !created?.user) {
          return json({ ok: false, message: createError?.message ?? 'Could not create the user.' }, 400);
        }

        // handle_new_user() already inserted a 'user' profile; apply the role
        // with the service role (allowed through the escalation trigger after
        // supabase/migrations/20261110_admin_user_management.sql).
        const { error: roleError } = await service
          .from('profiles')
          .update({ role, name: name || created.user.user_metadata?.name || null })
          .eq('id', created.user.id);
        const user = {
          id: created.user.id,
          email,
          name: name || email.split('@')[0],
          role,
          created_at: new Date().toISOString(),
        };
        if (roleError) {
          return json({
            ok: true,
            user,
            message: `User created, but the role could not be set (${roleError.message}). It defaults to 'user'.`,
          });
        }
        return json({ ok: true, user, message: `Account created for ${email}.` });
      }

      case 'set_role': {
        const userId = String(body.user_id ?? '');
        const role = normalizeRole(body.role);
        if (!userId) return json({ ok: false, message: 'user_id is required.' }, 400);
        if (userId === self.id) {
          return json({ ok: false, message: 'You cannot change your own role here.' }, 400);
        }
        if (isHigherRole(role, callerRole)) {
          return json({ ok: false, message: `You cannot grant the ${role} role (above your own).` }, 403);
        }

        const { data: target, error: targetError } = await service
          .from('profiles')
          .select('id, role, name, email')
          .eq('id', userId)
          .maybeSingle();
        if (targetError || !target) {
          return json({ ok: false, message: 'That user was not found.' }, 404);
        }
        const targetRole = normalizeRole(target.role);
        if (isHigherRole(targetRole, callerRole)) {
          return json(
            { ok: false, message: `Only a super_admin can manage a ${targetRole} account.` },
            403
          );
        }

        const { data: updated, error: updateError } = await service
          .from('profiles')
          .update({ role })
          .eq('id', userId)
          .select('id, name, email, role, created_at')
          .maybeSingle();
        if (updateError) return json({ ok: false, message: updateError.message }, 400);
        return json({ ok: true, user: updated, message: `Role updated to ${role}.` });
      }

      case 'delete': {
        const userId = String(body.user_id ?? '');
        if (!userId) return json({ ok: false, message: 'user_id is required.' }, 400);
        if (userId === self.id) {
          return json({ ok: false, message: 'You cannot delete your own account here.' }, 400);
        }

        const { data: target, error: targetError } = await service
          .from('profiles')
          .select('id, role')
          .eq('id', userId)
          .maybeSingle();
        if (targetError || !target) {
          return json({ ok: false, message: 'That user was not found.' }, 404);
        }
        const targetRole = normalizeRole(target.role);
        if (isHigherRole(targetRole, callerRole) || targetRole === 'super_admin') {
          return json({ ok: false, message: 'Only a super_admin can delete that account.' }, 403);
        }

        const { error: deleteError } = await service.auth.admin.deleteUser(userId);
        if (deleteError) return json({ ok: false, message: deleteError.message }, 400);
        return json({ ok: true, message: 'User deleted.' });
      }

      default:
        return json({ ok: false, message: `Unknown action: ${action || '(none)'}` }, 400);
    }
  } catch (err) {
    return json(
      { ok: false, message: err instanceof Error ? err.message : 'Unexpected server error.' },
      500
    );
  }
});
