begin;
select '1..1';

insert into auth.users (id, email)
values
  ('a0000000-0000-4000-8000-000000000001', 'mortality-admin@example.test'),
  ('a0000000-0000-4000-8000-000000000002', 'mortality-employee@example.test'),
  ('a0000000-0000-4000-8000-000000000003', 'mortality-reader@example.test');

insert into public.roles (code, name)
values ('mortality_test_creator', 'Mortality creator'), ('mortality_test_reader', 'Mortality reader');

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on
  (r.code = 'mortality_test_creator' and p.code = 'flocks.mortality.create')
  or (r.code = 'mortality_test_reader' and p.code = 'flocks.read');

insert into public.user_roles (user_id, role_id)
select fixture.user_id, r.id
from (values
  ('a0000000-0000-4000-8000-000000000001'::uuid, 'admin'),
  ('a0000000-0000-4000-8000-000000000002'::uuid, 'mortality_test_creator'),
  ('a0000000-0000-4000-8000-000000000003'::uuid, 'mortality_test_reader')
) fixture(user_id, role_code)
join public.roles r on r.code = fixture.role_code;

insert into public.breeds (id, name)
values ('a0000000-0000-4000-8000-000000000004', 'Mortality test breed');

insert into public.sheds (id, name)
values
  ('a0000000-0000-4000-8000-000000000005', 'Mortality test shed A'),
  ('a0000000-0000-4000-8000-000000000006', 'Mortality test shed B');

set local role authenticated;
do $$
declare
  flock uuid;
  shed_a uuid := 'a0000000-0000-4000-8000-000000000005';
  shed_b uuid := 'a0000000-0000-4000-8000-000000000006';
  unplaced_shed uuid := 'a0000000-0000-4000-8000-000000000007';
  submission uuid := gen_random_uuid();
  mortality uuid;
begin
  perform set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001"}', true);
  flock := public.register_flock(
    'MORTALITY-TEST', 'a0000000-0000-4000-8000-000000000004', date '2026-11-26', 0, 'days', 100,
    jsonb_build_array(jsonb_build_object('shedId', shed_a, 'birdCount', 40),
      jsonb_build_object('shedId', shed_b, 'birdCount', 60)),
    gen_random_uuid(), gen_random_uuid()
  );
  if (select sum(live_bird_count) from public.flock_placements where flock_id = flock) <> 100 then
    raise exception 'New placements must initialize to the original bird count';
  end if;

  perform set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000003"}', true);
  begin
    perform public.record_flock_mortality(flock, shed_a, date '2026-11-26', 1, '', submission, gen_random_uuid());
    raise exception 'Expected reader to be refused';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000002"}', true);
  begin
    perform public.record_flock_mortality(flock, unplaced_shed, date '2026-11-26', 1, '', submission, gen_random_uuid());
    raise exception 'Expected missing placement to be refused';
  exception when sqlstate 'P0404' then null;
  end;
  begin
    perform public.record_flock_mortality(flock, shed_a, date '2026-11-26', 41, '', submission, gen_random_uuid());
    raise exception 'Expected an excessive loss to roll back';
  exception when sqlstate 'P0410' then null;
  end;

  mortality := public.record_flock_mortality(flock, shed_a, date '2026-11-26', 40, ' remarks ', submission, gen_random_uuid());
  if public.record_flock_mortality(flock, shed_a, date '2026-11-26', 40, 'remarks', submission, gen_random_uuid())
    is distinct from mortality then
    raise exception 'Expected an unchanged replay to return the original ID at zero live birds';
  end if;
  begin
    perform public.record_flock_mortality(flock, shed_a, date '2026-11-26', 39, 'remarks', submission, gen_random_uuid());
    raise exception 'Expected a changed replay to conflict';
  exception when sqlstate 'P0409' then null;
  end;

  perform set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000003"}', true);
  if (select live_bird_count from public.flock_placements where flock_id = flock and shed_id = shed_a) is distinct from 0
    or (select bird_count from public.flock_placements where flock_id = flock and shed_id = shed_a) is distinct from 40
    or (select live_bird_count from public.flock_placements where flock_id = flock and shed_id = shed_b) is distinct from 60 then
    raise exception 'Expected the original placement and other shed to remain intact';
  end if;

  perform set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001"}', true);
  if (select count(*) from public.audit_events where action = 'flock.mortality.recorded'
      and target_id = mortality::text and metadata->>'remainingBirds' = '0'
      and actor_id = 'a0000000-0000-4000-8000-000000000002') <> 1 then
    raise exception 'Expected exactly one mortality audit event';
  end if;
  begin
    update public.flock_placements set live_bird_count = 40 where flock_id = flock and shed_id = shed_a;
    raise exception 'Expected the direct update to be refused';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

do $$
begin
  if (select count(*) from public.flock_mortality m join public.flocks f on f.id = m.flock_id
      where f.batch_code = 'MORTALITY-TEST') <> 1 then
    raise exception 'Expected only the committed mortality record';
  end if;
end;
$$;

select 'ok 1 - mortality authorization, rollback, replay, live counts and audit';
rollback;
