import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiClientError, createApiClient } from '@poultry/api-client';
import {
  AuthApiError,
  AuthRetryableFetchError,
  AuthSessionMissingError,
  createClient,
} from '@supabase/supabase-js';
import {
  allowsAutomaticSessionValidation,
  AuthOperationCoordinator,
  classifyAuthSessionError,
  restoreSessionWithCleanupBarrier,
  signOutLocally,
  signOutWithLogoutCleanupBarrier,
  validateEmployeeSession,
  type AutomaticValidationState,
  type LocalSignOutAuth,
} from '../src/auth/employee-session';
import { createSecureSessionStorage } from '../src/auth/secure-session-storage';

const requestId = 'f67eb1a1-df3f-49db-a14d-0ed5fbb550a8';

const sessionEnvelope = {
  data: {
    user: {
      id: 'cb0c3f8c-e4d4-4941-aa5d-d1b9b127d64a',
      email: 'employee@example.com',
      displayName: 'Actual Employee',
    },
    roles: [],
    permissions: [],
  },
};

test('an active employee with no roles or permissions is verified', async () => {
  const client = createApiClient({
    baseUrl: 'http://api.test',
    getAccessToken: async () => 'fixture-access-token',
    fetch: async () => Response.json(sessionEnvelope),
  });
  const result = await validateEmployeeSession(client);
  assert.equal(result.kind, 'verified');
  if (result.kind === 'verified') {
    assert.equal(result.account.user.displayName, 'Actual Employee');
    assert.deepEqual(result.account.roles, []);
    assert.deepEqual(result.account.permissions, []);
  }
});

test('an inactive or missing profile returns the inactive decision', async () => {
  const client = createApiClient({
    fetch: async () =>
      Response.json(
        {
          error: {
            code: 'FORBIDDEN',
            message: 'This account does not have an active profile.',
            requestId,
          },
        },
        { status: 403 },
      ),
  });
  assert.deepEqual(await validateEmployeeSession(client), { kind: 'inactive' });
});

test('network and invalid response decisions stay retryable', async () => {
  const networkClient = createApiClient({
    fetch: async () => {
      throw new Error('private transport details');
    },
  });
  const invalidClient = createApiClient({
    fetch: async () => Response.json({ data: { unexpected: true } }),
  });
  assert.deepEqual(await validateEmployeeSession(networkClient), {
    kind: 'retryable',
  });
  assert.deepEqual(await validateEmployeeSession(invalidClient), {
    kind: 'retryable',
  });
});

test('an async token provider failure remains a typed safe API error and prevents fetch', async () => {
  let fetched = false;
  const client = createApiClient({
    getAccessToken: async () => {
      throw new Error('raw JWT and refresh token must not escape');
    },
    fetch: async () => {
      fetched = true;
      return Response.json(sessionEnvelope);
    },
  });

  await assert.rejects(client.getSession(), (error: unknown) => {
    assert.ok(error instanceof ApiClientError);
    assert.equal(error.code, 'NETWORK_ERROR');
    assert.equal(error.message, 'The request could not be completed.');
    assert.equal(error.message.includes('JWT'), false);
    assert.equal(error.message.includes('refresh token'), false);
    return true;
  });
  assert.equal(fetched, false);
});

test('revocation failure uses local scope and clears the protected adapter value', async () => {
  let cleanupCount = 0;
  let requestedScope: string | null = null;
  const auth: LocalSignOutAuth = {
    signOut: async ({ scope }) => {
      requestedScope = scope;
      return { error: new Error('sensitive provider detail') };
    },
  };
  const result = await signOutLocally(auth, async () => {
    cleanupCount += 1;
  });
  assert.equal(requestedScope, 'local');
  assert.equal(cleanupCount, 1);
  assert.equal(result.cleared, true);
  assert.equal(result.warning?.includes('sensitive provider detail'), false);
});

test('a rejected local signout still attempts protected cleanup', async () => {
  let cleanupCount = 0;
  const auth: LocalSignOutAuth = {
    signOut: async () => {
      throw new Error('provider rejected local operation');
    },
  };
  const result = await signOutLocally(auth, async () => {
    cleanupCount += 1;
  });
  assert.equal(cleanupCount, 1);
  assert.equal(result.cleared, true);
});

test('cleanup failure is not reported as a secure successful signout', async () => {
  const result = await signOutLocally(
    { signOut: async () => ({ error: new Error('failure') }) },
    async () => {
      throw new Error('protected storage failure');
    },
  );
  assert.equal(result.cleared, false);
  assert.match(result.warning ?? '', /could not be fully cleared/);
});

test('retryable Supabase refresh failures never classify retained sessions as rejected', () => {
  assert.equal(
    classifyAuthSessionError(new AuthRetryableFetchError('offline', 0)),
    'retryable',
  );
  assert.equal(
    classifyAuthSessionError(new AuthRetryableFetchError('unavailable', 503)),
    'retryable',
  );
  assert.equal(
    classifyAuthSessionError(new Error('storage read failed')),
    'retryable',
  );
  assert.equal(
    classifyAuthSessionError(
      new AuthApiError('service unavailable', 503, undefined),
    ),
    'retryable',
  );
  assert.equal(
    classifyAuthSessionError(
      new AuthApiError('too many requests', 429, undefined),
    ),
    'retryable',
  );
});

test('only explicit session rejection or a genuinely absent session clears authentication', () => {
  assert.equal(
    classifyAuthSessionError(new AuthApiError('invalid token', 401, 'bad_jwt')),
    'rejected',
  );
  assert.equal(
    classifyAuthSessionError(
      new AuthApiError('refresh token missing', 400, 'refresh_token_not_found'),
    ),
    'rejected',
  );
  assert.equal(
    classifyAuthSessionError(new AuthSessionMissingError()),
    'absent',
  );
});

test('cleanup failure and every non-authenticated state block foreground and token restoration', () => {
  const blockedStates: AutomaticValidationState[] = [
    'configurationError',
    'restoring',
    'signedOut',
    'validating',
    'validationError',
    'inactive',
    'signingOut',
    'cleanupFailed',
  ];
  for (const status of blockedStates) {
    assert.equal(allowsAutomaticSessionValidation(status), false, status);
  }
  assert.equal(allowsAutomaticSessionValidation('authenticated'), true);
});

test('starting local signout invalidates validation and prevents duplicate cleanup', () => {
  const operations = new AuthOperationCoordinator();
  const validation = operations.begin();
  const signout = operations.claimExclusive('cleanup');
  assert.ok(signout !== null);
  assert.equal(operations.isCurrent(validation), false);
  assert.equal(operations.claimExclusive('sign-in'), null);
  assert.equal(operations.claimExclusive('cleanup'), null);

  operations.finishExclusive(signout, 'cleanup');
  assert.ok(operations.claimExclusive('sign-in') !== null);
});

test('a late rejected cleanup cannot clear or release a newer sign-in operation', async () => {
  const operations = new AuthOperationCoordinator();
  const rejectedCleanup = operations.claimExclusive('cleanup');
  assert.ok(rejectedCleanup !== null);
  let clearAttempts = 0;

  const deferredSignOut = Promise.withResolvers<{ error: unknown }>();
  const pendingCleanup = signOutLocally(
    {
      signOut: () => deferredSignOut.promise,
    },
    async () => {
      clearAttempts += 1;
    },
    () => operations.isCurrent(rejectedCleanup),
  );

  operations.invalidate();
  const newSignIn = operations.claimExclusive('sign-in');
  assert.ok(newSignIn !== null);
  deferredSignOut.reject(new Error('private signout failure'));

  const result = await pendingCleanup;
  assert.equal(result.cleared, false);
  assert.equal(result.warning, null);
  assert.equal(clearAttempts, 0);
  assert.equal(operations.isCurrent(newSignIn), true);

  operations.finishExclusive(rejectedCleanup, 'cleanup');
  assert.equal(operations.hasExclusiveOperation(), true);
  assert.equal(operations.claimExclusive('sign-in'), null);
  operations.finishExclusive(newSignIn, 'sign-in');
  assert.equal(operations.hasExclusiveOperation(), false);
});

test('a late successful auth signout also loses ownership without clearing newer credentials', async () => {
  const operations = new AuthOperationCoordinator();
  const oldCleanup = operations.claimExclusive('cleanup');
  assert.ok(oldCleanup !== null);
  let clearAttempts = 0;
  const deferredSignOut = Promise.withResolvers<{ error: unknown }>();

  const pendingCleanup = signOutLocally(
    { signOut: () => deferredSignOut.promise },
    async () => {
      clearAttempts += 1;
    },
    () => operations.isCurrent(oldCleanup),
  );

  operations.invalidate();
  const newSignIn = operations.claimExclusive('sign-in');
  assert.ok(newSignIn !== null);
  deferredSignOut.resolve({ error: null });

  assert.deepEqual(await pendingCleanup, { cleared: false, warning: null });
  assert.equal(clearAttempts, 0);
  assert.equal(operations.isCurrent(newSignIn), true);
  operations.finishExclusive(oldCleanup, 'cleanup');
  assert.equal(operations.hasExclusiveOperation(), true);
  operations.finishExclusive(newSignIn, 'sign-in');
});

test('unmount makes all old cleanup ownership stale without affecting a remounted operation', () => {
  const operations = new AuthOperationCoordinator();
  const oldCleanup = operations.claimExclusive('cleanup');
  assert.ok(oldCleanup !== null);
  operations.unmount();
  assert.equal(operations.isCurrent(oldCleanup), false);

  operations.remount();
  const restoredValidation = operations.begin();
  assert.equal(operations.isCurrent(restoredValidation), true);
  assert.equal(operations.isCurrent(oldCleanup), false);
});

test('an intact session cannot restore after restart until protected cleanup and marker finalization finish', async () => {
  const values = new Map<string, string>();
  const storage = createSecureSessionStorage({
    getItemAsync: async (key) => values.get(key) ?? null,
    setItemAsync: async (key, value) => {
      values.set(key, value);
    },
    deleteItemAsync: async (key) => {
      values.delete(key);
    },
  });
  const key = 'poultry-employee-auth';
  const oldSession = JSON.stringify({
    access_token: 'old-session-remains-readable',
  });
  await storage.setItem(key, oldSession);
  await storage.markLogoutCleanupRequired(key);

  let sessionReads = 0;
  const restore = async () => {
    sessionReads += 1;
    return storage.getItem(key);
  };
  const blocked = await restoreSessionWithCleanupBarrier(
    () => storage.getLogoutCleanupRequired(key),
    restore,
  );
  assert.deepEqual(blocked, { kind: 'cleanup-required' });
  assert.equal(sessionReads, 0);
  assert.equal(values.has(`${key}.secure-manifest`), true);

  // Auth/session deletion alone cannot release the independent durable gate.
  await storage.removeItem(key);
  assert.equal(await storage.getLogoutCleanupRequired(key), true);
  const stillBlocked = await restoreSessionWithCleanupBarrier(
    () => storage.getLogoutCleanupRequired(key),
    restore,
  );
  assert.deepEqual(stillBlocked, { kind: 'cleanup-required' });
  assert.equal(sessionReads, 0);

  await storage.clearLogoutCleanupRequired(key);
  const cleared = await restoreSessionWithCleanupBarrier(
    () => storage.getLogoutCleanupRequired(key),
    restore,
  );
  assert.deepEqual(cleared, { kind: 'ready', result: null });
  assert.equal(sessionReads, 1);

  const newSession = JSON.stringify({ access_token: 'new-explicit-session' });
  await storage.setItem(key, newSession);
  const restored = await restoreSessionWithCleanupBarrier(
    () => storage.getLogoutCleanupRequired(key),
    restore,
  );
  assert.deepEqual(restored, { kind: 'ready', result: newSession });
});

test('marker creation failure still performs local Auth rejection and healthy protected cleanup', async () => {
  const values = new Map<string, string>();
  const makeStorage = () =>
    createSecureSessionStorage({
      getItemAsync: async (key) => values.get(key) ?? null,
      setItemAsync: async (key, value) => {
        values.set(key, value);
      },
      deleteItemAsync: async (key) => {
        values.delete(key);
      },
    });
  const key = 'poultry-employee-auth';
  await makeStorage().setItem(
    key,
    JSON.stringify({ access_token: 'stale-session' }),
  );
  let requestedScope: string | null = null;

  const result = await signOutWithLogoutCleanupBarrier(
    {
      signOut: async ({ scope }) => {
        requestedScope = scope;
        return { error: new Error('private Auth failure') };
      },
    },
    () => makeStorage().removeItem(key),
    () => true,
    {
      markLogoutCleanupRequired: async () => {
        throw new Error('marker write unavailable');
      },
      clearLogoutCleanupRequired: async () => {},
    },
  );

  assert.equal(requestedScope, 'local');
  assert.equal(result.cleared, true);
  assert.equal(await makeStorage().getLogoutCleanupRequired(key), false);
  const remounted = await restoreSessionWithCleanupBarrier(
    () => makeStorage().getLogoutCleanupRequired(key),
    () => makeStorage().getItem(key),
  );
  assert.deepEqual(remounted, { kind: 'ready', result: null });
});

test('successful retry clears an older cleanup marker when remaking it fails', async () => {
  const values = new Map<string, string>();
  let markerWritesFail = false;
  const storage = createSecureSessionStorage({
    getItemAsync: async (key) => values.get(key) ?? null,
    setItemAsync: async (key, value) => {
      if (markerWritesFail && key.endsWith('.secure-cleanup-required')) {
        throw new Error('marker rewrite unavailable');
      }
      values.set(key, value);
    },
    deleteItemAsync: async (key) => {
      values.delete(key);
    },
  });
  const key = 'poultry-employee-auth';
  await storage.setItem(key, JSON.stringify({ access_token: 'stale-session' }));
  await storage.markLogoutCleanupRequired(key);
  markerWritesFail = true;

  const result = await signOutWithLogoutCleanupBarrier(
    { signOut: async () => ({ error: new Error('private Auth failure') }) },
    () => storage.removeItem(key),
    () => true,
    {
      markLogoutCleanupRequired: () => storage.markLogoutCleanupRequired(key),
      clearLogoutCleanupRequired: () => storage.clearLogoutCleanupRequired(key),
    },
  );

  assert.equal(result.cleared, true);
  assert.equal(await storage.getLogoutCleanupRequired(key), false);
  assert.equal(await storage.getItem(key), null);
  const restored = await restoreSessionWithCleanupBarrier(
    () => storage.getLogoutCleanupRequired(key),
    () => storage.getItem(key),
  );
  assert.deepEqual(restored, { kind: 'ready', result: null });
});

test('marker creation and protected cleanup failures never become successful signout', async () => {
  const values = new Map<string, string>();
  let failDeletes = false;
  let protectedCleanupAttempts = 0;
  const storage = createSecureSessionStorage({
    getItemAsync: async (key) => values.get(key) ?? null,
    setItemAsync: async (key, value) => {
      values.set(key, value);
    },
    deleteItemAsync: async (key) => {
      if (failDeletes) throw new Error('protected deletion unavailable');
      values.delete(key);
    },
  });
  const key = 'poultry-employee-auth';
  await storage.setItem(
    key,
    JSON.stringify({ access_token: 'must-not-restore' }),
  );
  failDeletes = true;

  const result = await signOutWithLogoutCleanupBarrier(
    { signOut: async () => ({ error: new Error('private Auth failure') }) },
    async () => {
      protectedCleanupAttempts += 1;
      await storage.removeItem(key);
    },
    () => true,
    {
      markLogoutCleanupRequired: async () => {
        throw new Error('marker write unavailable');
      },
      clearLogoutCleanupRequired: async () => {
        throw new Error('must not clear an unwritten marker');
      },
    },
  );

  assert.equal(protectedCleanupAttempts, 1);
  assert.equal(result.cleared, false);
  assert.match(result.warning ?? '', /could not be fully cleared/);
  assert.equal(result.warning?.includes('private Auth failure'), false);
  assert.equal(allowsAutomaticSessionValidation('cleanupFailed'), false);
});

test('real Supabase local logout reads through scoped authority and reaches the local logout route', async () => {
  const values = new Map<string, string>();
  let persistedManifestReads = 0;
  const storage = createSecureSessionStorage({
    getItemAsync: async (key) => {
      if (key.endsWith('.secure-manifest')) persistedManifestReads += 1;
      return values.get(key) ?? null;
    },
    setItemAsync: async (key, value) => {
      values.set(key, value);
    },
    deleteItemAsync: async (key) => {
      values.delete(key);
    },
  });
  const storageKey = 'poultry-employee-auth';
  await storage.setItem(
    storageKey,
    JSON.stringify({
      access_token: 'fixture-access-token',
      refresh_token: 'fixture-refresh-token',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: {
        id: 'cb0c3f8c-e4d4-4941-aa5d-d1b9b127d64a',
        aud: 'authenticated',
        role: 'authenticated',
        email: 'employee@example.com',
        created_at: new Date().toISOString(),
      },
    }),
  );

  const requestedUrls: string[] = [];
  const supabase = createClient(
    'https://supabase.test',
    'fixture-publishable-key',
    {
      auth: {
        storageKey,
        storage,
        persistSession: true,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        fetch: async (input) => {
          requestedUrls.push(
            typeof input === 'string'
              ? input
              : input instanceof URL
                ? input.href
                : input.url,
          );
          return new Response(null, { status: 204 });
        },
      },
    },
  );
  await supabase.auth.getSession();
  await storage.markLogoutCleanupRequired(storageKey);
  persistedManifestReads = 0;
  await assert.rejects(
    storage.getItem(storageKey),
    /logout cleanup is required/,
  );
  persistedManifestReads = 0;

  const result = await signOutWithLogoutCleanupBarrier(
    supabase.auth,
    () => storage.removeItem(storageKey),
    () => true,
    {
      markLogoutCleanupRequired: () =>
        storage.markLogoutCleanupRequired(storageKey),
      clearLogoutCleanupRequired: () =>
        storage.clearLogoutCleanupRequired(storageKey),
      withLogoutCleanupReadAuthority: (operation) =>
        storage.withLogoutCleanupReadAuthority(storageKey, operation),
    },
  );

  assert.deepEqual(result, { cleared: true, warning: null });
  assert.ok(persistedManifestReads > 0);
  assert.ok(
    requestedUrls.some((url) => url.includes('/auth/v1/logout?scope=local')),
  );
  assert.equal(await storage.getLogoutCleanupRequired(storageKey), false);
  assert.equal(await storage.getItem(storageKey), null);
});
