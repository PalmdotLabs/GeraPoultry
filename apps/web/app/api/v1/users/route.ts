import { NextResponse } from 'next/server';
import { inviteUserRequestSchema } from '@poultry/validation';
import {
  adminResponseHeaders,
  handleApiError,
  parseJsonBody,
  parsePagination,
  requireAdministrativeAccess,
} from '@/lib/server/admin-api';
import {
  inviteAdministrativeUser,
  listAdministrativeUsers,
} from '@/lib/server/admin-users';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const { supabase } = await requireAdministrativeAccess(
      request,
      'users.read',
      { requestId },
    );
    const { page, perPage } = parsePagination(request);
    const data = await listAdministrativeUsers(supabase, page, perPage);
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
      'users.manage',
      {
        mutation: true,
        requestId,
      },
    );
    const input = await parseJsonBody(request, inviteUserRequestSchema);
    const user = await inviteAdministrativeUser(supabase, input, requestId);
    return NextResponse.json(
      { data: { user } },
      { status: 201, headers: adminResponseHeaders },
    );
  } catch (caught) {
    return handleApiError(caught, requestId);
  }
}
