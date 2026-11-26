import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@poultry/types';
import {
  type ApiErrorCode,
  type ApiErrorIssue,
  type ApiErrorResponse,
  type Session,
} from '@poultry/validation';
import { NextResponse } from 'next/server';
import { getRequestSession } from '@/lib/server/session-context';

export const adminResponseHeaders = { 'Cache-Control': 'private, no-store' };

export type AdministrativeContext = {
  requestId: string;
  session: Session;
  supabase: SupabaseClient<Database>;
};

export class AdministrativeHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly issues?: ApiErrorIssue[],
  ) {
    super(message);
  }
}

export function apiErrorResponse(
  status: number,
  code: ApiErrorCode,
  message: string,
  requestId: string,
  issues?: ApiErrorIssue[],
) {
  const body: ApiErrorResponse = {
    error: { code, message, requestId, ...(issues?.length ? { issues } : {}) },
  };
  return NextResponse.json(body, { status, headers: adminResponseHeaders });
}

export function handleApiError(caught: unknown, requestId: string) {
  if (caught instanceof AdministrativeHttpError) {
    return apiErrorResponse(
      caught.status,
      caught.code,
      caught.message,
      requestId,
      caught.issues,
    );
  }

  console.error(`Administrative request ${requestId} failed.`, {
    errorName: caught instanceof Error ? caught.name : 'UnknownError',
  });
  return apiErrorResponse(
    500,
    'INTERNAL_ERROR',
    'The administrative request could not be completed. Try again.',
    requestId,
  );
}

export function configuredAppOrigin(): string {
  const configured =
    process.env.APP_ORIGIN ??
    (process.env.NODE_ENV === 'development'
      ? 'http://localhost:3000'
      : undefined);

  if (!configured) {
    throw new AdministrativeHttpError(
      500,
      'INTERNAL_ERROR',
      'APP_ORIGIN must be configured for administrative mutations.',
    );
  }

  try {
    const url = new URL(configured);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash ||
      url.origin !== configured.replace(/\/$/, '')
    ) {
      throw new Error('Invalid origin');
    }
    return url.origin;
  } catch {
    throw new AdministrativeHttpError(
      500,
      'INTERNAL_ERROR',
      'APP_ORIGIN must be a valid HTTP(S) origin without a path, query, or fragment.',
    );
  }
}

export function requireSameOrigin(request: Request) {
  // A valid bearer token authenticates non-browser clients without ambient
  // cookie authority. Cookie-authenticated mutations always require Origin.
  if (request.headers.get('authorization')) return;

  const appOrigin = configuredAppOrigin();
  if (request.headers.get('origin') !== appOrigin) {
    throw new AdministrativeHttpError(
      403,
      'FORBIDDEN',
      'The request origin is not allowed for this change.',
    );
  }
}

export async function requireAdministrativeAccess(
  request: Request,
  permission: string,
  options: { mutation?: boolean; requestId?: string } = {},
): Promise<AdministrativeContext> {
  const requestId = options.requestId ?? crypto.randomUUID();
  const result = await getRequestSession(request);

  if (result.status === 'unauthenticated') {
    throw new AdministrativeHttpError(
      401,
      'UNAUTHENTICATED',
      'Sign in to perform this administrative request.',
    );
  }
  if (result.status === 'forbidden') {
    throw new AdministrativeHttpError(
      403,
      'FORBIDDEN',
      'This account does not have an active profile.',
    );
  }
  if (!result.session.permissions.includes(permission)) {
    throw new AdministrativeHttpError(
      403,
      'FORBIDDEN',
      `Your account does not have the ${permission} permission.`,
    );
  }

  if (options.mutation) {
    requireSameOrigin(request);
    // Validate this before Auth administration or database mutation calls.
    configuredAppOrigin();
  }

  return { requestId, session: result.session, supabase: result.supabase };
}

type BodySchema<Output> = {
  safeParse(input: unknown):
    | { success: true; data: Output }
    | {
        success: false;
        error: { issues: { path: PropertyKey[]; message: string }[] };
      };
};

export async function parseJsonBody<Output>(
  request: Request,
  schema: BodySchema<Output>,
): Promise<Output> {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    throw new AdministrativeHttpError(
      400,
      'VALIDATION_ERROR',
      'The request body must be valid JSON.',
      [{ path: [], message: 'Expected a valid JSON object.' }],
    );
  }

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new AdministrativeHttpError(
      400,
      'VALIDATION_ERROR',
      'The request body contains invalid values.',
      parsed.error.issues.map((issue) => ({
        path: issue.path.map((part) =>
          typeof part === 'number' ? part : String(part),
        ),
        message: issue.message,
      })),
    );
  }
  return parsed.data;
}

export function parseUuid(value: string, label = 'id') {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    throw new AdministrativeHttpError(
      400,
      'VALIDATION_ERROR',
      `The ${label} must be a valid UUID.`,
      [{ path: [label], message: 'Expected a valid UUID.' }],
    );
  }
  return value;
}

export function parsePagination(request: Request) {
  const search = new URL(request.url).searchParams;
  const issues: ApiErrorIssue[] = [];
  let page = 1;
  let perPage = 50;

  for (const key of ['page', 'perPage'] as const) {
    const values = search.getAll(key);
    if (values.length === 0) continue;
    const valid = values.length === 1 && /^\d+$/.test(values[0]);
    const value = valid ? Number(values[0]) : Number.NaN;
    const maximum = key === 'page' ? Number.MAX_SAFE_INTEGER : 100;
    if (!Number.isSafeInteger(value) || value < 1 || value > maximum) {
      issues.push({
        path: [key],
        message:
          key === 'page'
            ? 'Page must be a positive integer.'
            : 'PerPage must be an integer from 1 to 100.',
      });
      continue;
    }
    if (key === 'page') page = value;
    else perPage = value;
  }

  if (issues.length) {
    throw new AdministrativeHttpError(
      400,
      'VALIDATION_ERROR',
      'The pagination parameters are invalid.',
      issues,
    );
  }
  return { page, perPage };
}

export function mapRpcError(caught: {
  code?: string;
  message?: string;
}): AdministrativeHttpError {
  const code = caught.code ?? '';
  const message = caught.message?.toLowerCase() ?? '';

  if (code === '42501') {
    return new AdministrativeHttpError(
      403,
      'FORBIDDEN',
      'Your account cannot perform this administrative change.',
    );
  }
  if (code === 'P0404') {
    return new AdministrativeHttpError(
      404,
      'NOT_FOUND',
      'The requested administrative record was not found.',
    );
  }
  if (code === '22023') {
    return new AdministrativeHttpError(
      400,
      'VALIDATION_ERROR',
      'The request contains invalid identifiers or values.',
    );
  }
  if (code === 'P0409' || code === 'P0001' || code === '23505') {
    if (
      code === 'P0001' ||
      (message.includes('last') && message.includes('admin'))
    ) {
      return new AdministrativeHttpError(
        409,
        'CONFLICT',
        'The last active administrator cannot be deactivated or have the admin role removed.',
      );
    }
    if (message.includes('system')) {
      return new AdministrativeHttpError(
        409,
        'CONFLICT',
        'System roles are read-only.',
      );
    }
    if (
      message.includes('in use') ||
      message.includes('in-use') ||
      message.includes('assigned')
    ) {
      return new AdministrativeHttpError(
        409,
        'CONFLICT',
        'This role is assigned to one or more users and cannot be deleted.',
      );
    }
    if (
      code === '23505' ||
      message.includes('duplicate') ||
      message.includes('already exists')
    ) {
      return new AdministrativeHttpError(
        409,
        'CONFLICT',
        'This value is already in use. Choose a different one and try again.',
      );
    }
    return new AdministrativeHttpError(
      409,
      'CONFLICT',
      'The requested change conflicts with the current administrative state.',
    );
  }

  return new AdministrativeHttpError(
    500,
    'INTERNAL_ERROR',
    'The administrative change could not be completed. Try again.',
  );
}
