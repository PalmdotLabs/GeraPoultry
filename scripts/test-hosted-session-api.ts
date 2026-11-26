import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { ApiClientError, createApiClient } from '@poultry/api-client';
import { assertLoopbackHttpUrl } from './local-supabase';

process.loadEnvFile('apps/web/.env.local');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const email = process.env.HOSTED_ADMIN_EMAIL;
const password = process.env.HOSTED_ADMIN_PASSWORD;
const webBaseUrl = assertLoopbackHttpUrl(
  process.env.WEB_BASE_URL ?? 'http://localhost:3000',
  'WEB_BASE_URL',
);

if (process.env.SUPABASE_ENVIRONMENT !== 'development') {
  throw new Error(
    'Hosted session checks require SUPABASE_ENVIRONMENT=development.',
  );
}
if (!supabaseUrl || !publishableKey || !email || !password) {
  throw new Error(
    'Hosted public configuration and development administrator credentials are required.',
  );
}
if (new URL(supabaseUrl).protocol !== 'https:') {
  throw new Error(
    'Hosted session checks require the hosted HTTPS Supabase URL.',
  );
}

const settingsResponse = await fetch(`${supabaseUrl}/auth/v1/settings`, {
  headers: {
    apikey: publishableKey,
    Authorization: `Bearer ${publishableKey}`,
  },
});
if (!settingsResponse.ok)
  throw new Error('Hosted Auth settings could not be checked.');
const settings = await settingsResponse.json();
if (settings.disable_signup !== true) {
  throw new Error(
    'Hosted public signup must be disabled before acceptance verification.',
  );
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
  getAccessToken: () => 'not-a-valid-hosted-access-token',
});
await expectClientError(
  malformed.getSession({ signal: AbortSignal.timeout(10_000) }),
  401,
  'UNAUTHENTICATED',
);

const auth = createClient(supabaseUrl, publishableKey, {
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
  process.env.HOSTED_ADMIN_DISPLAY_NAME ?? 'Development Administrator',
);
assert.equal(session.roles.length, 1);
assert.equal(session.roles[0]?.code, 'admin');
assert.deepEqual(session.permissions, [
  'admin.access',
  'audit.read',
  'roles.manage',
  'roles.read',
  'users.manage',
  'users.read',
]);

console.log(
  'Hosted session API verified: signup disabled, anonymous denial, invalid-token denial, and administrator bearer access.',
);
