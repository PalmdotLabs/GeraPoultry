insert into public.permissions (code, name, description)
values
  ('flocks.create', 'Register flock arrivals', 'Register a flock and its initial shed placements.'),
  ('flocks.read', 'Read flock arrivals', 'View flock registrations and initial shed placements.');

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code = 'admin' and r.is_system and p.code in ('flocks.create', 'flocks.read');

create table public.flocks (
  id uuid primary key default gen_random_uuid(),
  batch_code text not null check (
    char_length(batch_code) between 1 and 120 and batch_code !~ '^[[:space:]]|[[:space:]]$'
  ),
  breed_id uuid not null references public.breeds (id),
  arrival_date date not null,
  age_at_arrival integer not null check (age_at_arrival >= 0),
  age_unit text not null check (age_unit in ('days', 'weeks')),
  birds_housed integer not null check (birds_housed > 0),
  created_by uuid not null references public.profiles (id),
  submission_id uuid not null,
  unique (created_by, submission_id)
);

create unique index flocks_batch_code_unique on public.flocks (lower(batch_code));
create index flocks_breed_id_idx on public.flocks (breed_id);
create index flocks_arrival_date_id_idx on public.flocks (arrival_date desc, id);

-- Initial placements are preserved as the source record for arrival.
create table public.flock_placements (
  flock_id uuid not null references public.flocks (id),
  shed_id uuid not null references public.sheds (id),
  bird_count integer not null check (bird_count > 0),
  primary key (flock_id, shed_id)
);

create index flock_placements_shed_id_idx on public.flock_placements (shed_id);

alter table public.flocks enable row level security;
alter table public.flock_placements enable row level security;

revoke all on public.flocks, public.flock_placements from public, anon, authenticated;
grant select (id, batch_code, breed_id, arrival_date, age_at_arrival, age_unit, birds_housed)
  on public.flocks to authenticated;
grant select on public.flock_placements to authenticated;

create policy flocks_read on public.flocks for select to authenticated
using ((select public.has_permission('flocks.read')));

create policy flock_placements_read on public.flock_placements for select to authenticated
using ((select public.has_permission('flocks.read')));

create function farm_private.register_flock(
  p_batch_code text,
  p_breed_id uuid,
  p_arrival_date date,
  p_age_at_arrival integer,
  p_age_unit text,
  p_birds_housed integer,
  p_placements jsonb,
  p_submission_id uuid,
  p_request_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  batch_label text := btrim(p_batch_code);
  registration_id uuid;
  normalized_placements jsonb;
  placement_count bigint;
  distinct_sheds bigint;
  placement_total bigint;
  min_bird_count integer;
  previous_flock public.flocks%rowtype;
  previous_placements jsonb;
begin
  if actor_id is null or not public.has_permission('flocks.create') then
    raise exception using errcode = '42501', message = 'Flock registration permission is required.';
  end if;

  if batch_label is null or char_length(batch_label) not between 1 and 120
    or batch_label ~ '^[[:space:]]|[[:space:]]$'
    or p_breed_id is null or p_arrival_date is null
    or p_arrival_date not between date '0001-01-01' and date '9999-12-31'
    or p_age_at_arrival is null or p_age_at_arrival < 0
    or p_age_unit is null or p_age_unit not in ('days', 'weeks')
    or p_birds_housed is null or p_birds_housed <= 0
    or p_submission_id is null or p_request_id is null
    or jsonb_typeof(p_placements) is distinct from 'array'
  then
    raise exception using errcode = '22023', message = 'Invalid flock registration details.';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_placements) as placement(value)
    where jsonb_typeof(placement.value -> 'shedId') is distinct from 'string'
      or jsonb_typeof(placement.value -> 'birdCount') is distinct from 'number'
  ) then
    raise exception using errcode = '22023', message = 'Each placement requires a shed and bird count.';
  end if;

  begin
    select count(*), count(distinct "shedId"), sum("birdCount"), min("birdCount"),
      jsonb_agg(jsonb_build_object('shedId', "shedId", 'birdCount', "birdCount") order by "shedId")
    into placement_count, distinct_sheds, placement_total, min_bird_count, normalized_placements
    from jsonb_to_recordset(p_placements) as placement("shedId" uuid, "birdCount" integer);
  exception when invalid_text_representation or numeric_value_out_of_range then
    raise exception using errcode = '22023', message = 'Invalid shed identifier or bird count.';
  end;

  if placement_count = 0 or distinct_sheds <> placement_count
    or min_bird_count <= 0 or placement_total <> p_birds_housed
  then
    raise exception using errcode = '22023', message = 'Place every housed bird across distinct sheds.';
  end if;

  insert into public.flocks (
    batch_code, breed_id, arrival_date, age_at_arrival, age_unit, birds_housed, created_by, submission_id
  ) values (
    batch_label, p_breed_id, p_arrival_date, p_age_at_arrival, p_age_unit, p_birds_housed, actor_id, p_submission_id
  )
  on conflict (created_by, submission_id) do nothing
  returning id into registration_id;

  if registration_id is null then
    select * into strict previous_flock
    from public.flocks f
    where f.created_by = actor_id and f.submission_id = p_submission_id;

    select jsonb_agg(jsonb_build_object('shedId', fp.shed_id, 'birdCount', fp.bird_count) order by fp.shed_id)
    into previous_placements
    from public.flock_placements fp
    where fp.flock_id = previous_flock.id;

    if row(previous_flock.batch_code, previous_flock.breed_id, previous_flock.arrival_date,
        previous_flock.age_at_arrival, previous_flock.age_unit, previous_flock.birds_housed, previous_placements)
      is distinct from row(batch_label, p_breed_id, p_arrival_date, p_age_at_arrival,
        p_age_unit, p_birds_housed, normalized_placements)
    then
      raise exception using errcode = 'P0409', message = 'Submission already exists with different flock details.';
    end if;
    return previous_flock.id;
  end if;

  insert into public.flock_placements (flock_id, shed_id, bird_count)
  select registration_id, "shedId", "birdCount"
  from jsonb_to_recordset(normalized_placements) as placement("shedId" uuid, "birdCount" integer);

  insert into public.audit_events (actor_id, action, target_type, target_id, request_id, metadata)
  values (
    actor_id, 'flock.registered', 'flock', registration_id::text, p_request_id,
    jsonb_build_object('batchCode', batch_label, 'birdsHoused', p_birds_housed)
  );
  return registration_id;
exception when foreign_key_violation then
  raise exception using errcode = '22023', message = 'Select an existing breed and sheds.';
end;
$$;

create function public.register_flock(
  p_batch_code text,
  p_breed_id uuid,
  p_arrival_date date,
  p_age_at_arrival integer,
  p_age_unit text,
  p_birds_housed integer,
  p_placements jsonb,
  p_submission_id uuid,
  p_request_id uuid
)
returns uuid
language sql
security invoker
set search_path = ''
return farm_private.register_flock(
  p_batch_code, p_breed_id, p_arrival_date, p_age_at_arrival,
  p_age_unit, p_birds_housed, p_placements, p_submission_id, p_request_id
);

revoke all on function farm_private.register_flock(text, uuid, date, integer, text, integer, jsonb, uuid, uuid),
  public.register_flock(text, uuid, date, integer, text, integer, jsonb, uuid, uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant usage on schema farm_private to authenticated;
grant execute on function farm_private.register_flock(text, uuid, date, integer, text, integer, jsonb, uuid, uuid),
  public.register_flock(text, uuid, date, integer, text, integer, jsonb, uuid, uuid)
  to authenticated;
