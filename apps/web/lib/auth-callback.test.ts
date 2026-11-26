import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyAuthCallback, type CallbackAuth } from './auth-callback';

test('callback exchanges PKCE codes and verifies invitation/recovery token hashes', async () => {
  const calls: unknown[] = [];
  const auth: CallbackAuth = {
    async exchangeCodeForSession(code) {
      calls.push(code);
      return { error: null };
    },
    async verifyOtp(input) {
      calls.push(input);
      return { error: null };
    },
  };
  assert.equal(
    await verifyAuthCallback(new URLSearchParams('code=pkce'), auth),
    true,
  );
  for (const type of ['invite', 'recovery']) {
    assert.equal(
      await verifyAuthCallback(
        new URLSearchParams(`token_hash=hash&type=${type}`),
        auth,
      ),
      true,
    );
  }
  assert.deepEqual(calls, [
    'pkce',
    { token_hash: 'hash', type: 'invite' },
    { token_hash: 'hash', type: 'recovery' },
  ]);
});

test('callback rejects malformed or ambiguous inputs before calling Auth', async () => {
  const auth: CallbackAuth = {
    async exchangeCodeForSession() {
      assert.fail('Unexpected Auth call');
    },
    async verifyOtp() {
      assert.fail('Unexpected Auth call');
    },
  };
  for (const query of [
    '',
    'token_hash=hash&type=email',
    'token_hash=hash',
    'code=a&code=b',
    'code=a&token_hash=b&type=invite',
    'token_hash=a&type=invite&type=recovery',
  ]) {
    assert.equal(
      await verifyAuthCallback(new URLSearchParams(query), auth),
      false,
    );
  }
});

test('callback propagates verification rejection without accepting a session', async () => {
  const auth: CallbackAuth = {
    async exchangeCodeForSession() {
      return { error: new Error('expired') };
    },
    async verifyOtp() {
      return { error: new Error('expired') };
    },
  };
  assert.equal(
    await verifyAuthCallback(new URLSearchParams('code=expired'), auth),
    false,
  );
  assert.equal(
    await verifyAuthCallback(
      new URLSearchParams('token_hash=expired&type=invite'),
      auth,
    ),
    false,
  );
});
