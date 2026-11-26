import { NextResponse } from 'next/server';
import { createRoleRequestSchema } from '@poultry/validation';
import {
  adminResponseHeaders,
  handleApiError,
  parseJsonBody,
  requireAdministrativeAccess,
} from '@/lib/server/admin-api';
import {
  createAdministrativeRole,
  listAdministrativeRoles,
} from '@/lib/server/admin-roles';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const { supabase } = await requireAdministrativeAccess(
      request,
      'roles.read',
      { requestId },
    );
    const data = await listAdministrativeRoles(supabase);
    return NextResponse.json({ data }, { headers: adminResponseHeaders });
  } catch (caught) {
    return handleApiError(caught, requestId);
  }
}

export async function POST(request: Request) {
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
    const input = await parseJsonBody(request, createRoleRequestSchema);
    const role = await createAdministrativeRole(supabase, input);
    return NextResponse.json(
      { data: { role } },
      { status: 201, headers: adminResponseHeaders },
    );
  } catch (caught) {
    return handleApiError(caught, requestId);
  }
}
