import assert from 'node:assert/strict';
import test from 'node:test';
import { assertLoopbackHttpUrl } from './local-supabase';

test('accepts supported local Supabase and web URLs', () => {
  for (const value of [
    'http://localhost:3000',
    'http://127.0.0.1:54321',
    'http://[::1]:3001',
  ]) {
    assert.equal(assertLoopbackHttpUrl(value, 'test URL'), value);
  }
});

test('rejects remote, non-HTTP, credential-bearing, and malformed targets before requests', () => {
  for (const value of [
    'https://localhost:3000',
    'http://example.com',
    'https://example.com',
    'http://user:password@localhost:3000',
    'http://__proto__/',
    'not-a-url',
  ]) {
    assert.throws(() => assertLoopbackHttpUrl(value, 'test URL'));
  }
});
