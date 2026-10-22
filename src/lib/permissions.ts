/**
 * Explicit permission model for the CMS admin shell.
 *
 * Dependency-free on purpose: `node --test` (tests/admincms.test.mjs) imports
 * the transpiled module directly, with no DOM, localStorage or bundler.
 *
 * Roles (least → most privileged):
 *   user → contributor → editor → admin → super_admin
 *
 * Capability summary (see ROLE_PERMISSIONS for the authoritative matrix):
 * - user        : no CMS permissions.
 * - contributor : may create and edit drafts only — never publish/schedule/
 *                 archive/delete (server RLS enforces the same boundary).
 * - editor      : + publish, schedule, archive and view analytics.
 * - admin       : + delete (drafts/archived), manage users, manage moderation,
 *                 view analytics and the audit trail.
 * - super_admin : every action (also roles:manage and settings:manage).
 *
 * This matrix is a FRONTEND convenience for hiding/disabling controls.
 * PostgreSQL Row Level Security (supabase/migrations/
 * 20261020_cms_content_and_roles.sql) remains the authoritative enforcement —
 * a client can never escalate its own role.
 */

/** The five-role model shared by the app and the `profiles.role` column. */
export type UserRole = 'user' | 'contributor' | 'editor' | 'admin' | 'super_admin';

/** Every guarded action in the app. */
export type PermissionAction =
  | 'content:create'
  | 'content:edit'
  | 'content:publish'
  | 'content:schedule'
  | 'content:archive'
  | 'content:delete'
  | 'users:manage'
  | 'roles:manage'
  | 'moderation:manage'
  | 'settings:manage'
  | 'analytics:view'
  | 'audit:view';

/** Stable list of every action (useful for matrix tables and tests). */
export const PERMISSION_ACTIONS: PermissionAction[] = [
  'content:create',
  'content:edit',
  'content:publish',
  'content:schedule',
  'content:archive',
  'content:delete',
  'users:manage',
  'roles:manage',
  'moderation:manage',
  'settings:manage',
  'analytics:view',
  'audit:view',
];

/** Authoritative role → allowed actions matrix. */
const ROLE_PERMISSIONS: Record<UserRole, readonly PermissionAction[]> = {
  user: [],
  contributor: ['content:create', 'content:edit'],
  editor: [
    'content:create',
    'content:edit',
    'content:publish',
    'content:schedule',
    'content:archive',
    'analytics:view',
  ],
  admin: [
    'content:create',
    'content:edit',
    'content:publish',
    'content:schedule',
    'content:archive',
    'content:delete',
    'users:manage',
    'moderation:manage',
    'analytics:view',
    'audit:view',
  ],
  super_admin: [
    'content:create',
    'content:edit',
    'content:publish',
    'content:schedule',
    'content:archive',
    'content:delete',
    'users:manage',
    'roles:manage',
    'moderation:manage',
    'settings:manage',
    'analytics:view',
    'audit:view',
  ],
};

/**
 * Returns whether `role` may perform `action`.
 * Unknown/missing roles (null, undefined, a legacy string read from storage)
 * are denied everything — the safest possible default.
 */
export function can(role: UserRole | undefined | null, action: PermissionAction): boolean {
  if (!role) return false;
  const allowed = ROLE_PERMISSIONS[role];
  return Array.isArray(allowed) ? allowed.includes(action) : false;
}

/** Human-readable role names (single source of truth for the whole UI). */
export const ROLE_LABELS: Record<UserRole, string> = {
  user: 'Ordinary User',
  contributor: 'Ministry Contributor',
  editor: 'Editor',
  admin: 'Administrator',
  super_admin: 'Super Administrator',
};

/** Roles ordered least → most privileged (index order = privilege order). */
export const ROLE_ORDER: UserRole[] = ['user', 'contributor', 'editor', 'admin', 'super_admin'];

/** Runtime guard for values read out of localStorage / Postgres. */
export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (ROLE_ORDER as string[]).includes(value);
}

/**
 * Maps any read value (legacy 'admin'-only rows, unknown strings, null) onto
 * the 5-role union. Unknown/legacy values fall back to `fallback` ('user').
 */
export function normalizeRole(value: unknown, fallback: UserRole = 'user'): UserRole {
  return isUserRole(value) ? value : fallback;
}

/** True when `role` ranks strictly above `other` in ROLE_ORDER. */
export function isHigherRole(role: UserRole, other: UserRole): boolean {
  return ROLE_ORDER.indexOf(role) > ROLE_ORDER.indexOf(other);
}
