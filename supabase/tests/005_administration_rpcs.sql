begin;
select plan(81);

create temp table admin_test_ids (
  key text primary key,
  id uuid not null unique
) on commit drop;

create temp table admin_test_state (
  key text primary key,
  value timestamptz not null
) on commit drop;

grant select, insert, update, delete on admin_test_ids, admin_test_state to authenticated;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_user_meta_data
) values
  ('60000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'rpc-admin@example.test', 'not-a-real-password', now(), now(), now(),
   '{"display_name":"RPC Admin"}'::jsonb),
  ('60000000-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'rpc-backup@example.test', 'not-a-real-password', now(), now(), now(),
   '{"display_name":"RPC Backup"}'::jsonb),
  ('60000000-0000-0000-0000-000000000003',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'rpc-no-role@example.test', 'not-a-real-password', now(), now(), now(),
   '{"display_name":"RPC No Role"}'::jsonb),
  ('60000000-0000-0000-0000-000000000004',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'rpc-inactive@example.test', 'not-a-real-password', now(), now(), now(),
   '{"display_name":"RPC Inactive"}'::jsonb),
  ('60000000-0000-0000-0000-000000000005',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'rpc-target@example.test', 'not-a-real-password', now(), now(), now(),
   '{"display_name":"RPC Target"}'::jsonb);

update auth.users set invited_at = now()
where id = '60000000-0000-0000-0000-000000000005';

insert into admin_test_ids (key, id) values
  ('admin', '60000000-0000-0000-0000-000000000001'),
  ('backup', '60000000-0000-0000-0000-000000000002'),
  ('no_role', '60000000-0000-0000-0000-000000000003'),
  ('inactive', '60000000-0000-0000-0000-000000000004'),
  ('target', '60000000-0000-0000-0000-000000000005');

insert into public.user_roles (user_id, role_id)
select id, (select id from public.roles where code = 'admin')
from public.profiles
where id in (
  '60000000-0000-0000-0000-000000000001',
  '60000000-0000-0000-0000-000000000002',
  '60000000-0000-0000-0000-000000000004'
);
update public.profiles set is_active = false
where id = '60000000-0000-0000-0000-000000000004';

select ok(
  (select bool_and(has_function_privilege('authenticated', name, 'EXECUTE'))
   from (values
     ('public.admin_record_user_invite(uuid,text,uuid)'),
     ('public.admin_set_user_active(uuid,boolean)'),
     ('public.admin_set_user_roles(uuid,uuid[])'),
     ('public.admin_upsert_role(uuid,text,text,text,uuid[])'),
     ('public.admin_delete_role(uuid)')
   ) functions(name)),
  'authenticated can execute exactly the five administration RPC entry points'
);
select ok(
  (select not bool_or(has_function_privilege('anon', name, 'EXECUTE'))
   from (values
     ('public.admin_record_user_invite(uuid,text,uuid)'),
     ('public.admin_set_user_active(uuid,boolean)'),
     ('public.admin_set_user_roles(uuid,uuid[])'),
     ('public.admin_upsert_role(uuid,text,text,text,uuid[])'),
     ('public.admin_delete_role(uuid)')
   ) functions(name)),
  'anonymous callers have no administration RPC execution grants'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-000000000003"}', true
);
select throws_ok(
  $$select public.admin_record_user_invite(
    '60000000-0000-0000-0000-000000000005', 'rpc-target@example.test',
    '70000000-0000-0000-0000-000000000001')$$,
  '42501', null, 'invite requires users.manage'
);
select throws_ok(
  $$select public.admin_set_user_active(
    '60000000-0000-0000-0000-000000000005', false)$$,
  '42501', null, 'activation requires users.manage'
);
select throws_ok(
  $$select public.admin_set_user_roles(
    '60000000-0000-0000-0000-000000000005', '{}'::uuid[])$$,
  '42501', null, 'role assignment requires users.manage'
);
select throws_ok(
  $$select public.admin_upsert_role(
    null, 'denied_test', 'Denied', '', '{}'::uuid[])$$,
  '42501', null, 'role upsert requires roles.manage'
);
select throws_ok(
  $$select public.admin_delete_role(
    (select id from public.roles where code = 'admin'))$$,
  '42501', null, 'role deletion requires roles.manage'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-000000000004"}', true
);
select throws_ok(
  $$select public.admin_set_user_active(
    '60000000-0000-0000-0000-000000000005', false)$$,
  '42501', null, 'an inactive administrator has no mutation permission'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-000000000001"}', true
);
select lives_ok(
  $$select public.admin_record_user_invite(
    '60000000-0000-0000-0000-000000000005', 'RPC-TARGET@example.test',
    '70000000-0000-0000-0000-000000000001')$$,
  'an administrator can record a verified invitation with case-insensitive email matching'
);
select results_eq(
  $$select action, target_type, target_id, actor_id, request_id,
      metadata ->> 'email'
    from public.audit_events where action = 'user.invited'$$,
  $$values (
    'user.invited', 'user', '60000000-0000-0000-0000-000000000005',
    '60000000-0000-0000-0000-000000000001'::uuid,
    '70000000-0000-0000-0000-000000000001'::uuid,
    'rpc-target@example.test'
  )$$,
  'invite audit preserves actor, target, request UUID, and verified email attribution'
);
select throws_ok(
  $$select public.admin_record_user_invite(
    '60000000-0000-0000-0000-000000000005', 'rpc-target@example.test',
    '70000000-0000-0000-0000-000000000001')$$,
  'P0409', null, 'an exact invitation replay is a controlled conflict'
);
select throws_ok(
  $$select public.admin_record_user_invite(
    '60000000-0000-0000-0000-000000000005', 'rpc-target@example.test',
    '70000000-0000-0000-0000-000000000004')$$,
  'P0409', null, 'the same target cannot be invited under a different request UUID'
);
select is(
  (select count(*) from public.audit_events
   where action = 'user.invited'
     and target_id = '60000000-0000-0000-0000-000000000005'),
  1::bigint,
  'failed invitation replays append no additional audit rows'
);
select throws_ok(
  $$select public.admin_record_user_invite(
    '60000000-0000-0000-0000-000000000099', 'missing@example.test',
    '70000000-0000-0000-0000-000000000002')$$,
  'P0404', null, 'an unknown invite target is a controlled not-found error'
);
select throws_ok(
  $$select public.admin_record_user_invite(
    '60000000-0000-0000-0000-000000000005', 'wrong@example.test',
    '70000000-0000-0000-0000-000000000003')$$,
  'P0404', null, 'invite rejects an email that does not match the Auth user'
);
select throws_ok(
  $$select public.admin_record_user_invite(
    '60000000-0000-0000-0000-000000000003', 'rpc-no-role@example.test',
    '70000000-0000-0000-0000-000000000005')$$,
  'P0404', null, 'a matching non-invited Auth account cannot be recorded as invited'
);

insert into admin_test_state
select 'target_updated_at', updated_at from public.profiles
where id = '60000000-0000-0000-0000-000000000005';
select lives_ok(
  $$select public.admin_set_user_active(
    '60000000-0000-0000-0000-000000000005', true)$$,
  'activation to the existing state is a successful no-op'
);
select is(
  (select updated_at from public.profiles
   where id = '60000000-0000-0000-0000-000000000005'),
  (select value from admin_test_state where key = 'target_updated_at'),
  'activation no-op does not touch updated_at'
);
select is(
  (select count(*) from public.audit_events
   where target_type = 'profiles'
     and target_id = '60000000-0000-0000-0000-000000000005'),
  0::bigint,
  'activation no-op emits no audit event'
);
select lives_ok(
  $$select public.admin_set_user_active(
    '60000000-0000-0000-0000-000000000005', false)$$,
  'an administrator can deactivate a target profile'
);
select is(
  (select is_active from public.profiles
   where id = '60000000-0000-0000-0000-000000000005'),
  false,
  'deactivation persists the new active state'
);
select results_eq(
  $$select action, actor_id,
      metadata -> 'before' ->> 'is_active',
      metadata -> 'after' ->> 'is_active'
    from public.audit_events
    where target_type = 'profiles'
      and target_id = '60000000-0000-0000-0000-000000000005'
    order by id desc limit 1$$,
  $$values ('profiles.update', '60000000-0000-0000-0000-000000000001'::uuid,
    'true', 'false')$$,
  'activation trigger audits the actual previous and new state with actor attribution'
);
select lives_ok(
  $$select public.admin_set_user_active(
    '60000000-0000-0000-0000-000000000005', true)$$,
  'an inactive target can be reactivated'
);
select is(
  (select metadata -> 'after' ->> 'is_active'
   from public.audit_events
   where target_type = 'profiles'
     and target_id = '60000000-0000-0000-0000-000000000005'
   order by id desc limit 1),
  'true',
  'reactivation records a separate true activation state'
);
select lives_ok(
  $$select public.admin_set_user_active(
    '60000000-0000-0000-0000-000000000002', false)$$,
  'a non-final active administrator can be deactivated through the RPC'
);
select throws_ok(
  $$select public.admin_set_user_active(
    '60000000-0000-0000-0000-000000000001', false)$$,
  'P0001', 'Cannot deactivate or delete the final active administrator.',
  'activation RPC retains the final-active-administrator safeguard'
);
select lives_ok(
  $$select public.admin_set_user_active(
    '60000000-0000-0000-0000-000000000002', true)$$,
  'the backup administrator can be restored after the final-admin assertion'
);

select lives_ok(
  $$insert into admin_test_ids (key, id)
    values ('role_a', public.admin_upsert_role(
      null, 'editor_test', 'Editor Test', 'First description',
      array[(select id from public.permissions where code = 'users.read'),
            (select id from public.permissions where code = 'users.read')]
    ))$$,
  'role creation returns and persists a new role ID'
);
select lives_ok(
  $$insert into admin_test_ids (key, id)
    values ('role_b', public.admin_upsert_role(
      null, 'viewer_test', 'Viewer Test', '', '{}'::uuid[]
    ))$$,
  'role creation accepts an empty permission set'
);
select results_eq(
  $$select code, name, description, is_system from public.roles
    where id = (select id from admin_test_ids where key = 'role_a')$$,
  $$values ('editor_test', 'Editor Test', 'First description', false)$$,
  'created custom roles are non-system and retain their supplied fields'
);
select results_eq(
  $$select p.code from public.role_permissions rp
    join public.permissions p on p.id = rp.permission_id
    where rp.role_id = (select id from admin_test_ids where key = 'role_a')$$,
  $$values ('users.read')$$,
  'duplicate permission IDs are deduplicated during role creation'
);
select results_eq(
  $$select action, actor_id, target_id, metadata -> 'new' ->> 'code'
    from public.audit_events
    where target_type = 'roles'
      and target_id = (select id::text from admin_test_ids where key = 'role_a')$$,
  $$values ('roles.insert', '60000000-0000-0000-0000-000000000001'::uuid,
    (select id::text from admin_test_ids where key = 'role_a'), 'editor_test')$$,
  'role creation emits an attributed roles.insert audit event'
);
select throws_ok(
  $$insert into public.roles (code, name)
    values ('direct_insert_test', 'Direct insert')$$,
  '42501', null, 'direct Data API role insertion is denied'
);
select throws_ok(
  $$update public.roles set name = 'Direct update'
    where id = (select id from admin_test_ids where key = 'role_a')$$,
  '42501', null, 'direct Data API role update is denied'
);
select throws_ok(
  $$select public.admin_upsert_role(
    null, 'editor_test', 'Duplicate', '', '{}'::uuid[])$$,
  '23505', null, 'duplicate role codes expose the unique-constraint SQLSTATE'
);
select throws_ok(
  $$select public.admin_upsert_role(
    null, 'unknown_permission_test', 'Unknown permission', '',
    array['70000000-0000-0000-0000-000000000099'::uuid])$$,
  'P0404', null, 'unknown permission IDs are rejected before role creation'
);
select lives_ok(
  $$select public.admin_upsert_role(
    (select id from admin_test_ids where key = 'role_a'),
    'editor_test', 'Editor Updated', 'Replacement description',
    array[(select id from public.permissions where code = 'roles.read')])$$,
  'role update atomically replaces descriptive fields and permissions'
);
select results_eq(
  $$select code, name, description from public.roles
    where id = (select id from admin_test_ids where key = 'role_a')$$,
  $$values ('editor_test', 'Editor Updated', 'Replacement description')$$,
  'role update preserves code while changing name and description'
);
select results_eq(
  $$select p.code from public.role_permissions rp
    join public.permissions p on p.id = rp.permission_id
    where rp.role_id = (select id from admin_test_ids where key = 'role_a')$$,
  $$values ('roles.read')$$,
  'role permission replacement removes the old set and installs the new set'
);
select is(
  (select action from public.audit_events
   where target_type = 'roles'
     and target_id = (select id::text from admin_test_ids where key = 'role_a')
   order by id desc limit 1),
  'roles.update',
  'role update emits a roles.update audit event'
);
select throws_ok(
  $$select public.admin_upsert_role(
    (select id from admin_test_ids where key = 'role_a'),
    'renamed_test', 'Editor Updated', 'Replacement description', '{}'::uuid[])$$,
  'P0409', null, 'role code cannot change during an update'
);
select throws_ok(
  $$select public.admin_upsert_role(
    (select id from public.roles where code = 'admin'),
    'admin', 'Changed admin', '', '{}'::uuid[])$$,
  'P0409', null, 'the system admin role cannot be edited'
);
select throws_ok(
  $$delete from public.roles where code = 'admin'$$,
  '42501', null, 'direct Data API deletion of the system role is denied'
);
select throws_ok(
  $$select public.admin_delete_role(
    (select id from public.roles where code = 'admin'))$$,
  'P0409', null, 'the system admin role cannot be deleted'
);
select throws_ok(
  $$delete from public.role_permissions rp
    using public.roles r, public.permissions p
    where rp.role_id = r.id and rp.permission_id = p.id
      and r.code = 'admin' and p.code = 'users.manage'$$,
  '42501', null, 'direct revocation of admin.users.manage is denied'
);
select throws_ok(
  $$delete from public.role_permissions rp
    using public.roles r, public.permissions p
    where rp.role_id = r.id and rp.permission_id = p.id
      and r.code = 'admin' and p.code = 'roles.manage'$$,
  '42501', null, 'direct revocation of admin.roles.manage is denied'
);
select throws_ok(
  $$delete from public.role_permissions rp
    using public.roles r, public.permissions p
    where rp.role_id = r.id and rp.permission_id = p.id
      and r.code = 'admin' and p.code = 'roles.read'$$,
  '42501', null, 'direct revocation of admin.roles.read is denied'
);
select throws_ok(
  $$delete from public.role_permissions rp
    using public.roles r, public.permissions p
    where rp.role_id = r.id and rp.permission_id = p.id
      and r.code = 'admin' and p.code = 'audit.read'$$,
  '42501', null, 'direct revocation of admin.audit.read is denied'
);
select throws_ok(
  $$select public.admin_upsert_role(
    '70000000-0000-0000-0000-000000000099', 'missing_test', 'Missing', '',
    '{}'::uuid[])$$,
  'P0404', null, 'updating an unknown role is a controlled not-found error'
);
select throws_ok(
  $$select public.admin_delete_role(
    '70000000-0000-0000-0000-000000000099')$$,
  'P0404', null, 'deleting an unknown role is a controlled not-found error'
);

select lives_ok(
  $$select public.admin_set_user_roles(
    '60000000-0000-0000-0000-000000000005',
    array[(select id from admin_test_ids where key = 'role_a'),
          (select id from admin_test_ids where key = 'role_a')])$$,
  'role assignment accepts and deduplicates role IDs'
);
select results_eq(
  $$select role_id from public.user_roles
    where user_id = '60000000-0000-0000-0000-000000000005'$$,
  $$select id from admin_test_ids where key = 'role_a'$$,
  'duplicate role IDs produce exactly one assignment'
);
select results_eq(
  $$select action, actor_id, metadata -> 'new' ->> 'assigned_by'
    from public.audit_events where target_type = 'user_roles'
      and metadata -> 'new' ->> 'user_id' =
        '60000000-0000-0000-0000-000000000005'
    order by id desc limit 1$$,
  $$values ('user_roles.insert', '60000000-0000-0000-0000-000000000001'::uuid,
    '60000000-0000-0000-0000-000000000001')$$,
  'RPC role assignment preserves trigger actor and assigned_by provenance'
);
select throws_ok(
  $$delete from public.roles
    where id = (select id from admin_test_ids where key = 'role_a')$$,
  '42501', null, 'direct Data API deletion of an assigned role is denied'
);
select throws_ok(
  $$select public.admin_delete_role(
    (select id from admin_test_ids where key = 'role_a'))$$,
  'P0409', null, 'an assigned custom role cannot be deleted'
);
select is(
  (select count(*) from public.roles r
   join public.user_roles ur on ur.role_id = r.id
   where r.id = (select id from admin_test_ids where key = 'role_a')),
  1::bigint,
  'rejected in-use deletion preserves both role and assignment'
);
select lives_ok(
  $$select public.admin_set_user_roles(
    '60000000-0000-0000-0000-000000000005', '{}'::uuid[])$$,
  'an empty role array removes every existing assignment'
);
select is(
  (select count(*) from public.user_roles
   where user_id = '60000000-0000-0000-0000-000000000005'),
  0::bigint,
  'empty role replacement leaves no target assignments'
);
select is(
  (select action from public.audit_events
   where target_type = 'user_roles'
     and metadata -> 'old' ->> 'user_id' =
       '60000000-0000-0000-0000-000000000005'
   order by id desc limit 1),
  'user_roles.delete',
  'empty role replacement retains deletion audit history'
);
select lives_ok(
  $$select public.admin_set_user_roles(
    '60000000-0000-0000-0000-000000000005',
    array[(select id from admin_test_ids where key = 'role_a'),
          (select id from admin_test_ids where key = 'role_b')])$$,
  'multiple role assignments can be installed together'
);
select lives_ok(
  $$select public.admin_set_user_roles(
    '60000000-0000-0000-0000-000000000005',
    array[(select id from admin_test_ids where key = 'role_b')])$$,
  'role replacement can remove one role while retaining another'
);
select results_eq(
  $$select role_id from public.user_roles
    where user_id = '60000000-0000-0000-0000-000000000005'$$,
  $$select id from admin_test_ids where key = 'role_b'$$,
  'role replacement persists exactly the requested set'
);
select throws_ok(
  $$select public.admin_set_user_roles(
    '60000000-0000-0000-0000-000000000099', '{}'::uuid[])$$,
  'P0404', null, 'role replacement rejects an unknown target profile'
);
select throws_ok(
  $$select public.admin_set_user_roles(
    '60000000-0000-0000-0000-000000000005',
    array['70000000-0000-0000-0000-000000000099'::uuid])$$,
  'P0404', null, 'role replacement rejects an unknown role ID'
);
select throws_ok(
  $$select public.admin_set_user_roles(
    '60000000-0000-0000-0000-000000000005', array[null::uuid])$$,
  '22023', null, 'role replacement rejects null array elements'
);
select throws_ok(
  $$select public.admin_delete_role(
    (select id from admin_test_ids where key = 'role_b'))$$,
  'P0409', null, 'in-use protection also covers the retained replacement role'
);
select lives_ok(
  $$select public.admin_set_user_roles(
    '60000000-0000-0000-0000-000000000005', '{}'::uuid[])$$,
  'clearing the target roles makes custom role deletion safe'
);
select lives_ok(
  $$select public.admin_delete_role(
    (select id from admin_test_ids where key = 'role_a'))$$,
  'an unused custom role can be deleted'
);
select results_eq(
  $$select action, actor_id, metadata -> 'old' ->> 'code'
    from public.audit_events
    where target_type = 'roles'
      and target_id = (select id::text from admin_test_ids where key = 'role_a')
      and action = 'roles.delete'$$,
  $$values ('roles.delete', '60000000-0000-0000-0000-000000000001'::uuid,
    'editor_test')$$,
  'role deletion retains its final attributed roles.delete audit event'
);
select lives_ok(
  $$select public.admin_delete_role(
    (select id from admin_test_ids where key = 'role_b'))$$,
  'a second unused custom role can be deleted'
);
select is(
  (select count(*) from public.roles where code in ('editor_test', 'viewer_test')),
  0::bigint,
  'test role cleanup leaves no custom business roles behind'
);

select lives_ok(
  $$select public.admin_set_user_roles(
    '60000000-0000-0000-0000-000000000002', '{}'::uuid[])$$,
  'a non-final administrator assignment can be removed through the RPC'
);
select throws_ok(
  $$select public.admin_set_user_roles(
    '60000000-0000-0000-0000-000000000001', '{}'::uuid[])$$,
  'P0001', 'Cannot remove the final active administrator''s admin role.',
  'role replacement retains the final-active-administrator assignment safeguard'
);
select lives_ok(
  $$select public.admin_set_user_roles(
    '60000000-0000-0000-0000-000000000002',
    array[(select id from public.roles where code = 'admin')])$$,
  'the backup administrator assignment can be restored'
);
select is(
  (select assigned_by from public.user_roles
   where user_id = '60000000-0000-0000-0000-000000000002'),
  '60000000-0000-0000-0000-000000000001'::uuid,
  'restored admin provenance is stamped from auth.uid rather than client input'
);

reset role;
select throws_ok(
  $$update public.profiles set is_active = false
    where id in (
      '60000000-0000-0000-0000-000000000001',
      '60000000-0000-0000-0000-000000000002')$$,
  'P0001', 'Cannot deactivate or delete the final active administrator.',
  'multi-row deactivation still cannot remove every active administrator'
);
select is(
  (select count(*) from public.profiles
   where is_active and id in (
     '60000000-0000-0000-0000-000000000001',
     '60000000-0000-0000-0000-000000000002')),
  2::bigint,
  'rejected multi-row deactivation leaves both administrators active'
);
select throws_ok(
  $$delete from public.user_roles where user_id in (
    '60000000-0000-0000-0000-000000000001',
    '60000000-0000-0000-0000-000000000002')$$,
  'P0001', 'Cannot remove the final active administrator''s admin role.',
  'multi-row deletion still cannot remove every active admin assignment'
);
select is(
  (select count(*) from public.user_roles where user_id in (
    '60000000-0000-0000-0000-000000000001',
    '60000000-0000-0000-0000-000000000002')),
  2::bigint,
  'rejected multi-row deletion leaves both admin assignments intact'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-000000000001"}', true
);
select throws_ok(
  $$update public.audit_events set metadata = '{}'::jsonb
    where action in ('user.invited', 'profiles.update', 'roles.insert',
      'roles.update', 'roles.delete')$$,
  '42501', null, 'new administration audit events cannot be modified by an administrator'
);
select throws_ok(
  $$delete from public.audit_events
    where action in ('user.invited', 'profiles.update', 'roles.insert',
      'roles.update', 'roles.delete')$$,
  '42501', null, 'new administration audit events cannot be deleted by an administrator'
);

select * from finish();
rollback;
