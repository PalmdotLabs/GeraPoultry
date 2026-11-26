insert into public.permissions (code, name, description)
values ('farm.setup.read', 'Read farm setup', 'View configured sheds and breeds.');

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code = 'admin' and r.is_system and p.code = 'farm.setup.read';

create table public.sheds (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120 and name !~ '^[[:space:]]|[[:space:]]$')
);

create table public.breeds (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120 and name !~ '^[[:space:]]|[[:space:]]$')
);

create unique index sheds_name_unique on public.sheds (lower(name));
create unique index breeds_name_unique on public.breeds (lower(name));

alter table public.sheds enable row level security;
alter table public.breeds enable row level security;

revoke all on public.sheds, public.breeds from public, anon, authenticated;
grant select, insert (name) on public.sheds, public.breeds to authenticated;

create policy sheds_read on public.sheds for select to authenticated
using ((select public.has_permission('farm.setup.read')));

create policy breeds_read on public.breeds for select to authenticated
using ((select public.has_permission('farm.setup.read')));

create policy sheds_create on public.sheds for insert to authenticated
with check ((select exists (
  select 1 from public.profiles p
  where p.id = (select auth.uid())
    and public.is_active_authoritative_admin(p.id, p.is_active)
)));

create policy breeds_create on public.breeds for insert to authenticated
with check ((select exists (
  select 1 from public.profiles p
  where p.id = (select auth.uid())
    and public.is_active_authoritative_admin(p.id, p.is_active)
)));

create schema farm_private;

create function farm_private.audit_lookup_creation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_events (actor_id, action, target_type, target_id, metadata)
  values (
    auth.uid(), tg_table_name || '.insert', tg_table_name, new.id::text,
    jsonb_build_object('name', new.name)
  );
  return new;
end;
$$;

revoke all on function farm_private.audit_lookup_creation()
  from public, anon, authenticated, service_role, supabase_auth_admin;

create trigger sheds_audit after insert on public.sheds
for each row execute function farm_private.audit_lookup_creation();

create trigger breeds_audit after insert on public.breeds
for each row execute function farm_private.audit_lookup_creation();
