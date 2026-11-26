import assert from 'node:assert/strict';
import test from 'node:test';
import { createClient } from '@supabase/supabase-js';
import {
  chunkSessionPayload,
  createSecureSessionStorage,
  type SecureKeyValueStore,
} from '../src/auth/secure-session-storage';

class MemorySecureStore implements SecureKeyValueStore {
  readonly values = new Map<string, string>();
  readonly deletedKeys: string[] = [];
  failManifestWrites = false;
  failManifestDeletes = false;
  failCleanupWrites = false;
  failLogoutCleanupWrites = false;
  failLogoutCleanupDeletes = false;
  failedDeleteBank: 'a' | 'b' | null = null;

  async getItemAsync(key: string) {
    return this.values.get(key) ?? null;
  }

  async setItemAsync(key: string, value: string) {
    if (this.failManifestWrites && key.endsWith('.secure-manifest')) {
      throw new Error('simulated protected store failure');
    }
    if (this.failCleanupWrites && key.endsWith('.secure-cleanup')) {
      throw new Error('simulated stale-bank marker write failure');
    }
    if (
      this.failLogoutCleanupWrites &&
      key.endsWith('.secure-cleanup-required')
    ) {
      throw new Error('simulated cleanup marker write failure');
    }
    this.values.set(key, value);
  }

  async deleteItemAsync(key: string) {
    this.deletedKeys.push(key);
    if (this.failManifestDeletes && key.endsWith('.secure-manifest')) {
      throw new Error('simulated manifest delete failure');
    }
    if (
      this.failLogoutCleanupDeletes &&
      key.endsWith('.secure-cleanup-required')
    ) {
      throw new Error('simulated cleanup marker delete failure');
    }
    if (
      this.failedDeleteBank &&
      key.includes(`.secure-${this.failedDeleteBank}-`)
    ) {
      throw new Error('simulated protected delete failure');
    }
    this.values.delete(key);
  }
}

interface PendingDelete {
  key: string;
  resolve: () => void;
  reject: (error: Error) => void;
}

class DeferredDeleteStore extends MemorySecureStore {
  deferDeletes = false;
  readonly pendingDeletes: PendingDelete[] = [];
  writesAfterDeferredRemoval = 0;

  override async setItemAsync(key: string, value: string) {
    if (this.deferDeletes) this.writesAfterDeferredRemoval += 1;
    await super.setItemAsync(key, value);
  }

  override async deleteItemAsync(key: string) {
    if (!this.deferDeletes) return super.deleteItemAsync(key);
    this.deletedKeys.push(key);
    const { promise, resolve, reject } = Promise.withResolvers<void>();
    this.pendingDeletes.push({ key, resolve, reject });
    await promise;
    this.values.delete(key);
  }
}

const key = 'poultry-employee-auth';
const nextTurn = () => {
  const { promise, resolve } = Promise.withResolvers<void>();
  setImmediate(resolve);
  return promise;
};

test('chunking preserves multibyte JSON and enforces the UTF-8 byte ceiling', () => {
  const payload = JSON.stringify({ displayName: 'Employee 🌾 Å'.repeat(500) });
  const chunks = chunkSessionPayload(payload);
  assert.ok(chunks.length > 1);
  assert.equal(chunks.join(''), payload);
  for (const chunk of chunks) {
    assert.ok(Buffer.byteLength(chunk, 'utf8') <= 1800);
  }
});

test('the adapter restores, atomically replaces, and removes one logical session', async () => {
  const store = new MemorySecureStore();
  const storage = createSecureSessionStorage(store);
  const original = JSON.stringify({
    access_token: 'fixture-one',
    user: { name: 'Å🌾'.repeat(600) },
  });
  const replacement = JSON.stringify({
    access_token: 'fixture-two',
    user: { name: 'replacement' },
  });

  await storage.setItem(key, original);
  assert.equal(await storage.getItem(key), original);
  assert.ok(
    [...store.values.keys()].some((storedKey) =>
      storedKey.endsWith('secure-a-0'),
    ),
  );

  await storage.setItem(key, replacement);
  assert.equal(await storage.getItem(key), replacement);
  assert.equal(
    [...store.values.keys()].some((storedKey) =>
      storedKey.includes('secure-a-'),
    ),
    false,
  );

  await storage.removeItem(key);
  assert.equal(await storage.getItem(key), null);
  assert.equal(store.values.size, 0);
});

test('a failed manifest commit preserves the previously committed session', async () => {
  const store = new MemorySecureStore();
  const storage = createSecureSessionStorage(store);
  const original = JSON.stringify({ access_token: 'committed-fixture' });
  await storage.setItem(key, original);

  store.failManifestWrites = true;
  await assert.rejects(
    storage.setItem(
      key,
      JSON.stringify({ access_token: 'uncommitted-fixture' }),
    ),
  );
  assert.equal(await storage.getItem(key), original);
});

test('missing chunks and malformed session JSON are removed without a fallback', async () => {
  const store = new MemorySecureStore();
  const storage = createSecureSessionStorage(store);
  await storage.setItem(
    key,
    JSON.stringify({ access_token: 'truncated-fixture' }),
  );
  store.values.delete(`${key}.secure-a-0`);
  assert.equal(await storage.getItem(key), null);
  assert.equal(store.values.size, 0);

  await store.setItemAsync(
    `${key}.secure-manifest`,
    JSON.stringify({ version: 1, bank: 'a', chunkCount: 1 }),
  );
  await store.setItemAsync(`${key}.secure-a-0`, '{broken-json');
  assert.equal(await storage.getItem(key), null);
  assert.equal(store.values.size, 0);
});

test('a corrupt manifest clears both protected banks', async () => {
  const store = new MemorySecureStore();
  const storage = createSecureSessionStorage(store);
  await storage.setItem(
    key,
    JSON.stringify({ access_token: 'corrupt-manifest-fixture' }),
  );
  await store.setItemAsync(`${key}.secure-manifest`, '{not-json');
  assert.equal(await storage.getItem(key), null);
  assert.equal(store.values.size, 0);
});

test('an absent manifest scrubs residual chunks from both banks, including high indexes', async () => {
  const store = new MemorySecureStore();
  const storage = createSecureSessionStorage(store);
  await store.setItemAsync(`${key}.secure-a-0`, '{orphaned-a');
  await store.setItemAsync(`${key}.secure-a-31`, '{orphaned-high-a');
  await store.setItemAsync(`${key}.secure-b-0`, '{orphaned-b');
  await store.setItemAsync(`${key}.secure-b-31`, '{orphaned-high-b');

  assert.equal(await storage.getItem(key), null);
  assert.equal(store.values.size, 0);
});

test('replacement without a valid manifest removes stale payloads before committing', async () => {
  const store = new MemorySecureStore();
  const storage = createSecureSessionStorage(store);
  await store.setItemAsync(`${key}.secure-a-0`, '{stale-a');
  await store.setItemAsync(`${key}.secure-a-31`, '{stale-high-a');
  await store.setItemAsync(`${key}.secure-b-1`, '{stale-b');
  const replacement = JSON.stringify({ access_token: 'only-current-session' });

  await storage.setItem(key, replacement);

  assert.equal(await storage.getItem(key), replacement);
  assert.deepEqual(
    [...store.values.keys()].filter((storedKey) =>
      /secure-[ab]-/.test(storedKey),
    ),
    [`${key}.secure-a-0`],
  );
  assert.equal(store.values.size, 2);
});

test('every independent deletion settles before a queued write, even when one fails', async () => {
  const store = new DeferredDeleteStore();
  const storage = createSecureSessionStorage(store);
  await storage.setItem(key, JSON.stringify({ access_token: 'old-session' }));
  const replacement = JSON.stringify({ access_token: 'new-session' });
  store.deferDeletes = true;

  let removalFailed = false;
  const removal = storage.removeItem(key).catch(() => {
    removalFailed = true;
  });
  while (store.pendingDeletes.length < 66) await nextTurn();
  assert.equal(store.pendingDeletes.length, 66);

  const writing = storage.setItem(key, replacement);
  await nextTurn();
  assert.equal(store.writesAfterDeferredRemoval, 0);

  const removalDeletes = [...store.pendingDeletes];
  for (const [index, pending] of removalDeletes.entries()) {
    if (index !== 2) pending.resolve();
  }
  await nextTurn();
  assert.equal(store.writesAfterDeferredRemoval, 0);

  removalDeletes[2].reject(new Error('one independent delete failed'));
  await removal;
  assert.equal(removalFailed, true);
  assert.equal(store.writesAfterDeferredRemoval, 0);

  while (store.pendingDeletes.length < 132) await nextTurn();
  assert.equal(store.writesAfterDeferredRemoval, 0);
  for (const pending of store.pendingDeletes.slice(66)) pending.resolve();
  await writing;

  assert.ok(store.writesAfterDeferredRemoval > 0);
  store.deferDeletes = false;
  assert.equal(await storage.getItem(key), replacement);
  assert.equal(store.values.get(`${key}.secure-a-0`), replacement);
  assert.equal(
    [...store.values.keys()].some((storedKey) =>
      storedKey.includes('secure-b-'),
    ),
    false,
  );
});

test('failed previous-bank cleanup is durable, resumable, and never clears the committed bank', async () => {
  const store = new MemorySecureStore();
  const storage = createSecureSessionStorage(store);
  await storage.setItem(
    key,
    JSON.stringify({ access_token: 'original-session' }),
  );
  const replacement = JSON.stringify({ access_token: 'committed-replacement' });
  store.failedDeleteBank = 'a';

  await assert.rejects(
    storage.setItem(key, replacement),
    /previous data could not be completely removed/,
  );
  assert.equal(
    store.values.get(`${key}.secure-manifest`),
    JSON.stringify({ version: 1, bank: 'b', chunkCount: 1 }),
  );
  assert.equal(
    store.values.get(`${key}.secure-cleanup`),
    JSON.stringify({ version: 1, bank: 'a' }),
  );
  assert.equal(store.values.has(`${key}.secure-a-0`), true);
  assert.equal(store.values.get(`${key}.secure-b-0`), replacement);

  store.deletedKeys.length = 0;
  await assert.rejects(storage.getItem(key), /could not be completely removed/);
  assert.equal(
    store.deletedKeys.some((storedKey) => storedKey.includes('secure-b-')),
    false,
  );
  assert.equal(store.values.get(`${key}.secure-b-0`), replacement);
  assert.equal(store.values.has(`${key}.secure-cleanup`), true);

  store.failedDeleteBank = null;
  assert.equal(await storage.getItem(key), replacement);
  assert.equal(store.values.has(`${key}.secure-a-0`), false);
  assert.equal(store.values.has(`${key}.secure-cleanup`), false);
  assert.equal(store.values.get(`${key}.secure-b-0`), replacement);
});

test('valid restoration without cleanup metadata clears only the non-committed bank', async () => {
  const store = new MemorySecureStore();
  const storage = createSecureSessionStorage(store);
  const current = JSON.stringify({ access_token: 'current-committed-session' });
  await store.setItemAsync(
    `${key}.secure-manifest`,
    JSON.stringify({ version: 1, bank: 'b', chunkCount: 1 }),
  );
  await store.setItemAsync(`${key}.secure-b-0`, current);
  await store.setItemAsync(`${key}.secure-a-0`, '{stale-a');
  await store.setItemAsync(`${key}.secure-a-31`, '{stale-high-a');

  assert.equal(await storage.getItem(key), current);
  assert.equal(store.values.get(`${key}.secure-b-0`), current);
  assert.equal(store.values.has(`${key}.secure-a-0`), false);
  assert.equal(store.values.has(`${key}.secure-a-31`), false);
  assert.equal(
    store.deletedKeys.some((storedKey) => storedKey.includes('secure-b-')),
    false,
  );
});

test('rejected stale-bank marker creation does not prevent recovery after commit', async () => {
  const store = new MemorySecureStore();
  const storage = createSecureSessionStorage(store);
  await storage.setItem(
    key,
    JSON.stringify({ access_token: 'old-bank-session' }),
  );
  const current = JSON.stringify({ access_token: 'newest-committed-session' });
  store.failedDeleteBank = 'a';
  store.failCleanupWrites = true;

  await assert.rejects(
    storage.setItem(key, current),
    /previous data could not be completely removed/,
  );
  assert.equal(store.values.has(`${key}.secure-cleanup`), false);
  assert.equal(store.values.has(`${key}.secure-a-0`), true);
  assert.equal(store.values.get(`${key}.secure-b-0`), current);

  store.failedDeleteBank = null;
  store.failCleanupWrites = false;
  store.deletedKeys.length = 0;
  assert.equal(await storage.getItem(key), current);
  assert.equal(store.values.has(`${key}.secure-a-0`), false);
  assert.equal(store.values.get(`${key}.secure-b-0`), current);
  assert.equal(
    store.deletedKeys.some((storedKey) => storedKey.includes('secure-b-')),
    false,
  );
});

test('malformed cleanup metadata cannot preserve orphans or select the current bank', async () => {
  const store = new MemorySecureStore();
  const storage = createSecureSessionStorage(store);
  const current = JSON.stringify({ access_token: 'manifest-owned-session' });
  await store.setItemAsync(
    `${key}.secure-manifest`,
    JSON.stringify({ version: 1, bank: 'b', chunkCount: 1 }),
  );
  await store.setItemAsync(`${key}.secure-b-0`, current);
  await store.setItemAsync(`${key}.secure-a-17`, '{orphan-from-old-bank');
  await store.setItemAsync(`${key}.secure-cleanup`, '{malformed-cleanup');

  assert.equal(await storage.getItem(key), current);
  assert.equal(store.values.get(`${key}.secure-b-0`), current);
  assert.equal(store.values.has(`${key}.secure-a-17`), false);
  assert.equal(store.values.has(`${key}.secure-cleanup`), false);
  assert.equal(
    store.deletedKeys.some((storedKey) => storedKey.includes('secure-b-')),
    false,
  );
});

test('logout cleanup marker survives failed removal and blocks stale restoration after remount', async () => {
  const store = new MemorySecureStore();
  const originalStorage = createSecureSessionStorage(store);
  const original = JSON.stringify({
    access_token: 'stale-after-interrupted-logout',
  });
  await originalStorage.setItem(key, original);
  await originalStorage.markLogoutCleanupRequired(key);

  store.failManifestDeletes = true;
  store.failedDeleteBank = 'a';
  await assert.rejects(
    originalStorage.removeItem(key),
    /could not be completely removed/,
  );
  assert.equal(store.values.has(`${key}.secure-manifest`), true);
  assert.equal(store.values.get(`${key}.secure-a-0`), original);
  assert.equal(store.values.get(`${key}.secure-cleanup-required`), '1');

  const remountedStorage = createSecureSessionStorage(store);
  assert.equal(await remountedStorage.getLogoutCleanupRequired(key), true);
  await assert.rejects(
    remountedStorage.getItem(key),
    /logout cleanup is required/,
  );

  store.failManifestDeletes = false;
  store.failedDeleteBank = null;
  await remountedStorage.removeItem(key);
  assert.equal(await remountedStorage.getLogoutCleanupRequired(key), true);
  assert.equal(store.values.has(`${key}.secure-cleanup-required`), true);
  assert.equal(store.values.has(`${key}.secure-manifest`), false);
  assert.equal(store.values.has(`${key}.secure-a-0`), false);
  await assert.rejects(
    remountedStorage.getItem(key),
    /logout cleanup is required/,
  );

  await remountedStorage.clearLogoutCleanupRequired(key);
  assert.equal(await remountedStorage.getLogoutCleanupRequired(key), false);
  assert.equal(await remountedStorage.getItem(key), null);

  const replacement = JSON.stringify({
    access_token: 'new-explicit-authentication',
  });
  await remountedStorage.setItem(key, replacement);
  assert.equal(await remountedStorage.getItem(key), replacement);
});

test('logout marker creation failure rejects instead of representing cleanup as armed', async () => {
  const store = new MemorySecureStore();
  const storage = createSecureSessionStorage(store);
  store.failLogoutCleanupWrites = true;

  await assert.rejects(
    storage.markLogoutCleanupRequired(key),
    /simulated cleanup marker write failure/,
  );
  assert.equal(await storage.getLogoutCleanupRequired(key), false);
  assert.equal(store.values.has(`${key}.secure-cleanup-required`), false);
});

test('logout marker deletion failure rejects and continues blocking restoration', async () => {
  const store = new MemorySecureStore();
  const storage = createSecureSessionStorage(store);
  await storage.setItem(
    key,
    JSON.stringify({ access_token: 'pending-local-removal' }),
  );
  await storage.markLogoutCleanupRequired(key);
  store.failLogoutCleanupDeletes = true;

  await assert.rejects(
    storage.clearLogoutCleanupRequired(key),
    /simulated cleanup marker delete failure/,
  );
  assert.equal(await storage.getLogoutCleanupRequired(key), true);
  assert.equal(store.values.get(`${key}.secure-cleanup-required`), '1');
  await assert.rejects(storage.getItem(key), /logout cleanup is required/);

  store.failLogoutCleanupDeletes = false;
  await storage.clearLogoutCleanupRequired(key);
  assert.equal(await storage.getLogoutCleanupRequired(key), false);
});

test('scoped read authority lets Supabase revoke locally without clearing the logout marker', async () => {
  const store = new MemorySecureStore();
  const storage = createSecureSessionStorage(store);
  const requests: { url: string; authorization: string | null }[] = [];
  const client = createClient(
    'https://auth-fixture.supabase.co',
    'fixture-publishable-key',
    {
      auth: {
        storageKey: key,
        storage,
        persistSession: true,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
          const url =
            typeof input === 'string'
              ? input
              : input instanceof URL
                ? input.href
                : input.url;
          requests.push({
            url,
            authorization: new Headers(init?.headers).get('authorization'),
          });
          return new Response(null, { status: 204 });
        },
      },
    },
  );
  await client.auth.getSession();
  const accessToken = 'fixture-access-token';
  await storage.setItem(
    key,
    JSON.stringify({
      access_token: accessToken,
      refresh_token: 'fixture-refresh-token',
      token_type: 'bearer',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: 'fixture-user' },
    }),
  );
  await storage.markLogoutCleanupRequired(key);

  const result = await storage.withLogoutCleanupReadAuthority(key, () =>
    client.auth.signOut({ scope: 'local' }),
  );

  assert.equal(result.error, null);
  assert.equal(requests.length, 1);
  const requestUrl = new URL(requests[0].url);
  assert.equal(requestUrl.pathname, '/auth/v1/logout');
  assert.equal(requestUrl.searchParams.get('scope'), 'local');
  assert.equal(requests[0].authorization, `Bearer ${accessToken}`);
  assert.equal(await storage.getLogoutCleanupRequired(key), true);
  assert.equal(store.values.has(`${key}.secure-cleanup-required`), true);
  assert.equal(store.values.has(`${key}.secure-manifest`), false);
  await assert.rejects(storage.getItem(key), /logout cleanup is required/);

  await storage.clearLogoutCleanupRequired(key);
  assert.equal(await storage.getItem(key), null);
});

test('scoped read authority is released after failure and never authorizes writes', async () => {
  const store = new MemorySecureStore();
  const storage = createSecureSessionStorage(store);
  const original = JSON.stringify({
    access_token: 'read-only-for-owned-logout',
  });
  await storage.setItem(key, original);
  await storage.markLogoutCleanupRequired(key);

  await assert.rejects(
    storage.withLogoutCleanupReadAuthority(key, async () => {
      assert.equal(await storage.getItem(key), original);
      await assert.rejects(
        storage.setItem(
          key,
          JSON.stringify({ access_token: 'forbidden-write' }),
        ),
        /logout cleanup is required/,
      );
      throw new Error('simulated owned logout failure');
    }),
    /simulated owned logout failure/,
  );

  assert.equal(await storage.getLogoutCleanupRequired(key), true);
  assert.equal(store.values.get(`${key}.secure-cleanup-required`), '1');
  await assert.rejects(storage.getItem(key), /logout cleanup is required/);
  assert.equal(store.values.has(`${key}.secure-a-0`), true);
});
