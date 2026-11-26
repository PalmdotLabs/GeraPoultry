create or replace function public.protect_final_active_admin_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.is_active
    and (tg_op = 'DELETE' or new.is_active is distinct from true)
    and not exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      join public.profiles p on p.id = ur.user_id
      where r.code = 'admin'
        and r.is_system
        and p.is_active
        and p.id <> old.id
    )
    and exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = old.id
        and r.code = 'admin'
        and r.is_system
    )
  then
    raise exception using
      errcode = 'P0001',
      message = 'Cannot deactivate or delete the final active administrator.';
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function public.protect_final_active_admin_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.roles r
    join public.profiles p on p.id = old.user_id
    where r.id = old.role_id
      and r.code = 'admin'
      and r.is_system
      and p.is_active
  ) and (tg_op = 'DELETE'
    or new.user_id is distinct from old.user_id
    or new.role_id is distinct from old.role_id)
    and not exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      join public.profiles p on p.id = ur.user_id
      where r.code = 'admin'
        and r.is_system
        and p.is_active
        and p.id <> old.user_id
    )
  then
    raise exception using
      errcode = 'P0001',
      message = 'Cannot remove the final active administrator''s admin role.';
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function public.protect_authoritative_admin_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.code = 'admin' and old.is_system
    and (tg_op = 'DELETE'
      or new.id is distinct from old.id
      or new.code is distinct from old.code
      or new.is_system is distinct from true)
  then
    raise exception using
      errcode = 'P0001',
      message = 'The system admin role cannot be deleted or narrowed.';
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function public.protect_admin_access_permission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.code = 'admin.access'
    and (tg_op = 'DELETE'
      or new.id is distinct from old.id
      or new.code is distinct from old.code)
  then
    raise exception using
      errcode = 'P0001',
      message = 'The admin.access permission cannot be deleted or renamed.';
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function public.protect_admin_access_grant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.roles r
    join public.permissions p on p.id = old.permission_id
    where r.id = old.role_id
      and r.code = 'admin'
      and r.is_system
      and p.code = 'admin.access'
  ) and (tg_op = 'DELETE'
    or new.role_id is distinct from old.role_id
    or new.permission_id is distinct from old.permission_id)
  then
    raise exception using
      errcode = 'P0001',
      message = 'The admin role''s admin.access grant cannot be removed or changed.';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger profiles_protect_final_active_admin
before update or delete on public.profiles
for each row execute function public.protect_final_active_admin_profile();

create trigger user_roles_protect_final_active_admin
before update or delete on public.user_roles
for each row execute function public.protect_final_active_admin_assignment();

create trigger roles_protect_authoritative_admin
before update or delete on public.roles
for each row execute function public.protect_authoritative_admin_role();

create trigger permissions_protect_admin_access
before update or delete on public.permissions
for each row execute function public.protect_admin_access_permission();

create trigger role_permissions_protect_admin_access
before update or delete on public.role_permissions
for each row execute function public.protect_admin_access_grant();

revoke all on function public.protect_final_active_admin_profile()
  from public, anon, authenticated;
revoke all on function public.protect_final_active_admin_assignment()
  from public, anon, authenticated;
revoke all on function public.protect_authoritative_admin_role()
  from public, anon, authenticated;
revoke all on function public.protect_admin_access_permission()
  from public, anon, authenticated;
revoke all on function public.protect_admin_access_grant()
  from public, anon, authenticated;
