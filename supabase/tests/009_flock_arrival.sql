begin;
select '1..1';

insert into auth.users (id, email)
values
  ('90000000-0000-4000-8000-000000000001', 'flock-admin@example.test'),
  ('90000000-0000-4000-8000-000000000002', 'flock-creator@example.test'),
  ('90000000-0000-4000-8000-000000000003', 'flock-viewer@example.test');

insert into public.roles (code, name)
values ('flock_test_creator', 'Flock creator'), ('flock_test_viewer', 'Flock viewer');

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on
  (r.code = 'flock_test_creator' and p.code = 'flocks.create')
  or (r.code = 'flock_test_viewer' and p.code = 'flocks.read');

insert into public.user_roles (user_id, role_id)
select fixture.user_id, r.id
from (values
  ('90000000-0000-4000-8000-000000000001'::uuid, 'admin'),
  ('90000000-0000-4000-8000-000000000002', 'flock_test_creator'),
  ('90000000-0000-4000-8000-000000000003', 'flock_test_viewer')
) fixture(user_id, role_code)
join public.roles r on r.code = fixture.role_code;

insert into public.breeds (id, name) values ('90000000-0000-4000-8000-000000000004', 'Arrival test breed');
insert into public.sheds (id, name)
values
  ('90000000-0000-4000-8000-000000000005', 'Arrival test shed A'),
  ('90000000-0000-4000-8000-000000000006', 'Arrival test shed B');

set local role authenticated;
do $$
declare
  breed uuid := '90000000-0000-4000-8000-000000000004';
  shed_a uuid := '90000000-0000-4000-8000-000000000005';
  shed_b uuid := '90000000-0000-4000-8000-000000000006';
  unknown_shed uuid := '90000000-0000-4000-8000-000000000007';
  expected_request_id uuid := gen_random_uuid();
  submission uuid := gen_random_uuid();
  valid_placements jsonb := jsonb_build_array(
    jsonb_build_object('shedId', shed_a, 'birdCount', 30),
    jsonb_build_object('shedId', shed_b, 'birdCount', 70)
  );
  registered_id uuid;
  invalid_placements jsonb;
begin
  perform set_config('request.jwt.claims', '{"sub":"90000000-0000-4000-8000-000000000002"}', true);
  foreach invalid_placements in array array[
    jsonb_build_array(jsonb_build_object('shedId', shed_a, 'birdCount', 99)),
    jsonb_build_array(
      jsonb_build_object('shedId', shed_a, 'birdCount', 40),
      jsonb_build_object('shedId', shed_a, 'birdCount', 60)
    ),
    jsonb_build_array(jsonb_build_object('shedId', unknown_shed, 'birdCount', 100)),
    jsonb_build_array(jsonb_build_object('shedId', shed_a, 'birdCount', '100'))
  ] loop
    begin
      perform public.register_flock(
        'ARRIVAL-TEST', breed, date '2026-11-26', 0, 'days', 100,
        invalid_placements, submission, expected_request_id
      );
      raise exception 'Expected invalid placement to be rejected';
    exception when invalid_parameter_value then null;
    end;
  end loop;

  registered_id := public.register_flock(
    'ARRIVAL-TEST', breed, date '2026-11-26', 0, 'days', 100,
    valid_placements, submission, expected_request_id
  );
  if public.register_flock(
    'ARRIVAL-TEST', breed, date '2026-11-26', 0, 'days', 100,
    jsonb_build_array(valid_placements -> 1, valid_placements -> 0), submission, gen_random_uuid()
  ) is distinct from registered_id then
    raise exception 'Expected retry to return the original flock even with reordered placements';
  end if;
  begin
    perform public.register_flock(
      'ARRIVAL-TEST', breed, date '2026-11-26', 1, 'days', 100,
      valid_placements, submission, gen_random_uuid()
    );
    raise exception 'Expected changed submission to conflict';
  exception when sqlstate 'P0409' then null;
  end;
  begin
    perform public.register_flock(
      'arrival-test', breed, date '2026-11-26', 0, 'days', 100,
      valid_placements, gen_random_uuid(), gen_random_uuid()
    );
    raise exception 'Expected duplicate batch code to be rejected';
  exception when unique_violation then null;
  end;
  if exists (select id from public.flocks) then
    raise exception 'A create-only employee should not get read access';
  end if;

  perform set_config('request.jwt.claims', '{"sub":"90000000-0000-4000-8000-000000000003"}', true);
  if (select count(id) from public.flocks where id = registered_id) <> 1
    or (select count(*) from public.flock_placements where flock_id = registered_id) <> 2
    or (select sum(bird_count) from public.flock_placements where flock_id = registered_id) <> 100 then
    raise exception 'Expected the reader to see the entire registration';
  end if;
  begin
    perform public.register_flock(
      'RESTRICTED', breed, date '2026-11-26', 0, 'days', 100,
      valid_placements, gen_random_uuid(), gen_random_uuid()
    );
    raise exception 'Expected a read-only employee to be refused';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claims', '{"sub":"90000000-0000-4000-8000-000000000001"}', true);
  begin
    delete from public.flock_placements where flock_id = registered_id;
    raise exception 'Expected direct modifications to be refused';
  exception when insufficient_privilege then null;
  end;
  if (select count(*) from public.audit_events
      where action = 'flock.registered' and target_id = registered_id::text
        and actor_id = '90000000-0000-4000-8000-000000000002' and audit_events.request_id = expected_request_id) <> 1 then
    raise exception 'Expected exactly one audit entry attributed to the registration and first request';
  end if;
end;
$$;

select 'ok 1 - flock arrival permissions, atomic placement, replay and audit';
rollback;
