-- Believers e-Library — Admin user management & content fixes
-- Filename: 20261110_admin_user_management.sql
--
-- Apply AFTER (in order):
--   1. supabase/schema.sql
--   2. supabase/migrations/20261019_phase4_security_hardening.sql
--   3. supabase/migrations/20261020_cms_content_and_roles.sql
--
-- This migration:
--   A. Lets the `admin-users` Edge Function (service role) set the role of a
--      newly created auth user. `prevent_profile_role_escalation()` previously
--      blocked EVERY role change unless the caller passed `is_admin()`, and the
--      service role has no auth.uid() — so server-side user creation could
--      never assign anything but the default 'user'.
--   B. Hardens the trigger with super_admin protections:
--        - only a super_admin (or the service role) may touch a super_admin row;
--        - only a super_admin (or the service role) may grant super_admin.
--   C. Widens `faith_resources.resource_type` so the CMS editor's values
--      (study_guide / commentary / dictionary / article / podcast / other)
--      stop being rejected by Postgres while the UI showed success.
--
-- Everything stays idempotent (drop-if-exists / create-or-replace).

-- =========================================================================
-- A + B. Role escalation guard: service-role bypass + super_admin rules
-- =========================================================================

create or replace function public.prevent_profile_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- The service role (Edge Function with SUPABASE_SERVICE_ROLE_KEY) applies
  -- roles for newly created users. Privileged SQL editor/DBA sessions
  -- (postgres/supabase_admin) must also be able to bootstrap and repair roles.
  -- Endpoint/DBA controls remain the gate.
  if auth.role() = 'service_role' or current_user in ('postgres', 'supabase_admin') then
    new.updated_at := now();
    return new;
  end if;

  -- Ordinary sessions may only change roles at all when they are an admin.
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Unauthorized: Users cannot modify their own authorization role.';
  end if;

  if new.role is distinct from old.role then
    -- super_admin accounts can only be managed by another super_admin.
    if old.role = 'super_admin' and not public.has_role(array['super_admin']) then
      raise exception 'Unauthorized: Only a super_admin can manage a super_admin account.';
    end if;
    -- super_admin can only be granted by another super_admin.
    if new.role = 'super_admin' and not public.has_role(array['super_admin']) then
      raise exception 'Unauthorized: Only a super_admin can grant the super_admin role.';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.prevent_profile_role_escalation() from public;

-- =========================================================================
-- C. faith_resources.resource_type — accept the CMS editor's values
-- =========================================================================

alter table public.faith_resources
  drop constraint if exists faith_resources_resource_type_check;

alter table public.faith_resources
  add constraint faith_resources_resource_type_check
  check (
    resource_type is null
    or resource_type in (
      'study_guide', 'study', 'commentary', 'dictionary',
      'article', 'podcast', 'video', 'audio', 'other'
    )
  );
