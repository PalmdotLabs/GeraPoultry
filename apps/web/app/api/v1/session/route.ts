import type { ApiErrorCode, ApiErrorResponse } from '@poultry/validation';
import { NextResponse } from 'next/server';
import { getRequestSession } from '@/lib/server/session-context';

export const dynamic = 'force-dynamic';

const responseHeaders = { 'Cache-Control': 'private, no-store' };

function errorResponse(
  status: number,
  code: ApiErrorCode,
  message: string,
  requestId: string,
) {
  const body: ApiErrorResponse = {
    error: { code, message, requestId },
  };

  return NextResponse.json(body, { status, headers: responseHeaders });
}

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();

  try {
    const result = await getRequestSession(request);

    if (result.status === 'unauthenticated') {
      return errorResponse(
        401,
        'UNAUTHENTICATED',
        'Sign in to access this session.',
        requestId,
      );
    }

    if (result.status === 'forbidden') {
      return errorResponse(
        403,
        'FORBIDDEN',
        'This account does not have an active profile.',
        requestId,
      );
    }

    return NextResponse.json(
      { data: result.session },
      { status: 200, headers: responseHeaders },
    );
  } catch {
    return errorResponse(
      500,
      'INTERNAL_ERROR',
      'The session could not be loaded. Try again.',
      requestId,
    );
  }
}
