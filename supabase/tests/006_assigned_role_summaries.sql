begin;
select plan(15);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_user_meta_data
)
select id, '00000000-0000-0000-0000-000000000000', 'authenticated',
  'authenticated', key || '@example.test', 'not-a-real-password',
  now(), now(), now(), jsonb_build_object('display_name', initcap(key))
from (values
  ('summary_admin', '80000000-0000-0000-0000-000000000001'::uuid),
  ('summary_reader', '80000000-0000-0000-0000-000000000002'::uuid),
  ('summary_manager', '80000000-0000-0000-0000-000000000003'::uuid),
  ('summary_plain', '80000000-0000-0000-0000-000000000004'::uuid),
  ('summary_inactive', '80000000-0000-0000-0000-000000000005'::uuid),
  ('summary_target', '80000000-0000-0000-0000-000000000006'::uuid),
  ('summary_other', '80000000-0000-0000-0000-000000000007'::uuid)
) fixtures(key, id);

insert into public.roles (id, code, name) values
  ('81000000-0000-0000-0000-000000000001', 'summary_assignment_a', 'Assignment A'),
  ('81000000-0000-0000-0000-000000000002', 'summary_assignment_z', 'Assignment Z'),
  ('81000000-0000-0000-0000-000000000003', 'summary_reader_only', 'Reader only'),
  ('81000000-0000-0000-0000-000000000004', 'summary_manager_only', 'Manager only'),
  ('81000000-0000-0000-0000-000000000005', 'summary_unrequested', 'Unrequested');

insert into public.role_permissions (role_id, permission_id)
select '81000000-0000-0000-0000-000000000003', id
from public.permissions where code = 'users.read';
insert into public.role_permissions (role_id, permission_id)
select '81000000-0000-0000-0000-000000000004', id
from public.permissions where code = 'users.manage';

insert into public.user_roles (user_id, role_id) values
  ('80000000-0000-0000-0000-000000000001',
   (select id from public.roles where code = 'admin')),
  ('80000000-0000-0000-0000-000000000002', '81000000-0000-0000-0000-000000000003'),
  ('80000000-0000-0000-0000-000000000003', '81000000-0000-0000-0000-000000000004'),
  ('80000000-0000-0000-0000-000000000005', '81000000-0000-0000-0000-000000000003'),
  ('80000000-0000-0000-0000-000000000006', '81000000-0000-0000-0000-000000000001'),
  ('80000000-0000-0000-0000-000000000006', '81000000-0000-0000-0000-000000000002'),
  ('80000000-0000-0000-0000-000000000007', '81000000-0000-0000-0000-000000000005');
update public.profiles set is_active = false
where id = '80000000-0000-0000-0000-000000000005';

select ok(
  not has_function_privilege(
    'anon', 'public.get_assigned_role_summaries(uuid[])', 'EXECUTE'
  ) and not has_function_privilege(
    'anon', 'public.administrative_auth_users_page(bigint,integer)', 'EXECUTE'
  ),
  'anonymous callers have no role-summary or Auth-pagination execution grant'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"80000000-0000-0000-0000-000000000001"}', true
);
select results_eq(
  $$with page as (
    select public.administrative_auth_users_page(0, 3) as body
  ) select body -> 'users' -> 0 ->> 'id',
      body -> 'users' -> 1 ->> 'id',
      body -> 'users' -> 2 ->> 'id', body ->> 'total'
    from page$$,
  $$values
    ('80000000-0000-0000-0000-000000000001',
     '80000000-0000-0000-0000-000000000005',
     '80000000-0000-0000-0000-000000000003', '7')$$,
  'first Auth page is globally ordered by lowercased email and reports exact total'
);
select results_eq(
  $$with page as (
    select public.administrative_auth_users_page(3, 3) as body
  ) select body -> 'users' -> 0 ->> 'id',
      body -> 'users' -> 1 ->> 'id',
      body -> 'users' -> 2 ->> 'id', body ->> 'total'
    from page$$,
  $$values
    ('80000000-0000-0000-0000-000000000007',
     '80000000-0000-0000-0000-000000000004',
     '80000000-0000-0000-0000-000000000002', '7')$$,
  'second Auth page continues the same global email ordering with exact total'
);
select results_eq(
  $$select public.administrative_auth_users_page(700, 100)$$,
  $$select jsonb_build_object(
    'users', '[]'::jsonb,
    'total', 7)$$,
  'beyond-range Auth pages return no users without losing the total count'
);
select results_eq(
  $$select jsonb_object_keys(
    public.administrative_auth_users_page(0, 1) -> 'users' -> 0)
    order by 1$$,
  $$values ('created_at'), ('email'), ('email_confirmed_at'), ('id'),
    ('invited_at'), ('last_sign_in_at')$$,
  'each Auth page user has exactly the six nullable-aware metadata fields'
);
select throws_ok(
  $$select public.administrative_auth_users_page(0, 101)$$,
  '22023', null, 'Auth pagination rejects a limit above 100'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"80000000-0000-0000-0000-000000000002"}', true
);
select ok(
  public.has_permission('users.read') and not public.has_permission('roles.read')
    and not public.has_permission('users.manage'),
  'the fixture has users.read without roles.read or users.manage'
);
select results_eq(
  $$select user_id, role_id, role_code, role_name
    from public.get_assigned_role_summaries(
      array['80000000-0000-0000-0000-000000000006'::uuid])$$,
  $$values
    ('80000000-0000-0000-0000-000000000006'::uuid,
     '81000000-0000-0000-0000-000000000001'::uuid,
     'summary_assignment_a', 'Assignment A'),
    ('80000000-0000-0000-0000-000000000006'::uuid,
     '81000000-0000-0000-0000-000000000002'::uuid,
     'summary_assignment_z', 'Assignment Z')$$,
  'users.read receives exact ordered assignment summaries without unrequested roles'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"80000000-0000-0000-0000-000000000003"}', true
);
select results_eq(
  $$select role_code, role_name
    from public.get_assigned_role_summaries(
      array['80000000-0000-0000-0000-000000000006'::uuid])$$,
  $$values
    ('summary_assignment_a', 'Assignment A'),
    ('summary_assignment_z', 'Assignment Z')$$,
  'users.manage without users.read is independently sufficient'
);
select is(
  (select count(*) from public.get_assigned_role_summaries('{}'::uuid[])),
  0::bigint,
  'an empty requested user set returns no role summaries'
);
select throws_ok(
  $$select * from public.get_assigned_role_summaries(
    array(select gen_random_uuid() from generate_series(1, 101)))$$,
  '22023', null, 'more than 100 distinct requested user IDs is rejected'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"80000000-0000-0000-0000-000000000004"}', true
);
select throws_ok(
  $$select * from public.get_assigned_role_summaries(
    array['80000000-0000-0000-0000-000000000006'::uuid])$$,
  '42501', null, 'an active user without users.read or users.manage is denied'
);
select throws_ok(
  $$select public.administrative_auth_users_page(0, 50)$$,
  '42501', null, 'Auth pagination denies an active user without users.read'
);
select set_config(
  'request.jwt.claims',
  '{"sub":"80000000-0000-0000-0000-000000000005"}', true
);
select throws_ok(
  $$select * from public.get_assigned_role_summaries(
    array['80000000-0000-0000-0000-000000000006'::uuid])$$,
  '42501', null, 'an inactive users.read caller is denied'
);
select throws_ok(
  $$select public.administrative_auth_users_page(0, 50)$$,
  '42501', null, 'Auth pagination denies an inactive users.read caller'
);

select * from finish();
rollback;
