create or replace function public.assert_active_admin_permission(p_permission_code text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
    or not exists (
      select 1
      from public.profiles p
      where p.id = auth.uid() and p.is_active
    )
    or not public.has_permission(p_permission_code)
  then
    raise exception using
      errcode = '42501',
      message = format('Active profile with %s permission is required.', p_permission_code);
  end if;
end;
$$;

create or replace function public.audit_profile_activation_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_events (
    actor_id, action, target_type, target_id, request_id, metadata
  ) values (
    auth.uid(),
    'profiles.update',
    'profiles',
    new.id::text,
    null,
    jsonb_build_object(
      'before', jsonb_build_object('is_active', old.is_active),
      'after', jsonb_build_object('is_active', new.is_active)
    )
  );
  return new;
end;
$$;

create trigger profiles_audit_activation
  after update on public.profiles
  for each row
  when (old.is_active is distinct from new.is_active)
  execute function public.audit_profile_activation_change();

create or replace function public.audit_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_events (
    actor_id, action, target_type, target_id, request_id, metadata
  ) values (
    auth.uid(),
    'roles.' || lower(tg_op),
    'roles',
    coalesce(new.id, old.id)::text,
    null,
    jsonb_build_object(
      'old', case when tg_op = 'DELETE' then to_jsonb(old) else null end,
      'new', case when tg_op = 'INSERT' then to_jsonb(new) else null end,
      'before', case when tg_op = 'UPDATE' then to_jsonb(old) else null end,
      'after', case when tg_op = 'UPDATE' then to_jsonb(new) else null end
    )
  );
  return coalesce(new, old);
end;
$$;

create trigger roles_audit
  after insert or update or delete on public.roles
  for each row execute function public.audit_role_change();

create or replace function public.admin_record_user_invite(
  p_target_user_id uuid,
  p_target_email text,
  p_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  verified_email text;
begin
  perform public.assert_active_admin_permission('users.manage');

  if p_target_user_id is null or p_request_id is null
    or p_target_email is null or btrim(p_target_email) = ''
  then
    raise exception using
      errcode = '22023',
      message = 'Target user, target email, and request ID are required.';
  end if;

  select u.email into verified_email
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.id = p_target_user_id
    and lower(u.email) = lower(btrim(p_target_email));

  if not found then
    raise exception using
      errcode = 'P0404',
      message = 'The invited user profile and email could not be verified.';
  end if;

  insert into public.audit_events (
    actor_id, action, target_type, target_id, request_id, metadata
  ) values (
    auth.uid(),
    'user.invited',
    'user',
    p_target_user_id::text,
    p_request_id,
    jsonb_build_object('email', verified_email)
  );
end;
$$;

create or replace function public.admin_set_user_active(
  p_target_user_id uuid,
  p_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_is_active boolean;
begin
  perform public.assert_active_admin_permission('users.manage');

  if p_target_user_id is null or p_is_active is null then
    raise exception using
      errcode = '22023',
      message = 'Target user and active state are required.';
  end if;

  select p.is_active into current_is_active
  from public.profiles p
  where p.id = p_target_user_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0404',
      message = 'Target user profile not found.';
  end if;

  if current_is_active is distinct from p_is_active then
    update public.profiles
    set is_active = p_is_active
    where id = p_target_user_id;
  end if;
end;
$$;

create or replace function public.admin_set_user_roles(
  p_target_user_id uuid,
  p_role_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_active_admin_permission('users.manage');

  if p_target_user_id is null or p_role_ids is null
    or exists (select 1 from unnest(p_role_ids) role_id where role_id is null)
  then
    raise exception using
      errcode = '22023',
      message = 'Target user and a role ID array without nulls are required.';
  end if;

  perform 1
  from public.profiles p
  where p.id = p_target_user_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0404',
      message = 'Target user profile not found.';
  end if;

  if exists (
    select 1
    from (select distinct unnest(p_role_ids) as role_id) requested
    left join public.roles r on r.id = requested.role_id
    where r.id is null
  ) then
    raise exception using
      errcode = 'P0404',
      message = 'One or more target roles were not found.';
  end if;

  delete from public.user_roles ur
  where ur.user_id = p_target_user_id
    and not exists (
      select 1 from unnest(p_role_ids) role_id
      where role_id = ur.role_id
    );

  insert into public.user_roles (user_id, role_id)
  select p_target_user_id, requested.role_id
  from (select distinct unnest(p_role_ids) as role_id) requested
  on conflict (user_id, role_id) do nothing;
end;
$$;

create or replace function public.admin_upsert_role(
  p_role_id uuid,
  p_code text,
  p_name text,
  p_description text,
  p_permission_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  stored_id uuid;
  stored_code text;
  stored_is_system boolean;
begin
  perform public.assert_active_admin_permission('roles.manage');

  if p_code is null or btrim(p_code) = ''
    or p_name is null or btrim(p_name) = ''
    or p_description is null or p_permission_ids is null
    or exists (
      select 1 from unnest(p_permission_ids) permission_id
      where permission_id is null
    )
  then
    raise exception using
      errcode = '22023',
      message = 'Role code, name, description, and permission IDs without nulls are required.';
  end if;

  if exists (
    select 1
    from (select distinct unnest(p_permission_ids) as permission_id) requested
    left join public.permissions p on p.id = requested.permission_id
    where p.id is null
  ) then
    raise exception using
      errcode = 'P0404',
      message = 'One or more permissions were not found.';
  end if;

  if p_role_id is null then
    insert into public.roles (code, name, description)
    values (btrim(p_code), btrim(p_name), btrim(p_description))
    returning id into stored_id;
  else
    select r.id, r.code, r.is_system
    into stored_id, stored_code, stored_is_system
    from public.roles r
    where r.id = p_role_id
    for update;

    if not found then
      raise exception using
        errcode = 'P0404',
        message = 'Target role not found.';
    end if;

    if stored_is_system then
      raise exception using
        errcode = 'P0409',
        message = 'System roles cannot be edited.';
    end if;

    if stored_code is distinct from btrim(p_code) then
      raise exception using
        errcode = 'P0409',
        message = 'Role code is immutable.';
    end if;

    update public.roles
    set name = btrim(p_name), description = btrim(p_description)
    where id = stored_id;
  end if;

  delete from public.role_permissions rp
  where rp.role_id = stored_id
    and not exists (
      select 1 from unnest(p_permission_ids) permission_id
      where permission_id = rp.permission_id
    );

  insert into public.role_permissions (role_id, permission_id)
  select stored_id, requested.permission_id
  from (select distinct unnest(p_permission_ids) as permission_id) requested
  on conflict (role_id, permission_id) do nothing;

  return stored_id;
end;
$$;

create or replace function public.admin_delete_role(p_role_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  stored_is_system boolean;
begin
  perform public.assert_active_admin_permission('roles.manage');

  if p_role_id is null then
    raise exception using errcode = '22023', message = 'Role ID is required.';
  end if;

  select r.is_system into stored_is_system
  from public.roles r
  where r.id = p_role_id
  for update;

  if not found then
    raise exception using errcode = 'P0404', message = 'Target role not found.';
  end if;

  if stored_is_system then
    raise exception using
      errcode = 'P0409',
      message = 'System roles cannot be deleted.';
  end if;

  if exists (select 1 from public.user_roles ur where ur.role_id = p_role_id) then
    raise exception using
      errcode = 'P0409',
      message = 'A role assigned to a user cannot be deleted.';
  end if;

  delete from public.roles where id = p_role_id;
end;
$$;

revoke all on function public.assert_active_admin_permission(text)
  from public, anon, authenticated, service_role, supabase_auth_admin;
revoke all on function public.audit_profile_activation_change()
  from public, anon, authenticated, service_role, supabase_auth_admin;
revoke all on function public.audit_role_change()
  from public, anon, authenticated, service_role, supabase_auth_admin;

revoke all on function public.admin_record_user_invite(uuid, text, uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;
revoke all on function public.admin_set_user_active(uuid, boolean)
  from public, anon, authenticated, service_role, supabase_auth_admin;
revoke all on function public.admin_set_user_roles(uuid, uuid[])
  from public, anon, authenticated, service_role, supabase_auth_admin;
revoke all on function public.admin_upsert_role(uuid, text, text, text, uuid[])
  from public, anon, authenticated, service_role, supabase_auth_admin;
revoke all on function public.admin_delete_role(uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;

grant execute on function public.admin_record_user_invite(uuid, text, uuid),
  public.admin_set_user_active(uuid, boolean),
  public.admin_set_user_roles(uuid, uuid[]),
  public.admin_upsert_role(uuid, text, text, text, uuid[]),
  public.admin_delete_role(uuid)
  to authenticated;
