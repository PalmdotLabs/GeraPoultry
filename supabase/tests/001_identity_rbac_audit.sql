begin;
select plan(28);

create temp table test_ids (
  key text primary key,
  id uuid not null unique
) on commit drop;
insert into test_ids values
  ('admin', '10000000-0000-0000-0000-000000000001'),
  ('no_role', '10000000-0000-0000-0000-000000000002'),
  ('inactive', '10000000-0000-0000-0000-000000000003'),
  ('missing_profile', '10000000-0000-0000-0000-000000000004');

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_user_meta_data
)
select
  id, '00000000-0000-0000-0000-000000000000', 'authenticated',
  'authenticated', key || '@example.test', 'not-a-real-password',
  now(), now(), now(), jsonb_build_object('display_name', initcap(key))
from test_ids;

select is(
  (select count(*) from public.profiles p join test_ids t on t.id = p.id),
  4::bigint,
  'every new Auth user receives a profile'
);
select is(
  (select display_name from public.profiles where id = '10000000-0000-0000-0000-000000000001'),
  'Admin',
  'profile trigger uses display_name metadata'
);
select results_eq(
  'select code from public.permissions order by code',
  $$select * from (values
    ('admin.access'), ('audit.read'), ('eggs.collection.create'), ('eggs.collection.read'), ('farm.setup.read'), ('flocks.create'), ('flocks.mortality.create'), ('flocks.read'), ('roles.manage'),
    ('roles.read'), ('users.manage'), ('users.read')
  ) expected(code)$$,
  'exact initial permission catalog is present'
);
select results_eq(
  'select code, name, is_system from public.roles',
  $$values ('admin', 'Admin', true)$$,
  'admin is the only initial role and is a system role'
);
select results_eq(
  $$select p.code
    from public.role_permissions rp
    join public.roles r on r.id = rp.role_id
    join public.permissions p on p.id = rp.permission_id
    where r.code = 'admin'
    order by p.code$$,
  'select code from public.permissions order by code',
  'admin has all initial permissions'
);
delete from public.profiles where id = '10000000-0000-0000-0000-000000000004';

set local role anon;
select throws_ok(
  'select public.get_session_context()',
  '42501',
  null,
  'anonymous callers cannot execute the session RPC'
);
select throws_ok(
  'select * from public.profiles',
  '42501',
  null,
  'anonymous callers cannot read profiles'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{}', true);
select is(
  public.get_session_context(), null,
  'authenticated execution without a user identity returns null'
);
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000004"}',
  true
);
select is(
  public.get_session_context(), null,
  'a missing profile returns null'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002"}',
  true
);
select is(
  public.get_session_context(),
  '{"displayName":"No_Role","roles":[],"permissions":[]}'::jsonb,
  'an active user without roles receives deterministic empty collections'
);
select ok(
  not public.has_permission('admin.access'),
  'an active no-role user lacks admin.access'
);
select results_eq(
  'select id from public.profiles',
  $$values ('10000000-0000-0000-0000-000000000002'::uuid)$$,
  'a no-role user sees only their own profile'
);
select throws_ok(
  $$update public.profiles set is_active = false
    where id = '10000000-0000-0000-0000-000000000002'$$,
  '42501',
  null,
  'a user cannot directly change their own active status'
);
select throws_ok(
  $$insert into public.roles (code, name) values ('forbidden', 'Forbidden')$$,
  '42501',
  null,
  'a no-role user cannot mutate roles through RLS'
);
select throws_ok(
  $$insert into public.audit_events (action, target_type, target_id)
    values ('forged', 'role', 'forged')$$,
  '42501',
  null,
  'an application user cannot directly forge audit events'
);

reset role;
insert into public.user_roles (user_id, role_id, assigned_by)
select '10000000-0000-0000-0000-000000000001', r.id,
  '10000000-0000-0000-0000-000000000001'
from public.roles r where r.code = 'admin';

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001"}',
  true
);
select ok(public.has_permission('admin.access'), 'admin has admin.access');
select results_eq(
  'select public.active_permissions()',
  'select code from public.permissions order by code',
  'active permission helper returns sorted effective permissions'
);
select is(
  (select count(*) from public.profiles),
  3::bigint,
  'users.read allows the admin to read other profiles'
);
select throws_ok(
  'update public.audit_events set action = ''tampered'' where true',
  '42501',
  null,
  'even an admin cannot directly modify audit events'
);
select throws_ok(
  'delete from public.audit_events where true',
  '42501',
  null,
  'even an admin cannot directly delete audit events'
);

select lives_ok(
  $$insert into public.user_roles (user_id, role_id, assigned_by)
    select '10000000-0000-0000-0000-000000000002', r.id,
      '10000000-0000-0000-0000-000000000001'
    from public.roles r where r.code = 'admin'$$,
  'users.manage permits an admin to assign a role'
);
select results_eq(
  $$select action, target_type, actor_id
    from public.audit_events order by id desc limit 1$$,
  $$values (
    'user_roles.insert', 'user_roles',
    '10000000-0000-0000-0000-000000000001'::uuid
  )$$,
  'user role insertion captures an attributed audit row'
);
delete from public.user_roles
where user_id = '10000000-0000-0000-0000-000000000002';

select lives_ok(
  $$select public.admin_upsert_role(
    null, 'permission_rpc_test', 'Permission RPC test', '',
    array[(select id from public.permissions where code = 'audit.read')])$$,
  'roles.manage permits an admin to create a role permission through the audited RPC'
);
select lives_ok(
  $$select public.admin_upsert_role(
    (select id from public.roles where code = 'permission_rpc_test'),
    'permission_rpc_test', 'Permission RPC test', '', '{}'::uuid[])$$,
  'roles.manage permits an admin to remove a role permission through the audited RPC'
);
select results_eq(
  $$select action, target_type
    from public.audit_events
    where target_type = 'role_permissions' and actor_id is not null
    order by id$$,
  $$values
    ('role_permissions.insert', 'role_permissions'),
    ('role_permissions.delete', 'role_permissions')$$,
  'RPC role permission insertion and deletion both capture audit rows'
);

reset role;
update public.profiles set is_active = false
where id = '10000000-0000-0000-0000-000000000003';
insert into public.user_roles (user_id, role_id)
select '10000000-0000-0000-0000-000000000003', id from public.roles where code = 'admin';

update public.profiles set display_name = 'Admin User'
where id = '10000000-0000-0000-0000-000000000001';
insert into public.roles (id, code, name) values
  ('20000000-0000-0000-0000-000000000001', 'aaa_contract_test', 'First test role'),
  ('20000000-0000-0000-0000-000000000002', 'zzz_contract_test', 'Last test role');
insert into public.user_roles (user_id, role_id)
select '10000000-0000-0000-0000-000000000001', id
from public.roles where code like '%_contract_test';

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003"}',
  true
);
select ok(
  not public.has_permission('admin.access'),
  'inactive status removes effective permissions despite role assignment'
);
select is(public.get_session_context(), null, 'an inactive user is denied session context');

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001"}',
  true
);
select is(
  public.get_session_context(),
  '{
    "displayName": "Admin User",
    "roles": [
      {"code": "aaa_contract_test", "name": "First test role"},
      {"code": "admin", "name": "Admin"},
      {"code": "zzz_contract_test", "name": "Last test role"}
    ],
    "permissions": [
      "admin.access", "audit.read", "eggs.collection.create", "eggs.collection.read", "farm.setup.read", "flocks.create", "flocks.mortality.create", "flocks.read", "roles.manage",
      "roles.read", "users.manage", "users.read"
    ]
  }'::jsonb,
  'session JSON is exact, deduplicated, and sorted by code'
);

select * from finish();
rollback;
