import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ApiClientError,
  createApiClient,
  type ApiClient,
  type RequestOptions,
} from '../src/index.ts';

const session = {
  user: {
    id: '0d2ec7ec-2f46-4b6b-bb8f-b7c631b5e2ab',
    email: null,
    displayName: 'Farm Administrator',
  },
  roles: [{ code: 'admin', name: 'Administrator' }],
  permissions: ['admin.access'],
};

const requestId = 'f67eb1a1-df3f-49db-a14d-0ed5fbb550a8';

const userId = 'cb0c3f8c-e4d4-4941-aa5d-d1b9b127d64a';
const roleId = '88fd8c34-660b-4f87-a11e-9f25c1a859d6';
const permissionId = '8cde27ec-55df-45a4-aaf7-e1889f426c04';
const user = {
  id: userId,
  email: 'admin@example.test',
  displayName: 'Farm Administrator',
  isActive: true,
  invitedAt: '2026-11-20T10:00:00Z',
  emailConfirmedAt: null,
  lastSignInAt: null,
  createdAt: '2026-11-20T09:55:00Z',
  roles: [{ id: roleId, code: 'admin', name: 'Administrator' }],
};
const role = {
  id: roleId,
  code: 'records_viewer',
  name: 'Records viewer',
  description: 'Read selected records',
  isSystem: false,
  createdAt: '2026-11-20T10:00:00Z',
  updatedAt: '2026-11-21T10:00:00Z',
  permissionIds: [permissionId],
};
const permission = {
  id: permissionId,
  code: 'users.read',
  name: 'Read users',
  description: 'View administration users',
};
const auditEvent = {
  id: 42,
  actorId: userId,
  action: 'user.invited',
  targetType: 'user',
  targetId: userId,
  requestId,
  occurredAt: '2026-11-25T10:00:00Z',
  metadata: { email: 'admin@example.test', invitationId: null },
};

test('getSession parses a success envelope and forwards cookie options and signals', async () => {
  const controller = new AbortController();
  const fetchMock: typeof fetch = async (input, init) => {
    assert.equal(input, '/api/v1/session');
    assert.equal(new Headers(init?.headers).get('accept'), 'application/json');
    assert.equal(new Headers(init?.headers).has('authorization'), false);
    assert.equal(init?.credentials, 'include');
    assert.equal(init?.signal, controller.signal);
    return Response.json({ data: session });
  };
  const client = createApiClient({ fetch: fetchMock, credentials: 'include' });

  assert.deepEqual(
    await client.getSession({ signal: controller.signal }),
    session,
  );
});

test('getSession supports asynchronous bearer tokens and absolute base URLs', async () => {
  const fetchMock: typeof fetch = async (input, init) => {
    assert.equal(input, 'https://example.test/api/v1/session');
    assert.equal(
      new Headers(init?.headers).get('authorization'),
      'Bearer access-token',
    );
    return Response.json({ data: session });
  };
  const client = createApiClient({
    baseUrl: 'https://example.test/',
    getAccessToken: async () => 'access-token',
    fetch: fetchMock,
  });

  assert.deepEqual(await client.getSession(), session);
});

test('getSession preserves structured API errors', async () => {
  const client = createApiClient({
    fetch: async () =>
      Response.json(
        {
          error: {
            code: 'FORBIDDEN',
            message: 'This profile is inactive.',
            requestId,
            issues: [{ path: ['user', 0], message: 'Inactive profile' }],
          },
        },
        { status: 403 },
      ),
  });

  await assert.rejects(client.getSession(), (error: unknown) => {
    assert.ok(error instanceof ApiClientError);
    assert.equal(error.status, 403);
    assert.equal(error.code, 'FORBIDDEN');
    assert.equal(error.message, 'This profile is inactive.');
    assert.equal(error.requestId, requestId);
    assert.deepEqual(error.issues, [
      { path: ['user', 0], message: 'Inactive profile' },
    ]);
    return true;
  });
});

test('getSession rejects invalid success payloads without exposing payload details', async () => {
  const client = createApiClient({
    fetch: async () =>
      Response.json({
        data: {
          ...session,
          user: { ...session.user, email: 'not-an-email' },
        },
      }),
  });

  await assert.rejects(client.getSession(), (error: unknown) => {
    assert.ok(error instanceof ApiClientError);
    assert.equal(error.status, 200);
    assert.equal(error.code, 'INVALID_RESPONSE');
    assert.equal(error.requestId, null);
    assert.deepEqual(error.issues, []);
    assert.equal(error.message, 'The server returned an invalid response.');
    return true;
  });
});

test('getSession converts fetch rejection to a safe network error', async () => {
  const client = createApiClient({
    fetch: async () => {
      throw new TypeError('Private socket details');
    },
  });

  await assert.rejects(client.getSession(), (error: unknown) => {
    assert.ok(error instanceof ApiClientError);
    assert.equal(error.status, null);
    assert.equal(error.code, 'NETWORK_ERROR');
    assert.equal(error.requestId, null);
    assert.deepEqual(error.issues, []);
    assert.equal(error.message, 'The request could not be completed.');
    return true;
  });
});

test('administration reads encode IDs and preserve bearer, cookies, and signals', async () => {
  const controller = new AbortController();
  const fetchMock: typeof fetch = async (input, init) => {
    assert.equal(input, 'https://example.test/api/v1/users/user%2Fid%3F%23');
    assert.equal(init?.method, 'GET');
    assert.equal(init?.credentials, 'include');
    assert.equal(init?.signal, controller.signal);
    assert.equal(new Headers(init?.headers).has('content-type'), false);
    assert.equal(
      new Headers(init?.headers).get('authorization'),
      'Bearer fresh-token',
    );
    return Response.json({ data: { user } });
  };
  const client = createApiClient({
    baseUrl: 'https://example.test',
    fetch: fetchMock,
    credentials: 'include',
    getAccessToken: async () => 'fresh-token',
  });

  assert.deepEqual(
    await client.getUser('user/id?#', { signal: controller.signal }),
    user,
  );
});

test('listUsers and listAuditEvents encode pagination and parse data', async () => {
  const requests: string[] = [];
  const client = createApiClient({
    fetch: async (input) => {
      const url = String(input);
      requests.push(url);
      assert.equal(url, '/api/v1/users?page=2&perPage=25');
      return Response.json({
        data: { users: [user], page: 2, perPage: 25, total: 26 },
      });
    },
  });

  assert.deepEqual(await client.listUsers({ page: 2, perPage: 25 }), {
    users: [user],
    page: 2,
    perPage: 25,
    total: 26,
  });
  assert.deepEqual(requests, ['/api/v1/users?page=2&perPage=25']);

  const auditClient = createApiClient({
    fetch: async (input) => {
      assert.equal(input, '/api/v1/audit-events?page=1&perPage=50');
      return Response.json({
        data: { events: [auditEvent], page: 1, perPage: 50, total: 1 },
      });
    },
  });
  assert.deepEqual(await auditClient.listAuditEvents(), {
    events: [auditEvent],
    page: 1,
    perPage: 50,
    total: 1,
  });
});

test('listRoles parses roles and the read-only permission catalog', async () => {
  const client = createApiClient({
    fetch: async () =>
      Response.json({ data: { roles: [role], permissions: [permission] } }),
  });

  assert.deepEqual(await client.listRoles(), {
    roles: [role],
    permissions: [permission],
  });
});

const mutations: Array<{
  name: string;
  method: string;
  path: string;
  body?: unknown;
  response: unknown;
  run: (client: ApiClient, options: RequestOptions) => Promise<unknown>;
}> = [
  {
    name: 'inviteUser',
    method: 'POST',
    path: '/api/v1/users',
    body: { email: 'new@example.test', displayName: 'New User' },
    response: { data: { user } },
    run: (client, options) =>
      client.inviteUser(
        { email: 'new@example.test', displayName: 'New User' },
        options,
      ),
  },
  {
    name: 'setUserActive',
    method: 'PATCH',
    path: `/api/v1/users/${userId}`,
    body: { isActive: false },
    response: { data: { user: { ...user, isActive: false } } },
    run: (client, options) =>
      client.setUserActive(userId, { isActive: false }, options),
  },
  {
    name: 'setUserRoles',
    method: 'PUT',
    path: `/api/v1/users/${userId}/roles`,
    body: { roleIds: [roleId] },
    response: { data: { user } },
    run: (client, options) =>
      client.setUserRoles(userId, { roleIds: [roleId] }, options),
  },
  {
    name: 'createRole',
    method: 'POST',
    path: '/api/v1/roles',
    body: {
      code: 'records_viewer',
      name: 'Records viewer',
      description: 'Read selected records',
      permissionIds: [permissionId],
    },
    response: { data: { role } },
    run: (client, options) =>
      client.createRole(
        {
          code: 'records_viewer',
          name: 'Records viewer',
          description: 'Read selected records',
          permissionIds: [permissionId],
        },
        options,
      ),
  },
  {
    name: 'updateRole',
    method: 'PATCH',
    path: '/api/v1/roles/role%2Fid%3F%23',
    body: {
      name: 'Updated viewer',
      description: 'Updated access',
      permissionIds: [],
    },
    response: { data: { role } },
    run: (client, options) =>
      client.updateRole(
        'role/id?#',
        {
          name: 'Updated viewer',
          description: 'Updated access',
          permissionIds: [],
        },
        options,
      ),
  },
  {
    name: 'deleteRole',
    method: 'DELETE',
    path: `/api/v1/roles/${roleId}`,
    response: { data: { deleted: true } },
    run: (client, options) => client.deleteRole(roleId, options),
  },
];

for (const mutation of mutations) {
  test(`${mutation.name} sends its exact JSON wire contract`, async () => {
    const controller = new AbortController();
    const client = createApiClient({
      fetch: async (input, init) => {
        assert.equal(input, mutation.path);
        assert.equal(init?.method, mutation.method);
        assert.equal(init?.signal, controller.signal);
        if (mutation.body === undefined) {
          assert.equal(init?.body, undefined);
          assert.equal(new Headers(init?.headers).has('content-type'), false);
        } else {
          assert.equal(init?.body, JSON.stringify(mutation.body));
          assert.equal(
            new Headers(init?.headers).get('content-type'),
            'application/json',
          );
        }
        return Response.json(mutation.response);
      },
    });

    const result = await mutation.run(client, {
      signal: controller.signal,
    });
    assert.deepEqual(
      result,
      mutation.name === 'deleteRole'
        ? { deleted: true }
        : mutation.name === 'createRole' || mutation.name === 'updateRole'
          ? role
          : mutation.name === 'setUserActive'
            ? { ...user, isActive: false }
            : user,
    );
  });
}

test('new administration operations preserve structured errors', async () => {
  const client = createApiClient({
    fetch: async () =>
      Response.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'The invitation details are invalid.',
            requestId,
            issues: [{ path: ['email'], message: 'Invalid email' }],
          },
        },
        { status: 400 },
      ),
  });

  await assert.rejects(
    client.inviteUser({ email: 'bad', displayName: 'New User' }),
    (error: unknown) => {
      assert.ok(error instanceof ApiClientError);
      assert.equal(error.status, 400);
      assert.equal(error.code, 'VALIDATION_ERROR');
      assert.equal(error.requestId, requestId);
      assert.deepEqual(error.issues, [
        { path: ['email'], message: 'Invalid email' },
      ]);
      return true;
    },
  );
});

test('new administration operations reject renamed or missing success fields', async () => {
  const client = createApiClient({
    fetch: async () =>
      Response.json({
        data: {
          users: [{ ...user, emailAddress: user.email, email: undefined }],
          page: 1,
          perPage: 50,
          total: 1,
        },
      }),
  });

  await assert.rejects(client.listUsers(), (error: unknown) => {
    assert.ok(error instanceof ApiClientError);
    assert.equal(error.status, 200);
    assert.equal(error.code, 'INVALID_RESPONSE');
    assert.equal(error.message, 'The server returned an invalid response.');
    return true;
  });
});

test('new administration mutations normalize network failures', async () => {
  const client = createApiClient({
    fetch: async () => {
      throw new TypeError('Private network information');
    },
  });

  await assert.rejects(client.deleteRole(roleId), (error: unknown) => {
    assert.ok(error instanceof ApiClientError);
    assert.equal(error.status, null);
    assert.equal(error.code, 'NETWORK_ERROR');
    assert.equal(error.message, 'The request could not be completed.');
    return true;
  });
});

test('bearer provider rejection is safe and prevents the fetch', async () => {
  let fetchCalls = 0;
  const client = createApiClient({
    getAccessToken: async () => {
      throw new Error('Sensitive provider credentials and socket details');
    },
    fetch: async () => {
      fetchCalls += 1;
      return Response.json({ data: session });
    },
  });

  await assert.rejects(client.getSession(), (error: unknown) => {
    assert.ok(error instanceof ApiClientError);
    assert.equal(error.status, null);
    assert.equal(error.code, 'NETWORK_ERROR');
    assert.equal(error.message, 'The request could not be completed.');
    assert.equal(String(error).includes('Sensitive provider'), false);
    return true;
  });
  assert.equal(fetchCalls, 0);
});

test('farm setup lists and creates records using the shared API contract', async () => {
  const record = { id: userId, name: 'Shed 1' };
  const client = createApiClient({
    getAccessToken: () => 'access-token',
    fetch: async (url, init) => {
      assert.equal(url, '/api/v1/farm-setup/sheds');
      assert.equal(
        new Headers(init?.headers).get('authorization'),
        'Bearer access-token',
      );
      if (init?.method === 'GET') {
        return Response.json({ data: { records: [record] } });
      }
      assert.equal(init?.method, 'POST');
      assert.equal(init?.body, JSON.stringify({ name: record.name }));
      return Response.json({ data: { record } }, { status: 201 });
    },
  });

  assert.deepEqual(await client.listFarmSetup('sheds'), [record]);
  assert.deepEqual(
    await client.createFarmSetupRecord('sheds', { name: record.name }),
    record,
  );
});

test('mortality and live count requests preserve the flock ID and zero balance', async () => {
  const input = {
    shedId: roleId,
    recordedDate: '2026-11-26',
    birdCount: 40,
    remarks: 'Observed during morning round',
    submissionId: requestId,
  };
  const placements = [
    { shedId: roleId, initialBirdCount: 40, liveBirdCount: 0 },
  ];
  const client = createApiClient({
    fetch: async (url, init) => {
      if (init?.method === 'GET') {
        assert.equal(url, `/api/v1/flocks/${userId}/live-counts`);
        return Response.json({ data: { flockId: userId, placements } });
      }
      assert.equal(url, `/api/v1/flocks/${userId}/mortality`);
      assert.equal(init?.method, 'POST');
      assert.deepEqual(JSON.parse(String(init?.body)), input);
      return Response.json({ data: { id: permissionId } }, { status: 201 });
    },
  });
  assert.deepEqual(await client.getFlockLiveCounts(userId), {
    flockId: userId,
    placements,
  });
  assert.deepEqual(await client.recordFlockMortality(userId, input), {
    id: permissionId,
  });
});
