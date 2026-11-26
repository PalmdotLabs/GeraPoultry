create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(btrim(display_name)) > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (length(btrim(code)) > 0),
  name text not null check (length(btrim(name)) > 0),
  description text not null default '',
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (length(btrim(code)) > 0),
  name text not null check (length(btrim(name)) > 0),
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text not null,
  request_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();
create trigger roles_set_updated_at
before update on public.roles
for each row execute function public.set_updated_at();
create trigger permissions_set_updated_at
before update on public.permissions
for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(split_part(new.email, '@', 1)), ''),
      'User'
    )
  );
  return new;
end;
$$;

create trigger auth_users_create_profile
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.has_permission(permission_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join public.user_roles ur on ur.user_id = p.id
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions permission on permission.id = rp.permission_id
    where p.id = auth.uid()
      and p.is_active
      and permission.code = permission_code
  );
$$;

create or replace function public.active_permissions()
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select distinct permission.code
  from public.profiles p
  join public.user_roles ur on ur.user_id = p.id
  join public.role_permissions rp on rp.role_id = ur.role_id
  join public.permissions permission on permission.id = rp.permission_id
  where p.id = auth.uid() and p.is_active
  order by permission.code;
$$;

create or replace function public.get_session_context()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with active_profile as (
    select p.id, p.display_name
    from public.profiles p
    where p.id = auth.uid() and p.is_active
  ), assigned_roles as (
    select r.code, r.name
    from public.roles r
    join public.user_roles ur on ur.role_id = r.id
    join active_profile p on p.id = ur.user_id
    order by r.code
  ), role_json as (
    select coalesce(
      jsonb_agg(jsonb_build_object('code', code, 'name', name)),
      '[]'::jsonb
    ) as value
    from assigned_roles
  ), granted_permissions as (
    select distinct permission.code
    from public.permissions permission
    join public.role_permissions rp on rp.permission_id = permission.id
    join public.user_roles ur on ur.role_id = rp.role_id
    join active_profile p on p.id = ur.user_id
    order by permission.code
  ), permission_json as (
    select coalesce(jsonb_agg(code), '[]'::jsonb) as value
    from granted_permissions
  )
  select case
    when not exists (select 1 from active_profile) then null
    else jsonb_build_object(
      'displayName', (select display_name from active_profile),
      'roles', (select value from role_json),
      'permissions', (select value from permission_json)
    )
  end;
$$;

create or replace function public.audit_role_assignment_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  audit_target text;
begin
  if tg_table_name = 'user_roles' then
    audit_target = coalesce(new.user_id, old.user_id)::text || ':' ||
      coalesce(new.role_id, old.role_id)::text;
  else
    audit_target = coalesce(new.role_id, old.role_id)::text || ':' ||
      coalesce(new.permission_id, old.permission_id)::text;
  end if;

  insert into public.audit_events (
    actor_id, action, target_type, target_id, request_id, metadata
  ) values (
    auth.uid(),
    tg_table_name || '.' || lower(tg_op),
    tg_table_name,
    audit_target,
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

create trigger user_roles_audit
after insert or update or delete on public.user_roles
for each row execute function public.audit_role_assignment_change();
create trigger role_permissions_audit
after insert or update or delete on public.role_permissions
for each row execute function public.audit_role_assignment_change();

insert into public.permissions (code, name, description) values
  ('admin.access', 'Admin access', 'Access the administrative application.'),
  ('audit.read', 'Read audit events', 'Read authorization audit events.'),
  ('roles.manage', 'Manage roles', 'Manage roles and their permissions.'),
  ('roles.read', 'Read roles', 'Read roles and permission assignments.'),
  ('users.manage', 'Manage users', 'Manage user role assignments.'),
  ('users.read', 'Read users', 'Read user profiles and role assignments.');

with admin_role as (
  insert into public.roles (code, name, description, is_system)
  values ('admin', 'Admin', 'Initial system administrator role.', true)
  returning id
)
insert into public.role_permissions (role_id, permission_id)
select admin_role.id, permissions.id
from admin_role
cross join public.permissions;

alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.audit_events enable row level security;

create policy profiles_select_own_or_user_reader on public.profiles
for select to authenticated
using (
  id = auth.uid()
  or public.has_permission('users.read')
  or public.has_permission('users.manage')
);
create policy profiles_update_own on public.profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy roles_select on public.roles
for select to authenticated
using (public.has_permission('roles.read') or public.has_permission('roles.manage'));
create policy roles_insert on public.roles
for insert to authenticated with check (public.has_permission('roles.manage'));
create policy roles_update on public.roles
for update to authenticated
using (public.has_permission('roles.manage'))
with check (public.has_permission('roles.manage'));
create policy roles_delete on public.roles
for delete to authenticated using (public.has_permission('roles.manage'));

create policy permissions_select on public.permissions
for select to authenticated
using (public.has_permission('roles.read') or public.has_permission('roles.manage'));

create policy role_permissions_select on public.role_permissions
for select to authenticated
using (public.has_permission('roles.read') or public.has_permission('roles.manage'));
create policy role_permissions_insert on public.role_permissions
for insert to authenticated with check (public.has_permission('roles.manage'));
create policy role_permissions_update on public.role_permissions
for update to authenticated
using (public.has_permission('roles.manage'))
with check (public.has_permission('roles.manage'));
create policy role_permissions_delete on public.role_permissions
for delete to authenticated using (public.has_permission('roles.manage'));

create policy user_roles_select on public.user_roles
for select to authenticated
using (
  user_id = auth.uid()
  or public.has_permission('users.read')
  or public.has_permission('users.manage')
);
create policy user_roles_insert on public.user_roles
for insert to authenticated with check (public.has_permission('users.manage'));
create policy user_roles_update on public.user_roles
for update to authenticated
using (public.has_permission('users.manage'))
with check (public.has_permission('users.manage'));
create policy user_roles_delete on public.user_roles
for delete to authenticated using (public.has_permission('users.manage'));

create policy audit_events_select on public.audit_events
for select to authenticated using (public.has_permission('audit.read'));

revoke all on all tables in schema public from anon, authenticated;
grant select on public.profiles, public.roles, public.permissions,
  public.role_permissions, public.user_roles, public.audit_events to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant insert, update, delete on public.roles,
  public.role_permissions, public.user_roles to authenticated;
grant select on public.roles to service_role;
grant insert on public.user_roles to service_role;

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
revoke all on function public.audit_role_assignment_change() from public, anon, authenticated;
revoke all on function public.has_permission(text) from public, anon, authenticated;
revoke all on function public.active_permissions() from public, anon, authenticated;
revoke all on function public.get_session_context() from public, anon, authenticated;
grant execute on function public.has_permission(text),
  public.active_permissions(), public.get_session_context() to authenticated;
