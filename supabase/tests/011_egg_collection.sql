begin;
select '1..1';

insert into auth.users (id, email)
values
  ('b0000000-0000-4000-8000-000000000001', 'egg-admin@example.test'),
  ('b0000000-0000-4000-8000-000000000002', 'egg-collector@example.test'),
  ('b0000000-0000-4000-8000-000000000003', 'egg-reader@example.test');

insert into public.roles (code, name)
values ('egg_test_collector', 'Egg collector'), ('egg_test_reader', 'Egg reader');

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on
  (r.code = 'egg_test_collector' and p.code in ('eggs.collection.create', 'farm.setup.read'))
  or (r.code = 'egg_test_reader' and p.code = 'eggs.collection.read');

insert into public.user_roles (user_id, role_id)
select fixture.user_id, r.id
from (values
  ('b0000000-0000-4000-8000-000000000001'::uuid, 'admin'),
  ('b0000000-0000-4000-8000-000000000002'::uuid, 'egg_test_collector'),
  ('b0000000-0000-4000-8000-000000000003'::uuid, 'egg_test_reader')
) fixture(user_id, role_code)
join public.roles r on r.code = fixture.role_code;

insert into public.breeds (id, name)
values ('b0000000-0000-4000-8000-000000000004', 'Egg test breed');
insert into public.sheds (id, name)
values
  ('b0000000-0000-4000-8000-000000000005', 'Egg test shed A'),
  ('b0000000-0000-4000-8000-000000000006', 'Egg test shed B');

set local role authenticated;
do $$
declare
  flock uuid;
  grade uuid;
  shed_a uuid := 'b0000000-0000-4000-8000-000000000005';
  shed_b uuid := 'b0000000-0000-4000-8000-000000000006';
  submission uuid := gen_random_uuid();
  collection uuid;
  linked_collection uuid;
begin
  perform set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-000000000001"}', true);
  insert into public.egg_grades (name) values ('Egg test grade') returning id into grade;
  flock := public.register_flock(
    'EGG-TEST', 'b0000000-0000-4000-8000-000000000004', date '2026-11-26', 0, 'days', 50,
    jsonb_build_array(jsonb_build_object('shedId', shed_a, 'birdCount', 50)),
    gen_random_uuid(), gen_random_uuid()
  );

  perform set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-000000000002"}', true);
  if not exists (select 1 from public.egg_grades g where g.id = grade) then
    raise exception 'Expected the collector to see configured grades';
  end if;
  begin
    insert into public.egg_grades (name) values ('Employee grade');
    raise exception 'Expected employee grade creation to be refused';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.record_egg_collection(date '2026-11-26', shed_b, 'Morning', grade, 35, 2, 3,
      submission, gen_random_uuid(), flock);
    raise exception 'Expected a flock in another shed to be refused';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.record_egg_collection(date '2026-11-26', shed_a, 'Morning', grade, -1, 2, 3,
      submission, gen_random_uuid());
    raise exception 'Expected negative eggs to be refused';
  exception when invalid_parameter_value then null;
  end;

  collection := public.record_egg_collection(date '2026-11-26', shed_a, ' Morning ', grade, 35, 2, 3,
    submission, gen_random_uuid());
  if public.record_egg_collection(date '2026-11-26', shed_a, 'Morning', grade, 35, 2, 3,
      submission, gen_random_uuid(), null) is distinct from collection then
    raise exception 'Expected unchanged replay to return the original collection';
  end if;
  begin
    perform public.record_egg_collection(date '2026-11-26', shed_a, 'Morning', grade, 36, 2, 3,
      submission, gen_random_uuid());
    raise exception 'Expected a changed replay to conflict';
  exception when sqlstate 'P0409' then null;
  end;
  linked_collection := public.record_egg_collection(date '2026-11-26', shed_a, 'Morning', grade, 35, 2, 3,
    gen_random_uuid(), gen_random_uuid(), flock);

  if exists (select id from public.egg_collections where id = collection) then
    raise exception 'Expected create access to exclude read access';
  end if;
  perform set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-000000000003"}', true);
  if not exists (
      select 1 from public.egg_collections e where e.id = collection and e.flock_id is null
        and e.shift = 'Morning' and e.good_egg_count = 35 and e.cracked_egg_count = 2
        and e.dirty_egg_count = 3 and e.total_egg_count = 40
    ) or not exists (
      select 1 from public.egg_collections e where e.id = linked_collection and e.flock_id = flock
    ) then
    raise exception 'Expected shed-only and explicit flock records with all quality counts';
  end if;
  begin
    perform public.record_egg_collection(date '2026-11-26', shed_a, 'Morning', grade, 35, 2, 3,
      gen_random_uuid(), gen_random_uuid());
    raise exception 'Expected a reader to be refused';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-000000000001"}', true);
  if (select count(*) from public.audit_events where target_id = collection::text
      and action = 'egg.collection.recorded' and metadata ->> 'totalEggCount' = '40'
      and actor_id = 'b0000000-0000-4000-8000-000000000002') <> 1 then
    raise exception 'Expected one attributed audit event for the replayed collection';
  end if;
end;
$$;

select 'ok 1 - egg collection permissions, grade, flock attribution, quality counts, replay and audit';
rollback;
