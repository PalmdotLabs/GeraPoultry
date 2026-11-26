begin;
select plan(11);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_user_meta_data
) values
  ('40000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'admin-a@example.test', 'not-a-real-password', now(), now(), now(),
   '{"display_name":"Admin A"}'::jsonb),
  ('40000000-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'admin-b@example.test', 'not-a-real-password', now(), now(), now(),
   '{"display_name":"Admin B"}'::jsonb),
  ('40000000-0000-0000-0000-000000000003',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'third-admin@example.test', 'not-a-real-password', now(), now(), now(),
   '{"display_name":"Third Admin"}'::jsonb),
  ('40000000-0000-0000-0000-000000000004',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'unreferenced@example.test', 'not-a-real-password', now(), now(), now(),
   '{"display_name":"Unreferenced User"}'::jsonb);

insert into public.user_roles (user_id, role_id)
select user_id, (select id from public.roles where code = 'admin')
from (values
  ('40000000-0000-0000-0000-000000000001'::uuid),
  ('40000000-0000-0000-0000-000000000002'::uuid)
) users(user_id);

select throws_ok(
  $$delete from public.user_roles
    where user_id in (
      '40000000-0000-0000-0000-000000000001',
      '40000000-0000-0000-0000-000000000002'
    )$$,
  'P0001',
  'Cannot remove the final active administrator''s admin role.',
  'one multi-row statement cannot remove every active admin'
);
select is(
  (select count(*) from public.user_roles
   where user_id in (
     '40000000-0000-0000-0000-000000000001',
     '40000000-0000-0000-0000-000000000002'
   )),
  2::bigint,
  'the rejected multi-row removal leaves both assignments unchanged'
);
select throws_ok(
  $$update public.profiles set is_active = false
    where id in (
      '40000000-0000-0000-0000-000000000001',
      '40000000-0000-0000-0000-000000000002'
    )$$,
  'P0001',
  'Cannot deactivate or delete the final active administrator.',
  'one multi-row statement cannot deactivate every active admin'
);
select is(
  (select count(*) from public.profiles
   where is_active and id in (
     '40000000-0000-0000-0000-000000000001',
     '40000000-0000-0000-0000-000000000002'
   )),
  2::bigint,
  'the rejected multi-row deactivation leaves both admins active'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"40000000-0000-0000-0000-000000000001"}',
  true
);
select lives_ok(
  $$insert into public.user_roles (user_id, role_id, assigned_by, assigned_at)
    select '40000000-0000-0000-0000-000000000003', r.id,
      '40000000-0000-0000-0000-000000000002', '2000-01-01 00:00:00+00'
    from public.roles r where r.code = 'admin'$$,
  'an authenticated users.manage caller can add a second successor admin'
);
select is(
  (select assigned_by from public.user_roles
   where user_id = '40000000-0000-0000-0000-000000000003'),
  '40000000-0000-0000-0000-000000000001'::uuid,
  'client-forged assigned_by is overwritten with the authenticated actor'
);
select ok(
  (select assigned_at > '2000-01-01 00:00:00+00'::timestamptz
   from public.user_roles
   where user_id = '40000000-0000-0000-0000-000000000003'),
  'client-forged assigned_at is overwritten with database time'
);
select is(
  (select metadata -> 'new' ->> 'assigned_by'
   from public.audit_events
   where target_type = 'user_roles'
   order by id desc limit 1),
  '40000000-0000-0000-0000-000000000001',
  'audit metadata records the corrected provenance rather than forged values'
);

reset role;
select throws_ok(
  $$delete from auth.users
    where id = '40000000-0000-0000-0000-000000000001'$$,
  '23503',
  null,
  'an actor with audit/provenance history cannot be implicitly erased'
);
select lives_ok(
  $$delete from auth.users
    where id = '40000000-0000-0000-0000-000000000004'$$,
  'an unreferenced non-admin user can still be deleted'
);
select is(
  (select count(*) from auth.users
   where id = '40000000-0000-0000-0000-000000000004'),
  0::bigint,
  'the unreferenced user deletion completes'
);

select * from finish();
rollback;
