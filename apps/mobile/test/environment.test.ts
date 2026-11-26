import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { getMobileEnvironment } from '../src/config/environment';

const names = [
  'NODE_ENV',
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'EXPO_PUBLIC_API_URL',
];
let originals: Record<string, string | undefined>;

beforeEach(() => {
  originals = Object.fromEntries(
    names.map((name) => [name, process.env[name]]),
  );
  process.env.NODE_ENV = 'development';
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://safe.example.test';
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'public-key';
  process.env.EXPO_PUBLIC_API_URL = 'http://localhost:3000';
});

afterEach(() => {
  for (const name of names) {
    if (originals[name] === undefined) delete process.env[name];
    else process.env[name] = originals[name];
  }
});

test('allows an explicit local-development HTTP API while keeping Auth on HTTPS', () => {
  const environment = getMobileEnvironment();
  assert.equal(environment.supabaseUrl, 'https://safe.example.test');
  assert.equal(environment.apiUrl, 'http://localhost:3000');
  assert.equal(environment.supabasePublishableKey, 'public-key');
});

test('rejects HTTP API or Auth origins in production', () => {
  process.env.NODE_ENV = 'production';
  assert.throws(
    () => getMobileEnvironment(),
    /must be a valid HTTP or HTTPS URL/,
  );
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'http://unsafe.example.test';
  assert.throws(
    () => getMobileEnvironment(),
    /must be a valid HTTP or HTTPS URL/,
  );
});

test('rejects credentials embedded in endpoint URLs', () => {
  process.env.EXPO_PUBLIC_API_URL = 'http://user:password@localhost:3000';
  assert.throws(() => getMobileEnvironment(), /valid HTTP or HTTPS URL/);
});
