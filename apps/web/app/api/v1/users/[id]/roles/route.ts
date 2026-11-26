import { NextResponse } from 'next/server';
import { setUserRolesRequestSchema } from '@poultry/validation';
import {
  adminResponseHeaders,
  handleApiError,
  parseJsonBody,
  parseUuid,
  requireAdministrativeAccess,
} from '@/lib/server/admin-api';
import { setAdministrativeUserRoles } from '@/lib/server/admin-users';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
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
    const input = await parseJsonBody(request, setUserRolesRequestSchema);
    const user = await setAdministrativeUserRoles(
      supabase,
      userId,
      input.roleIds,
    );
    return NextResponse.json(
      { data: { user } },
      { headers: adminResponseHeaders },
    );
  } catch (caught) {
    return handleApiError(caught, requestId);
  }
}
