begin;
select '1..1';

insert into auth.users (id, email)
values
  ('80000000-0000-4000-8000-000000000001', 'farm-admin@example.test'),
  ('80000000-0000-4000-8000-000000000002', 'farm-reader@example.test'),
  ('80000000-0000-4000-8000-000000000003', 'farm-no-role@example.test');

insert into public.roles (code, name)
values ('farm_setup_test_reader', 'Farm setup test reader');

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code = 'farm_setup_test_reader' and p.code = 'farm.setup.read';

insert into public.user_roles (user_id, role_id)
select '80000000-0000-4000-8000-000000000001'::uuid, id from public.roles where code = 'admin'
union all
select '80000000-0000-4000-8000-000000000002', id from public.roles where code = 'farm_setup_test_reader';

set local role authenticated;
do $$
declare
  created_shed record;
begin
  perform set_config('request.jwt.claims', '{"sub":"80000000-0000-4000-8000-000000000001"}', true);
  insert into public.sheds (name) values ('Farm test shed') returning id, name into strict created_shed;
  insert into public.breeds (name) values ('Farm test breed');

  begin
    insert into public.sheds (name) values ('FARM TEST SHED');
    raise exception 'Expected a case-insensitive duplicate to be rejected';
  exception when unique_violation then null;
  end;
  begin
    insert into public.breeds (name) values ('   ');
    raise exception 'Expected a blank name to be rejected';
  exception when check_violation then null;
  end;

  if not exists (
    select 1 from public.audit_events e
    join public.sheds s on s.id::text = e.target_id
    where s.name = 'Farm test shed' and e.action = 'sheds.insert'
      and e.actor_id = '80000000-0000-4000-8000-000000000001'
  ) or not exists (
    select 1 from public.audit_events e
    join public.breeds b on b.id::text = e.target_id
    where b.name = 'Farm test breed' and e.action = 'breeds.insert'
      and e.actor_id = '80000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'Expected audit records attributed to the creator';
  end if;

  perform set_config('request.jwt.claims', '{"sub":"80000000-0000-4000-8000-000000000002"}', true);
  if (select count(*) from public.sheds where name = 'Farm test shed') <> 1
    or (select count(*) from public.breeds where name = 'Farm test breed') <> 1 then
    raise exception 'Expected the employee with explicit read access to see both lookups';
  end if;
  begin
    insert into public.breeds (name) values ('Employee-created breed');
    raise exception 'Expected employee insertion to be denied';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claims', '{"sub":"80000000-0000-4000-8000-000000000003"}', true);
  if exists (select 1 from public.sheds) or exists (select 1 from public.breeds) then
    raise exception 'Expected no lookup visibility for an employee without permission';
  end if;
end;
$$;

reset role;
update public.profiles set is_active = false
where id = '80000000-0000-4000-8000-000000000002';
set local role authenticated;
do $$
begin
  perform set_config('request.jwt.claims', '{"sub":"80000000-0000-4000-8000-000000000002"}', true);
  if exists (select 1 from public.sheds) or exists (select 1 from public.breeds) then
    raise exception 'Expected deactivation to remove lookup visibility';
  end if;
end;
$$;

reset role;
set local role anon;
do $$
begin
  begin
    perform 1 from public.sheds;
    raise exception 'Expected anonymous read to be denied';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select 'ok 1 - farm lookup validation, permissions, and creation audit';
rollback;
