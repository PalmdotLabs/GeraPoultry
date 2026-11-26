-- Role catalogs and permission grants are mutable only through guarded RPCs.
revoke insert, update, delete on public.roles from authenticated;
revoke insert, update, delete on public.role_permissions from authenticated;
drop policy roles_insert on public.roles;
drop policy roles_update on public.roles;
drop policy roles_delete on public.roles;
drop policy role_permissions_insert on public.role_permissions;
drop policy role_permissions_update on public.role_permissions;
drop policy role_permissions_delete on public.role_permissions;

create unique index audit_events_one_invitation_per_request
  on public.audit_events (request_id)
  where action = 'user.invited' and request_id is not null;
create unique index audit_events_one_invitation_per_target
  on public.audit_events (target_id)
  where action = 'user.invited' and target_type = 'user';

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
    and lower(u.email) = lower(btrim(p_target_email))
    and u.invited_at is not null;

  if not found then
    raise exception using
      errcode = 'P0404',
      message = 'The invited user profile, email, and invitation state could not be verified.';
  end if;

  begin
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
  exception
    when unique_violation then
      raise exception using
        errcode = 'P0409',
        message = 'An invitation event already exists for this request or user.';
  end;
end;
$$;

revoke all on function public.admin_record_user_invite(uuid, text, uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.admin_record_user_invite(uuid, text, uuid)
  to authenticated;

create or replace function public.get_assigned_role_summaries(p_user_ids uuid[])
returns table (
  user_id uuid,
  role_id uuid,
  role_code text,
  role_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
    or not exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_active
    )
    or not (
      public.has_permission('users.read')
      or public.has_permission('users.manage')
    )
  then
    raise exception using
      errcode = '42501',
      message = 'Active profile with users.read or users.manage permission is required.';
  end if;

  if p_user_ids is null
    or exists (select 1 from unnest(p_user_ids) requested_id where requested_id is null)
    or (select count(distinct requested_id) from unnest(p_user_ids) requested_id) > 100
  then
    raise exception using
      errcode = '22023',
      message = 'User IDs must be a non-null array of at most 100 distinct IDs without nulls.';
  end if;

  return query
  select ur.user_id, ur.role_id, r.code, r.name
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where ur.user_id in (select unnest(p_user_ids))
  order by ur.user_id, r.code, r.id;
end;
$$;

revoke all on function public.get_assigned_role_summaries(uuid[])
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.get_assigned_role_summaries(uuid[])
  to authenticated;

create or replace function public.admin_set_user_roles(
  p_target_user_id uuid,
  p_role_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_role_count bigint;
  resolved_role_count bigint;
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

  select count(*) into requested_role_count
  from (select distinct unnest(p_role_ids) as role_id) requested;

  select count(*) into resolved_role_count
  from (
    select r.id
    from (select distinct unnest(p_role_ids) as role_id) requested
    join public.roles r on r.id = requested.role_id
    for key share of r
  ) resolved;

  if resolved_role_count <> requested_role_count then
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

revoke all on function public.admin_set_user_roles(uuid, uuid[])
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.admin_set_user_roles(uuid, uuid[])
  to authenticated;

create or replace function public.administrative_auth_users_page(
  p_offset bigint,
  p_limit integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
    or not exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_active
    )
    or not public.has_permission('users.read')
  then
    raise exception using
      errcode = '42501',
      message = 'Active profile with users.read permission is required.';
  end if;

  if p_offset is null or p_offset < 0
    or p_limit is null or p_limit < 1 or p_limit > 100
  then
    raise exception using
      errcode = '22023',
      message = 'Offset must be nonnegative and limit must be between 1 and 100.';
  end if;

  return (
    with paged_users as (
      select u.id, u.email, u.invited_at, u.email_confirmed_at,
        u.last_sign_in_at, u.created_at
      from auth.users u
      order by lower(u.email) nulls last, u.id
      offset p_offset limit p_limit
    ), serialized_users as (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', id,
            'email', email,
            'invited_at', invited_at,
            'email_confirmed_at', email_confirmed_at,
            'last_sign_in_at', last_sign_in_at,
            'created_at', created_at
          ) order by lower(email) nulls last, id
        ),
        '[]'::jsonb
      ) as users
      from paged_users
    )
    select jsonb_build_object(
      'users', serialized_users.users,
      'total', (select count(*) from auth.users)
    )
    from serialized_users
  );
end;
$$;

revoke all on function public.administrative_auth_users_page(bigint, integer)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.administrative_auth_users_page(bigint, integer)
  to authenticated;
