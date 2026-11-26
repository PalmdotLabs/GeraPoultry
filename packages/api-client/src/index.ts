import {
  apiErrorResponseSchema,
  createFarmSetupRecordResponseSchema,
  createFlockResponseSchema,
  createRoleResponseSchema,
  deleteRoleResponseSchema,
  flockLiveCountsResponseSchema,
  getUserResponseSchema,
  inviteUserResponseSchema,
  listAuditEventsResponseSchema,
  listEggCollectionsResponseSchema,
  listFarmSetupResponseSchema,
  listFlocksResponseSchema,
  listRolesResponseSchema,
  listUsersResponseSchema,
  recordEggCollectionResponseSchema,
  recordFlockMortalityResponseSchema,
  sessionResponseSchema,
  setUserActiveResponseSchema,
  setUserRolesResponseSchema,
  updateRoleResponseSchema,
  type ApiErrorCode,
  type ApiErrorIssue,
  type AuditEventList,
  type CreateFarmSetupRecordRequest,
  type CreateFlockRequest,
  type CreateRoleRequest,
  type DeleteRoleResult,
  type EggCollectionList,
  type FarmSetupKind,
  type FarmSetupRecord,
  type FlockList,
  type FlockLiveCounts,
  type InviteUserRequest,
  type RecordEggCollectionRequest,
  type RecordFlockMortalityRequest,
  type Role,
  type RoleList,
  type Session,
  type SetUserActiveRequest,
  type SetUserRolesRequest,
  type UpdateRoleRequest,
  type User,
  type UserList,
} from '@poultry/validation';

export type { Session } from '@poultry/validation';

export type ApiClientErrorCode =
  ApiErrorCode | 'NETWORK_ERROR' | 'INVALID_RESPONSE';

export interface ApiClientErrorOptions {
  status: number | null;
  code: ApiClientErrorCode;
  message: string;
  requestId?: string | null;
  issues?: ApiErrorIssue[];
}

export class ApiClientError extends Error {
  readonly status: number | null;
  readonly code: ApiClientErrorCode;
  readonly requestId: string | null;
  readonly issues: ApiErrorIssue[];

  constructor(options: ApiClientErrorOptions) {
    super(options.message);
    this.name = 'ApiClientError';
    this.status = options.status;
    this.code = options.code;
    this.requestId = options.requestId ?? null;
    this.issues = options.issues ?? [];
  }
}

export interface CreateApiClientOptions {
  baseUrl?: string;
  getAccessToken?: () =>
    string | null | undefined | Promise<string | null | undefined>;
  fetch?: typeof fetch;
  credentials?: RequestCredentials;
}

export interface RequestOptions {
  signal?: AbortSignal;
}

export type GetSessionOptions = RequestOptions;

export interface ListOptions extends RequestOptions {
  page?: number;
  perPage?: number;
}

export interface ApiClient {
  getSession(options?: GetSessionOptions): Promise<Session>;
  listFlocks(options?: ListOptions): Promise<FlockList>;
  listEggCollections(options?: ListOptions): Promise<EggCollectionList>;
  recordEggCollection(
    input: RecordEggCollectionRequest,
    options?: RequestOptions,
  ): Promise<{ id: string }>;
  getFlockLiveCounts(
    flockId: string,
    options?: RequestOptions,
  ): Promise<FlockLiveCounts>;
  recordFlockMortality(
    flockId: string,
    input: RecordFlockMortalityRequest,
    options?: RequestOptions,
  ): Promise<{ id: string }>;
  createFlock(
    input: CreateFlockRequest,
    options?: RequestOptions,
  ): Promise<{ id: string }>;
  listFarmSetup(
    kind: FarmSetupKind,
    options?: RequestOptions,
  ): Promise<FarmSetupRecord[]>;
  createFarmSetupRecord(
    kind: FarmSetupKind,
    input: CreateFarmSetupRecordRequest,
    options?: RequestOptions,
  ): Promise<FarmSetupRecord>;
  listUsers(options?: ListOptions): Promise<UserList>;
  getUser(userId: string, options?: RequestOptions): Promise<User>;
  inviteUser(input: InviteUserRequest, options?: RequestOptions): Promise<User>;
  setUserActive(
    userId: string,
    input: SetUserActiveRequest,
    options?: RequestOptions,
  ): Promise<User>;
  setUserRoles(
    userId: string,
    input: SetUserRolesRequest,
    options?: RequestOptions,
  ): Promise<User>;
  listRoles(options?: RequestOptions): Promise<RoleList>;
  createRole(input: CreateRoleRequest, options?: RequestOptions): Promise<Role>;
  updateRole(
    roleId: string,
    input: UpdateRoleRequest,
    options?: RequestOptions,
  ): Promise<Role>;
  deleteRole(
    roleId: string,
    options?: RequestOptions,
  ): Promise<DeleteRoleResult>;
  listAuditEvents(options?: ListOptions): Promise<AuditEventList>;
}

const invalidResponse = (status: number) =>
  new ApiClientError({
    status,
    code: 'INVALID_RESPONSE',
    message: 'The server returned an invalid response.',
  });

const listPath = (path: string, page: number, perPage: number) =>
  `${path}?${new URLSearchParams({
    page: String(page),
    perPage: String(perPage),
  })}`;

export const createApiClient = ({
  baseUrl = '',
  getAccessToken,
  fetch: providedFetch,
  credentials,
}: CreateApiClientOptions = {}): ApiClient => {
  const request = async <ParsedResponse>(
    path: string,
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
    signal: AbortSignal | undefined,
    parse: (payload: unknown, status: number) => ParsedResponse,
    body?: unknown,
  ): Promise<ParsedResponse> => {
    const headers = new Headers({ Accept: 'application/json' });
    if (body !== undefined) {
      headers.set('Content-Type', 'application/json');
    }
    const fetchImplementation = providedFetch ?? globalThis.fetch;
    let response: Response;
    try {
      const accessToken = await getAccessToken?.();
      if (accessToken) {
        headers.set('Authorization', `Bearer ${accessToken}`);
      }
      response = await fetchImplementation(
        `${baseUrl.replace(/\/+$/, '')}${path}`,
        {
          method,
          headers,
          credentials,
          signal,
          body: body === undefined ? undefined : JSON.stringify(body),
        },
      );
    } catch {
      throw new ApiClientError({
        status: null,
        code: 'NETWORK_ERROR',
        message: 'The request could not be completed.',
      });
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw invalidResponse(response.status);
    }

    if (!response.ok) {
      const result = apiErrorResponseSchema.safeParse(payload);
      if (!result.success) {
        throw invalidResponse(response.status);
      }
      const { code, message, requestId, issues } = result.data.error;
      throw new ApiClientError({
        status: response.status,
        code,
        message,
        requestId,
        issues,
      });
    }

    return parse(payload, response.status);
  };

  const parseUser = (payload: unknown, status: number) => {
    const result = getUserResponseSchema.safeParse(payload);
    if (!result.success) {
      throw invalidResponse(status);
    }
    return result.data.data.user;
  };

  const parseRole = (payload: unknown, status: number) => {
    const result = createRoleResponseSchema.safeParse(payload);
    if (!result.success) {
      throw invalidResponse(status);
    }
    return result.data.data.role;
  };

  return {
    getSession: ({ signal } = {}) =>
      request('/api/v1/session', 'GET', signal, (payload, status) => {
        const result = sessionResponseSchema.safeParse(payload);
        if (!result.success) {
          throw invalidResponse(status);
        }
        return result.data.data;
      }),

    listEggCollections: ({ signal, page = 1, perPage = 50 } = {}) =>
      request(
        listPath('/api/v1/egg-collections', page, perPage),
        'GET',
        signal,
        (payload, status) => {
          const result = listEggCollectionsResponseSchema.safeParse(payload);
          if (!result.success) throw invalidResponse(status);
          return result.data.data;
        },
      ),

    recordEggCollection: (input, { signal } = {}) =>
      request(
        '/api/v1/egg-collections',
        'POST',
        signal,
        (payload, status) => {
          const result = recordEggCollectionResponseSchema.safeParse(payload);
          if (!result.success) throw invalidResponse(status);
          return result.data.data;
        },
        input,
      ),

    getFlockLiveCounts: (flockId, { signal } = {}) =>
      request(
        `/api/v1/flocks/${encodeURIComponent(flockId)}/live-counts`,
        'GET',
        signal,
        (payload, status) => {
          const result = flockLiveCountsResponseSchema.safeParse(payload);
          if (!result.success) throw invalidResponse(status);
          return result.data.data;
        },
      ),

    recordFlockMortality: (flockId, input, { signal } = {}) =>
      request(
        `/api/v1/flocks/${encodeURIComponent(flockId)}/mortality`,
        'POST',
        signal,
        (payload, status) => {
          const result = recordFlockMortalityResponseSchema.safeParse(payload);
          if (!result.success) throw invalidResponse(status);
          return result.data.data;
        },
        input,
      ),

    listFlocks: ({ signal, page = 1, perPage = 50 } = {}) =>
      request(
        listPath('/api/v1/flocks', page, perPage),
        'GET',
        signal,
        (payload, status) => {
          const result = listFlocksResponseSchema.safeParse(payload);
          if (!result.success) throw invalidResponse(status);
          return result.data.data;
        },
      ),

    createFlock: (input, { signal } = {}) =>
      request(
        '/api/v1/flocks',
        'POST',
        signal,
        (payload, status) => {
          const result = createFlockResponseSchema.safeParse(payload);
          if (!result.success) throw invalidResponse(status);
          return result.data.data;
        },
        input,
      ),

    listFarmSetup: (kind, { signal } = {}) =>
      request(
        `/api/v1/farm-setup/${kind}`,
        'GET',
        signal,
        (payload, status) => {
          const result = listFarmSetupResponseSchema.safeParse(payload);
          if (!result.success) throw invalidResponse(status);
          return result.data.data.records;
        },
      ),

    createFarmSetupRecord: (kind, input, { signal } = {}) =>
      request(
        `/api/v1/farm-setup/${kind}`,
        'POST',
        signal,
        (payload, status) => {
          const result = createFarmSetupRecordResponseSchema.safeParse(payload);
          if (!result.success) throw invalidResponse(status);
          return result.data.data.record;
        },
        input,
      ),

    listUsers: ({ signal, page = 1, perPage = 50 } = {}) =>
      request(
        listPath('/api/v1/users', page, perPage),
        'GET',
        signal,
        (payload, status) => {
          const result = listUsersResponseSchema.safeParse(payload);
          if (!result.success) {
            throw invalidResponse(status);
          }
          return result.data.data;
        },
      ),

    getUser: (userId, { signal } = {}) =>
      request(
        `/api/v1/users/${encodeURIComponent(userId)}`,
        'GET',
        signal,
        parseUser,
      ),

    inviteUser: (input, { signal } = {}) =>
      request(
        '/api/v1/users',
        'POST',
        signal,
        (payload, status) => {
          const result = inviteUserResponseSchema.safeParse(payload);
          if (!result.success) {
            throw invalidResponse(status);
          }
          return result.data.data.user;
        },
        input,
      ),

    setUserActive: (userId, input, { signal } = {}) =>
      request(
        `/api/v1/users/${encodeURIComponent(userId)}`,
        'PATCH',
        signal,
        (payload, status) => {
          const result = setUserActiveResponseSchema.safeParse(payload);
          if (!result.success) {
            throw invalidResponse(status);
          }
          return result.data.data.user;
        },
        input,
      ),

    setUserRoles: (userId, input, { signal } = {}) =>
      request(
        `/api/v1/users/${encodeURIComponent(userId)}/roles`,
        'PUT',
        signal,
        (payload, status) => {
          const result = setUserRolesResponseSchema.safeParse(payload);
          if (!result.success) {
            throw invalidResponse(status);
          }
          return result.data.data.user;
        },
        input,
      ),

    listRoles: ({ signal } = {}) =>
      request('/api/v1/roles', 'GET', signal, (payload, status) => {
        const result = listRolesResponseSchema.safeParse(payload);
        if (!result.success) {
          throw invalidResponse(status);
        }
        return result.data.data;
      }),

    createRole: (input, { signal } = {}) =>
      request('/api/v1/roles', 'POST', signal, parseRole, input),

    updateRole: (roleId, input, { signal } = {}) =>
      request(
        `/api/v1/roles/${encodeURIComponent(roleId)}`,
        'PATCH',
        signal,
        (payload, status) => {
          const result = updateRoleResponseSchema.safeParse(payload);
          if (!result.success) {
            throw invalidResponse(status);
          }
          return result.data.data.role;
        },
        input,
      ),

    deleteRole: (roleId, { signal } = {}) =>
      request(
        `/api/v1/roles/${encodeURIComponent(roleId)}`,
        'DELETE',
        signal,
        (payload, status) => {
          const result = deleteRoleResponseSchema.safeParse(payload);
          if (!result.success) {
            throw invalidResponse(status);
          }
          return result.data.data;
        },
      ),

    listAuditEvents: ({ signal, page = 1, perPage = 50 } = {}) =>
      request(
        listPath('/api/v1/audit-events', page, perPage),
        'GET',
        signal,
        (payload, status) => {
          const result = listAuditEventsResponseSchema.safeParse(payload);
          if (!result.success) {
            throw invalidResponse(status);
          }
          return result.data.data;
        },
      ),
  };
};
