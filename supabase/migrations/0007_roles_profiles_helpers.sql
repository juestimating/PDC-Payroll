-- =============================================================================
-- PDC Payroll — 0007: the 5-role model, profiles extension, and RLS helpers.
--
-- Split from the RLS policies (0008) on purpose: `alter type ... add value`
-- cannot be USED in the same transaction it runs in, so the new enum values are
-- added + committed here, then referenced by policies in 0008.
--
-- Helper functions live in `public` (not `auth`, which Supabase locks down) and
-- are SECURITY DEFINER so they read `profiles` bypassing RLS — this is what
-- prevents the classic "infinite recursion in policy" when a table's policy needs
-- the caller's role. profiles' own policy is a plain self-read, never recursive.
-- =============================================================================

-- ---- 5-role enum: add the three new values (idempotent) ----------------------
-- Legacy 'dept_head' / 'employee' remain in the type but are unused (Postgres
-- can't drop enum values without recreating the type; harmless to leave).
alter type app_role add value if not exists 'super_admin';
alter type app_role add value if not exists 'sales_lead';
alter type app_role add value if not exists 'estimation_lead';

-- ---- profiles: 5-role model fields -------------------------------------------
alter table profiles add column if not exists full_name    text;
alter table profiles add column if not exists entity_scope text references entities(id);
alter table profiles add column if not exists active       boolean not null default true;

-- ---- RLS role helpers (SECURITY DEFINER; read profiles outside RLS) ----------
create or replace function public.current_app_role() returns app_role
  language sql stable security definer set search_path = public, pg_temp
  as $$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.has_app_role(variadic roles app_role[]) returns boolean
  language sql stable security definer set search_path = public, pg_temp
  as $$ select coalesce((select role from public.profiles where id = auth.uid()) = any(roles), false) $$;

create or replace function public.current_entity_scope() returns text
  language sql stable security definer set search_path = public, pg_temp
  as $$ select entity_scope from public.profiles where id = auth.uid() $$;

-- Least privilege: only authenticated sessions may call the helpers.
revoke execute on function public.current_app_role()                from public;
revoke execute on function public.has_app_role(app_role[])          from public;
revoke execute on function public.current_entity_scope()            from public;
grant  execute on function public.current_app_role()                to authenticated;
grant  execute on function public.has_app_role(app_role[])          to authenticated;
grant  execute on function public.current_entity_scope()            to authenticated;
