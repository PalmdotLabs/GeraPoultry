insert into public.permissions (code, name, description)
values ('flocks.mortality.create', 'Record flock mortality', 'Record losses against a flock and shed placement.');

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code = 'admin' and r.is_system and p.code = 'flocks.mortality.create';

alter table public.flock_placements add column live_bird_count integer;
update public.flock_placements set live_bird_count = bird_count;
alter table public.flock_placements
  alter column live_bird_count set not null,
  add constraint flock_placements_live_bird_count_valid
    check (live_bird_count between 0 and bird_count);

create function farm_private.initialize_placement_live_count()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.live_bird_count := new.bird_count;
  return new;
end;
$$;

revoke all on function farm_private.initialize_placement_live_count()
  from public, anon, authenticated, service_role, supabase_auth_admin;

create trigger flock_placements_initialize_live_count
before insert on public.flock_placements
for each row execute function farm_private.initialize_placement_live_count();

create table public.flock_mortality (
  id uuid primary key default gen_random_uuid(),
  flock_id uuid not null,
  shed_id uuid not null,
  recorded_date date not null check (
    recorded_date between date '0001-01-01' and date '9999-12-31'
  ),
  bird_count integer not null check (bird_count > 0),
  remarks text check (char_length(remarks) <= 500),
  created_by uuid not null references public.profiles (id),
  submission_id uuid not null,
  created_at timestamptz not null default now(),
  unique (created_by, submission_id),
  foreign key (flock_id, shed_id) references public.flock_placements (flock_id, shed_id)
);

create index flock_mortality_placement_idx on public.flock_mortality (flock_id, shed_id);

alter table public.flock_mortality enable row level security;
revoke all on public.flock_mortality from public, anon, authenticated;

create function farm_private.record_flock_mortality(
  p_flock_id uuid,
  p_shed_id uuid,
  p_recorded_date date,
  p_bird_count integer,
  p_remarks text,
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
  normalized_remarks text := nullif(btrim(p_remarks), '');
  mortality_id uuid;
  previous_entry public.flock_mortality%rowtype;
  remaining_birds integer;
begin
  if actor_id is null or not public.has_permission('flocks.mortality.create') then
    raise exception using errcode = '42501', message = 'Flock mortality permission is required.';
  end if;

  if p_flock_id is null or p_shed_id is null
    or p_recorded_date is null or p_recorded_date not between date '0001-01-01' and date '9999-12-31'
    or p_bird_count is null or p_bird_count <= 0
    or char_length(normalized_remarks) > 500
    or p_submission_id is null or p_request_id is null
  then
    raise exception using errcode = '22023', message = 'Invalid mortality entry.';
  end if;

  insert into public.flock_mortality (
    flock_id, shed_id, recorded_date, bird_count, remarks, created_by, submission_id
  ) values (
    p_flock_id, p_shed_id, p_recorded_date, p_bird_count, normalized_remarks, actor_id, p_submission_id
  )
  on conflict (created_by, submission_id) do nothing
  returning id into mortality_id;

  if mortality_id is null then
    select * into strict previous_entry
    from public.flock_mortality m
    where m.created_by = actor_id and m.submission_id = p_submission_id;

    if row(previous_entry.flock_id, previous_entry.shed_id, previous_entry.recorded_date,
        previous_entry.bird_count, previous_entry.remarks)
      is distinct from row(p_flock_id, p_shed_id, p_recorded_date, p_bird_count, normalized_remarks)
    then
      raise exception using errcode = 'P0409', message = 'Submission already exists with different mortality details.';
    end if;
    return previous_entry.id;
  end if;

  update public.flock_placements fp
  set live_bird_count = fp.live_bird_count - p_bird_count
  where fp.flock_id = p_flock_id and fp.shed_id = p_shed_id
    and fp.live_bird_count >= p_bird_count
  returning live_bird_count into remaining_birds;

  if not found then
    raise exception using errcode = 'P0410', message = 'Mortality exceeds the live bird count in this shed.';
  end if;

  insert into public.audit_events (actor_id, action, target_type, target_id, request_id, metadata)
  values (
    actor_id, 'flock.mortality.recorded', 'flock_mortality', mortality_id::text, p_request_id,
    jsonb_build_object('flockId', p_flock_id, 'shedId', p_shed_id,
      'recordedDate', p_recorded_date, 'birdCount', p_bird_count, 'remainingBirds', remaining_birds)
  );
  return mortality_id;
exception when foreign_key_violation then
  raise exception using errcode = 'P0404', message = 'Flock placement not found.';
end;
$$;

create function public.record_flock_mortality(
  p_flock_id uuid,
  p_shed_id uuid,
  p_recorded_date date,
  p_bird_count integer,
  p_remarks text,
  p_submission_id uuid,
  p_request_id uuid
)
returns uuid
language sql
security invoker
set search_path = ''
return farm_private.record_flock_mortality(
  p_flock_id, p_shed_id, p_recorded_date, p_bird_count, p_remarks, p_submission_id, p_request_id
);

revoke all on function farm_private.record_flock_mortality(uuid, uuid, date, integer, text, uuid, uuid),
  public.record_flock_mortality(uuid, uuid, date, integer, text, uuid, uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function farm_private.record_flock_mortality(uuid, uuid, date, integer, text, uuid, uuid),
  public.record_flock_mortality(uuid, uuid, date, integer, text, uuid, uuid)
  to authenticated;
