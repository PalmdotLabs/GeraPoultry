drop trigger profiles_protect_final_active_admin on public.profiles;
drop trigger user_roles_protect_final_active_admin on public.user_roles;

create or replace function public.is_active_authoritative_admin(
  candidate_user_id uuid,
  candidate_is_active boolean
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select candidate_is_active and exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = candidate_user_id
      and r.code = 'admin'
      and r.is_system
  );
$$;

create or replace function public.is_authoritative_admin_role(candidate_role_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.roles r
    where r.id = candidate_role_id
      and r.code = 'admin'
      and r.is_system
  );
$$;

create or replace function public.assert_active_admin_remains(error_message text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- This common xact-scoped lock serializes validation across different admins.
  perform pg_advisory_xact_lock(7311372809917736553);

  if not exists (
    select 1
    from public.profiles p
    join public.user_roles ur on ur.user_id = p.id
    join public.roles r on r.id = ur.role_id
    where p.is_active
      and r.code = 'admin'
      and r.is_system
  ) then
    raise exception using errcode = 'P0001', message = error_message;
  end if;
end;
$$;

create or replace function public.protect_final_active_admin_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_active_admin_remains(
    'Cannot deactivate or delete the final active administrator.'
  );
  return null;
end;
$$;

create or replace function public.protect_final_active_admin_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_active_admin_remains(
    'Cannot remove the final active administrator''s admin role.'
  );
  return null;
end;
$$;

-- WHEN clauses identify reductions against each row's pre-change relationships.
-- Initially-immediate checks see the complete statement; callers may explicitly
-- defer them to commit to validate a multi-statement transaction's final state.
create constraint trigger profiles_require_remaining_active_admin
after update on public.profiles
deferrable initially immediate
for each row
when (
  public.is_active_authoritative_admin(old.id, old.is_active)
  and new.is_active is distinct from true
)
execute function public.protect_final_active_admin_profile();

create constraint trigger profiles_require_remaining_active_admin_on_delete
after delete on public.profiles
deferrable initially immediate
for each row
when (public.is_active_authoritative_admin(old.id, old.is_active))
execute function public.protect_final_active_admin_profile();

create constraint trigger user_roles_require_remaining_active_admin
after update on public.user_roles
deferrable initially immediate
for each row
when (
  public.is_authoritative_admin_role(old.role_id)
  and (
    new.user_id is distinct from old.user_id
    or new.role_id is distinct from old.role_id
  )
)
execute function public.protect_final_active_admin_assignment();

create constraint trigger user_roles_require_remaining_active_admin_on_delete
after delete on public.user_roles
deferrable initially immediate
for each row
when (public.is_authoritative_admin_role(old.role_id))
execute function public.protect_final_active_admin_assignment();

revoke all on function public.assert_active_admin_remains(text)
  from public, anon, authenticated, service_role, supabase_auth_admin;
revoke all on function public.protect_final_active_admin_profile()
  from public, anon, authenticated, service_role, supabase_auth_admin;
revoke all on function public.protect_final_active_admin_assignment()
  from public, anon, authenticated, service_role, supabase_auth_admin;

-- Constraint WHEN functions execute as the mutating role and therefore require
-- execution grants. They only expose authoritative-role membership predicates.
revoke all on function public.is_active_authoritative_admin(uuid, boolean)
  from public, anon, authenticated, service_role, supabase_auth_admin;
revoke all on function public.is_authoritative_admin_role(uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.is_active_authoritative_admin(uuid, boolean),
  public.is_authoritative_admin_role(uuid)
  to authenticated, service_role, supabase_auth_admin;

create or replace function public.stamp_user_role_provenance()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    new.assigned_by = auth.uid();
    new.assigned_at = now();
  end if;
  return new;
end;
$$;

create trigger user_roles_stamp_provenance
before insert or update on public.user_roles
for each row execute function public.stamp_user_role_provenance();

alter table public.user_roles
  drop constraint user_roles_assigned_by_fkey,
  add constraint user_roles_assigned_by_fkey
    foreign key (assigned_by) references auth.users(id) on delete restrict;

alter table public.audit_events
  drop constraint audit_events_actor_id_fkey,
  add constraint audit_events_actor_id_fkey
    foreign key (actor_id) references auth.users(id) on delete restrict;

revoke all on function public.stamp_user_role_provenance()
  from public, anon, authenticated, service_role, supabase_auth_admin;
