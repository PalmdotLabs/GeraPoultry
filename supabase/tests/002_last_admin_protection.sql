begin;
select plan(16);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_user_meta_data
) values
  (
    '30000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000', 'authenticated',
    'authenticated', 'first-admin@example.test', 'not-a-real-password',
    now(), now(), now(), '{"display_name":"First Admin"}'::jsonb
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000', 'authenticated',
    'authenticated', 'second-admin@example.test', 'not-a-real-password',
    now(), now(), now(), '{"display_name":"Second Admin"}'::jsonb
  );

insert into public.user_roles (user_id, role_id, assigned_by)
select '30000000-0000-0000-0000-000000000001', id,
  '30000000-0000-0000-0000-000000000001'
from public.roles where code = 'admin';

select throws_ok(
  $$delete from public.user_roles
    where user_id = '30000000-0000-0000-0000-000000000001'$$,
  'P0001',
  'Cannot remove the final active administrator''s admin role.',
  'the only active admin role assignment cannot be deleted'
);
select throws_ok(
  $$update public.profiles set is_active = false
    where id = '30000000-0000-0000-0000-000000000001'$$,
  'P0001',
  'Cannot deactivate or delete the final active administrator.',
  'the only active admin cannot be deactivated'
);
select throws_ok(
  $$delete from public.profiles
    where id = '30000000-0000-0000-0000-000000000001'$$,
  'P0001',
  'Cannot deactivate or delete the final active administrator.',
  'the only active admin profile cannot be deleted'
);

select lives_ok(
  $$insert into public.user_roles (user_id, role_id, assigned_by)
    select '30000000-0000-0000-0000-000000000002', id,
      '30000000-0000-0000-0000-000000000001'
    from public.roles where code = 'admin'$$,
  'a second active admin can be assigned'
);
select lives_ok(
  $$delete from public.user_roles
    where user_id = '30000000-0000-0000-0000-000000000001'$$,
  'the first admin role can be removed while a second admin remains active'
);
select results_eq(
  $$select action, target_type, metadata -> 'old' ->> 'user_id'
    from public.audit_events
    where target_type = 'user_roles'
    order by id desc limit 1$$,
  $$values (
    'user_roles.delete', 'user_roles',
    '30000000-0000-0000-0000-000000000001'
  )$$,
  'an allowed admin role removal is still audited'
);

select lives_ok(
  $$insert into public.user_roles (user_id, role_id, assigned_by)
    select '30000000-0000-0000-0000-000000000001', id,
      '30000000-0000-0000-0000-000000000002'
    from public.roles where code = 'admin'$$,
  'the first admin can be restored while another admin is active'
);
select lives_ok(
  $$update public.profiles set is_active = false
    where id = '30000000-0000-0000-0000-000000000001'$$,
  'a non-final active admin can be deactivated'
);
select throws_ok(
  $$update public.profiles set is_active = false
    where id = '30000000-0000-0000-0000-000000000002'$$,
  'P0001',
  'Cannot deactivate or delete the final active administrator.',
  'inactive admins do not satisfy the final-active-admin invariant'
);
select throws_ok(
  $$delete from public.user_roles
    where user_id = '30000000-0000-0000-0000-000000000002'$$,
  'P0001',
  'Cannot remove the final active administrator''s admin role.',
  'the final active assignment cannot be removed beside an inactive admin'
);

select throws_ok(
  $$delete from public.roles where code = 'admin'$$,
  'P0001',
  'The system admin role cannot be deleted or narrowed.',
  'the authoritative admin role cannot be deleted'
);
select throws_ok(
  $$update public.roles set is_system = false where code = 'admin'$$,
  'P0001',
  'The system admin role cannot be deleted or narrowed.',
  'the authoritative admin role cannot lose system status'
);
select throws_ok(
  $$delete from public.role_permissions rp
    using public.roles r, public.permissions p
    where rp.role_id = r.id and rp.permission_id = p.id
      and r.code = 'admin' and p.code = 'admin.access'$$,
  'P0001',
  'The admin role''s admin.access grant cannot be removed or changed.',
  'the authoritative admin.access grant cannot be deleted'
);
select throws_ok(
  $$delete from public.permissions where code = 'admin.access'$$,
  'P0001',
  'The admin.access permission cannot be deleted or renamed.',
  'deleting admin.access cannot cascade-remove the authoritative grant'
);
select throws_ok(
  $$update public.role_permissions rp
    set permission_id = (select id from public.permissions where code = 'users.read')
    from public.roles r, public.permissions p
    where rp.role_id = r.id and rp.permission_id = p.id
      and r.code = 'admin' and p.code = 'admin.access'$$,
  'P0001',
  'The admin role''s admin.access grant cannot be removed or changed.',
  'the authoritative grant cannot be narrowed through an update'
);
select is(
  (select count(*) from public.audit_events where target_type = 'user_roles'),
  4::bigint,
  'rejected changes create no audit rows and successful assignments remain audited'
);

select * from finish();
rollback;
