import assert from 'node:assert/strict';
import test from 'node:test';
import {
  auditEventSchema,
  createRoleRequestSchema,
  inviteUserRequestSchema,
  listUsersResponseSchema,
  setUserRolesRequestSchema,
  userSchema,
} from '../src/index.ts';

const userId = 'cb0c3f8c-e4d4-4941-aa5d-d1b9b127d64a';
const roleId = '88fd8c34-660b-4f87-a11e-9f25c1a859d6';
const requestId = 'f67eb1a1-df3f-49db-a14d-0ed5fbb550a8';

const user = {
  id: userId,
  email: null,
  displayName: 'Invited Administrator',
  isActive: true,
  invitedAt: '2026-11-20T10:00:00+00:00',
  emailConfirmedAt: null,
  lastSignInAt: null,
  createdAt: '2026-11-20T09:55:00Z',
  roles: [{ id: roleId, code: 'admin', name: 'Administrator' }],
};

test('user DTO accepts nullable authentication timestamps and rejects extras', () => {
  assert.deepEqual(userSchema.parse(user), user);
  assert.equal(
    userSchema.safeParse({ ...user, accessToken: 'must-not-appear' }).success,
    false,
  );
  assert.equal(
    userSchema.safeParse({ ...user, emailConfirmedAt: undefined }).success,
    false,
  );
});

test('invite request normalizes the fields specified by the API', () => {
  assert.deepEqual(
    inviteUserRequestSchema.parse({
      email: '  Person@Example.TEST ',
      displayName: '  Farm Manager  ',
    }),
    { email: 'person@example.test', displayName: 'Farm Manager' },
  );
  assert.equal(
    inviteUserRequestSchema.safeParse({
      email: 'person@example.test',
      name: 'Renamed Field',
    }).success,
    false,
  );
});

test('role requests reject unknown fields and excessive role and permission IDs', () => {
  assert.equal(
    createRoleRequestSchema.safeParse({
      code: 'Not-Snake-Case',
      name: 'Role',
      description: '',
      permissionIds: [],
    }).success,
    false,
  );
  assert.equal(
    createRoleRequestSchema.safeParse({
      code: 'valid_role',
      name: 'Role',
      description: '',
      permissionIds: [],
      isSystem: true,
    }).success,
    false,
  );
  assert.equal(
    setUserRolesRequestSchema.safeParse({ roleIds: Array(51).fill(roleId) })
      .success,
    false,
  );
});

test('list and audit envelopes reject renamed fields and unsafe shapes', () => {
  assert.equal(
    listUsersResponseSchema.safeParse({
      data: { items: [user], page: 1, perPage: 50, total: 1 },
    }).success,
    false,
  );

  const event = {
    id: 42,
    actorId: null,
    action: 'user.invited',
    targetType: 'user',
    targetId: userId,
    requestId,
    occurredAt: '2026-11-25T10:00:00Z',
    metadata: { invitation: { id: null }, attempts: 1 },
  };
  assert.deepEqual(auditEventSchema.parse(event), event);
});
