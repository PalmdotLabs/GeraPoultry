insert into public.permissions (code, name, description)
values
  ('eggs.collection.create', 'Record egg collections', 'Record egg production by shed, shift and grade.'),
  ('eggs.collection.read', 'Read egg collections', 'View recorded egg production and its quality breakdown.');

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code = 'admin' and r.is_system
  and p.code in ('eggs.collection.create', 'eggs.collection.read');

create table public.egg_grades (
  id uuid primary key default gen_random_uuid(),
  name text not null check (
    char_length(name) between 1 and 120 and name !~ '^[[:space:]]|[[:space:]]$'
  )
);

create unique index egg_grades_name_unique on public.egg_grades (lower(name));

alter table public.egg_grades enable row level security;
revoke all on public.egg_grades from public, anon, authenticated;
grant select, insert (name) on public.egg_grades to authenticated;

create policy egg_grades_read on public.egg_grades for select to authenticated
using ((select public.has_permission('farm.setup.read')));

create policy egg_grades_create on public.egg_grades for insert to authenticated
with check ((select exists (
  select 1 from public.profiles p
  where p.id = (select auth.uid())
    and public.is_active_authoritative_admin(p.id, p.is_active)
)));

create trigger egg_grades_audit after insert on public.egg_grades
for each row execute function farm_private.audit_lookup_creation();

create table public.egg_collections (
  id uuid primary key default gen_random_uuid(),
  collection_date date not null check (
    collection_date between date '0001-01-01' and date '9999-12-31'
  ),
  shed_id uuid not null references public.sheds (id),
  flock_id uuid,
  shift text not null check (
    char_length(shift) between 1 and 80 and shift !~ '^[[:space:]]|[[:space:]]$'
  ),
  grade_id uuid not null references public.egg_grades (id),
  good_egg_count integer not null check (good_egg_count >= 0),
  cracked_egg_count integer not null check (cracked_egg_count >= 0),
  dirty_egg_count integer not null check (dirty_egg_count >= 0),
  total_egg_count bigint generated always as (good_egg_count::bigint + cracked_egg_count + dirty_egg_count) stored,
  submission_id uuid not null,
  created_by uuid not null references public.profiles (id),
  unique (created_by, submission_id),
  foreign key (flock_id, shed_id) references public.flock_placements (flock_id, shed_id)
);

create index egg_collections_date_id_idx on public.egg_collections (collection_date desc, id);
create index egg_collections_shed_id_idx on public.egg_collections (shed_id);
create index egg_collections_grade_id_idx on public.egg_collections (grade_id);
create index egg_collections_flock_shed_idx on public.egg_collections (flock_id, shed_id);

alter table public.egg_collections enable row level security;
revoke all on public.egg_collections from public, anon, authenticated;
grant select (id, collection_date, shed_id, flock_id, shift, grade_id,
  good_egg_count, cracked_egg_count, dirty_egg_count, total_egg_count)
  on public.egg_collections to authenticated;

create policy egg_collections_read on public.egg_collections for select to authenticated
using ((select public.has_permission('eggs.collection.read')));

create function farm_private.record_egg_collection(
  p_collection_date date,
  p_shed_id uuid,
  p_shift text,
  p_grade_id uuid,
  p_good_egg_count integer,
  p_cracked_egg_count integer,
  p_dirty_egg_count integer,
  p_submission_id uuid,
  p_request_id uuid,
  p_flock_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  shift_label text := btrim(p_shift);
  collection_id uuid;
  total_count bigint;
  previous public.egg_collections%rowtype;
begin
  if actor_id is null or not public.has_permission('eggs.collection.create') then
    raise exception using errcode = '42501', message = 'Egg collection permission is required.';
  end if;

  if p_collection_date is null or p_collection_date not between date '0001-01-01' and date '9999-12-31'
    or p_shed_id is null or p_grade_id is null
    or shift_label is null or char_length(shift_label) not between 1 and 80
    or shift_label ~ '^[[:space:]]|[[:space:]]$'
    or p_good_egg_count is null or p_good_egg_count < 0
    or p_cracked_egg_count is null or p_cracked_egg_count < 0
    or p_dirty_egg_count is null or p_dirty_egg_count < 0
    or p_submission_id is null or p_request_id is null
  then
    raise exception using errcode = '22023', message = 'Invalid egg collection details.';
  end if;

  insert into public.egg_collections (
    collection_date, shed_id, flock_id, shift, grade_id,
    good_egg_count, cracked_egg_count, dirty_egg_count, submission_id, created_by
  ) values (
    p_collection_date, p_shed_id, p_flock_id, shift_label, p_grade_id,
    p_good_egg_count, p_cracked_egg_count, p_dirty_egg_count, p_submission_id, actor_id
  )
  on conflict (created_by, submission_id) do nothing
  returning id, total_egg_count into collection_id, total_count;

  if collection_id is null then
    select * into strict previous
    from public.egg_collections e
    where e.created_by = actor_id and e.submission_id = p_submission_id;

    if row(previous.collection_date, previous.shed_id, previous.flock_id, previous.shift,
        previous.grade_id, previous.good_egg_count, previous.cracked_egg_count, previous.dirty_egg_count)
      is distinct from row(p_collection_date, p_shed_id, p_flock_id, shift_label,
        p_grade_id, p_good_egg_count, p_cracked_egg_count, p_dirty_egg_count)
    then
      raise exception using errcode = 'P0409', message = 'Submission already exists with different egg collection details.';
    end if;
    return previous.id;
  end if;

  insert into public.audit_events (actor_id, action, target_type, target_id, request_id, metadata)
  values (actor_id, 'egg.collection.recorded', 'egg_collection', collection_id::text, p_request_id,
    jsonb_build_object('collectionDate', p_collection_date, 'shedId', p_shed_id, 'flockId', p_flock_id,
      'gradeId', p_grade_id, 'totalEggCount', total_count));
  return collection_id;
exception when foreign_key_violation then
  raise exception using errcode = '22023', message = 'Select an existing grade and shed, and a flock placed in that shed if applicable.';
end;
$$;

create function public.record_egg_collection(
  p_collection_date date,
  p_shed_id uuid,
  p_shift text,
  p_grade_id uuid,
  p_good_egg_count integer,
  p_cracked_egg_count integer,
  p_dirty_egg_count integer,
  p_submission_id uuid,
  p_request_id uuid,
  p_flock_id uuid default null
)
returns uuid
language sql
security invoker
set search_path = ''
return farm_private.record_egg_collection(
  p_collection_date, p_shed_id, p_shift, p_grade_id, p_good_egg_count,
  p_cracked_egg_count, p_dirty_egg_count, p_submission_id, p_request_id, p_flock_id
);

revoke all on function farm_private.record_egg_collection(date, uuid, text, uuid, integer, integer, integer, uuid, uuid, uuid),
  public.record_egg_collection(date, uuid, text, uuid, integer, integer, integer, uuid, uuid, uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function farm_private.record_egg_collection(date, uuid, text, uuid, integer, integer, integer, uuid, uuid, uuid),
  public.record_egg_collection(date, uuid, text, uuid, integer, integer, integer, uuid, uuid, uuid)
  to authenticated;
