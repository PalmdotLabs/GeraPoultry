import { createClient } from '@supabase/supabase-js';
import { getLocalSupabaseStatus } from './local-supabase';

const email = process.env.LOCAL_ADMIN_EMAIL ?? 'admin@poultry.local';
const password = process.env.LOCAL_ADMIN_PASSWORD;
const displayName =
  process.env.LOCAL_ADMIN_DISPLAY_NAME ?? 'Local Administrator';

if (!password || password.length < 12) {
  throw new Error(
    'Set LOCAL_ADMIN_PASSWORD to a local-only password of at least 12 characters.',
  );
}

const status = getLocalSupabaseStatus();
const url = status.API_URL!;
const anonKey = status.ANON_KEY;
const serviceRoleKey = status.SERVICE_ROLE_KEY;

if (!anonKey || !serviceRoleKey) {
  throw new Error(
    'Local Supabase keys are unavailable. Start local Supabase first.',
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

let user = users.users.find(
  (candidate) => candidate.email?.toLowerCase() === email.toLowerCase(),
);
if (user) {
  throw new Error(
    `A user already exists for ${email}. Use a clean local reset before bootstrapping.`,
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
  throw new Error('Supabase Auth did not return the created administrator.');
user = created.user;

const { data: role, error: roleError } = await admin
  .from('roles')
  .select('id')
  .eq('code', 'admin')
  .single();
if (roleError) throw roleError;

const { error: assignmentError } = await admin.from('user_roles').insert({
  user_id: user.id,
  role_id: role.id,
  assigned_by: null,
});
if (assignmentError) throw assignmentError;

const userClient = createClient(url, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { data: signedIn, error: signInError } =
  await userClient.auth.signInWithPassword({
    email,
    password,
  });
if (signInError) throw signInError;
if (!signedIn.session)
  throw new Error('Local administrator did not receive a session.');

const { data: context, error: contextError } = await userClient.rpc(
  'get_session_context',
);
if (contextError) throw contextError;
const permissions = (context as { permissions?: unknown } | null)?.permissions;
if (!Array.isArray(permissions) || !permissions.includes('admin.access')) {
  throw new Error('Bootstrap verification did not return admin.access.');
}

console.log(`Local administrator ready: ${email} (${user.id})`);
