import { NextResponse } from 'next/server';
import { setUserActiveRequestSchema } from '@poultry/validation';
import {
  adminResponseHeaders,
  handleApiError,
  parseJsonBody,
  parseUuid,
  requireAdministrativeAccess,
} from '@/lib/server/admin-api';
import {
  getAdministrativeUser,
  setAdministrativeUserActive,
} from '@/lib/server/admin-users';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  const requestId = crypto.randomUUID();
  try {
    const { supabase } = await requireAdministrativeAccess(
      request,
      'users.read',
      { requestId },
    );
    const userId = parseUuid((await context.params).id);
    const user = await getAdministrativeUser(supabase, userId);
    return NextResponse.json(
      { data: { user } },
      { headers: adminResponseHeaders },
    );
  } catch (caught) {
    return handleApiError(caught, requestId);
  }
}

export async function PATCH(request: Request, context: Context) {
  const requestId = crypto.randomUUID();
  try {
    const { supabase } = await requireAdministrativeAccess(
      request,
      'users.manage',
      {
        mutation: true,
        requestId,
      },
    );
    const userId = parseUuid((await context.params).id);
    const input = await parseJsonBody(request, setUserActiveRequestSchema);
    const user = await setAdministrativeUserActive(
      supabase,
      userId,
      input.isActive,
    );
    return NextResponse.json(
      { data: { user } },
      { headers: adminResponseHeaders },
    );
  } catch (caught) {
    return handleApiError(caught, requestId);
  }
}
