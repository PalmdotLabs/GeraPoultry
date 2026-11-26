import { NextResponse } from 'next/server';
import { updateRoleRequestSchema } from '@poultry/validation';
import {
  adminResponseHeaders,
  handleApiError,
  parseJsonBody,
  parseUuid,
  requireAdministrativeAccess,
} from '@/lib/server/admin-api';
import {
  deleteAdministrativeRole,
  updateAdministrativeRole,
} from '@/lib/server/admin-roles';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const requestId = crypto.randomUUID();
  try {
    const { supabase } = await requireAdministrativeAccess(
      request,
      'roles.manage',
      {
        mutation: true,
        requestId,
      },
    );
    const roleId = parseUuid((await context.params).id);
    const input = await parseJsonBody(request, updateRoleRequestSchema);
    const role = await updateAdministrativeRole(supabase, roleId, input);
    return NextResponse.json(
      { data: { role } },
      { headers: adminResponseHeaders },
    );
  } catch (caught) {
    return handleApiError(caught, requestId);
  }
}

export async function DELETE(request: Request, context: Context) {
  const requestId = crypto.randomUUID();
  try {
    const { supabase } = await requireAdministrativeAccess(
      request,
      'roles.manage',
      {
        mutation: true,
        requestId,
      },
    );
    const roleId = parseUuid((await context.params).id);
    const data = await deleteAdministrativeRole(supabase, roleId);
    return NextResponse.json({ data }, { headers: adminResponseHeaders });
  } catch (caught) {
    return handleApiError(caught, requestId);
  }
}
