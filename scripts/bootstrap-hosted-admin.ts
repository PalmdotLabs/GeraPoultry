import { createClient } from '@supabase/supabase-js';

process.loadEnvFile('apps/web/.env.local');

const environment = process.env.SUPABASE_ENVIRONMENT;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const publishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const email = process.env.HOSTED_ADMIN_EMAIL;
const password = process.env.HOSTED_ADMIN_PASSWORD;
const displayName =
  process.env.HOSTED_ADMIN_DISPLAY_NAME ?? 'Development Administrator';

if (environment !== 'development') {
  throw new Error(
    'SUPABASE_ENVIRONMENT must be development for administrator bootstrap.',
  );
}
if (!url || !serviceRoleKey || !publishableKey) {
  throw new Error(
    'Hosted public configuration and SUPABASE_SERVICE_ROLE_KEY are required.',
  );
}
if (new URL(url).protocol !== 'https:') {
  throw new Error(
    'Hosted administrator bootstrap requires the hosted HTTPS Supabase URL.',
  );
}
if (!email) {
  throw new Error('Set HOSTED_ADMIN_EMAIL for the development administrator.');
}
if (!password || password.length < 12) {
  throw new Error(
    'Set HOSTED_ADMIN_PASSWORD to a development-only password of at least 12 characters.',
  );
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { data: users, error: listError } = await admin.auth.admin.listUsers({
  page: 1,
  perPage: 1000,
});
if (listError) throw listError;

if (
  users.users.some(
    (candidate) => candidate.email?.toLowerCase() === email.toLowerCase(),
  )
) {
  throw new Error(
    'An account already exists for this email. Review it before assigning administrator access.',
  );
}

const { data: created, error: createError } = await admin.auth.admin.createUser(
  {
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  },
);
if (createError) throw createError;
if (!created.user)
  throw new Error('Supabase Auth did not return the administrator.');

const { data: role, error: roleError } = await admin
  .from('roles')
  .select('id')
  .eq('code', 'admin')
  .single();
if (roleError) throw roleError;

const { error: assignmentError } = await admin.from('user_roles').insert({
  user_id: created.user.id,
  role_id: role.id,
  assigned_by: null,
});
if (assignmentError) throw assignmentError;

const user = createClient(url, publishableKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { data: signedIn, error: signInError } =
  await user.auth.signInWithPassword({ email, password });
if (signInError) throw signInError;
if (!signedIn.session)
  throw new Error('The administrator did not receive a session.');

const { data: context, error: contextError } = await user.rpc(
  'get_session_context',
);
if (contextError) throw contextError;
const permissions = (context as { permissions?: unknown } | null)?.permissions;
const roles = (context as { roles?: unknown } | null)?.roles;
if (!Array.isArray(permissions) || !permissions.includes('admin.access')) {
  throw new Error(
    'Hosted administrator bootstrap did not return admin.access.',
  );
}
if (
  !Array.isArray(roles) ||
  !roles.some(
    (candidate) =>
      typeof candidate === 'object' &&
      candidate !== null &&
      'code' in candidate &&
      candidate.code === 'admin',
  )
) {
  throw new Error(
    'Hosted administrator bootstrap did not return the admin role.',
  );
}

console.log(
  'Hosted development administrator created and verified with admin.access.',
);
