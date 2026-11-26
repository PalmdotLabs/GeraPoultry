import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { ApiClientError, createApiClient } from '@poultry/api-client';
import {
  assertLoopbackHttpUrl,
  getLocalSupabaseStatus,
} from './local-supabase';

const email = process.env.LOCAL_ADMIN_EMAIL ?? 'admin@poultry.local';
const password = process.env.LOCAL_ADMIN_PASSWORD;
const webBaseUrl = assertLoopbackHttpUrl(
  process.env.WEB_BASE_URL ?? 'http://127.0.0.1:3000',
  'WEB_BASE_URL',
);

if (!password) {
  throw new Error('Set LOCAL_ADMIN_PASSWORD to the local bootstrap password.');
}

const status = getLocalSupabaseStatus();
if (!status.API_URL || !status.ANON_KEY) {
  throw new Error('Local Supabase anonymous key is unavailable.');
}

async function expectClientError(
  operation: Promise<unknown>,
  statusCode: number,
  code: string,
): Promise<void> {
  try {
    await operation;
    assert.fail('Expected the session request to fail.');
  } catch (error) {
    assert.ok(error instanceof ApiClientError);
    assert.equal(error.status, statusCode);
    assert.equal(error.code, code);
    assert.ok(error.requestId);
  }
}

const anonymous = createApiClient({ baseUrl: webBaseUrl });
await expectClientError(
  anonymous.getSession({ signal: AbortSignal.timeout(10_000) }),
  401,
  'UNAUTHENTICATED',
);

const malformed = createApiClient({
  baseUrl: webBaseUrl,
  getAccessToken: () => 'not-a-valid-supabase-access-token',
});
await expectClientError(
  malformed.getSession({ signal: AbortSignal.timeout(10_000) }),
  401,
  'UNAUTHENTICATED',
);

const auth = createClient(status.API_URL, status.ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { data, error } = await auth.auth.signInWithPassword({ email, password });
if (error) throw error;
assert.ok(data.session?.access_token);

const authenticated = createApiClient({
  baseUrl: webBaseUrl,
  getAccessToken: () => data.session?.access_token,
});
const session = await authenticated.getSession({
  signal: AbortSignal.timeout(10_000),
});
assert.equal(session.user.email, email);
assert.equal(
  session.user.displayName,
  process.env.LOCAL_ADMIN_DISPLAY_NAME ?? 'Local Administrator',
);
assert.equal(session.roles.length, 1);
assert.equal(session.roles[0]?.code, 'admin');
assert.deepEqual(session.permissions, [
  'admin.access',
  'audit.read',
  'eggs.collection.create',
  'eggs.collection.read',
  'farm.setup.read',
  'flocks.create',
  'flocks.mortality.create',
  'flocks.read',
  'roles.manage',
  'roles.read',
  'users.manage',
  'users.read',
]);

console.log(
  'Live session API verified: anonymous denial, invalid-token denial, and administrator bearer access.',
);
