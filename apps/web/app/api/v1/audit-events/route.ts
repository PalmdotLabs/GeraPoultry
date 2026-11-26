import { NextResponse } from 'next/server';
import {
  adminResponseHeaders,
  handleApiError,
  parsePagination,
  requireAdministrativeAccess,
} from '@/lib/server/admin-api';
import { listAdministrativeAuditEvents } from '@/lib/server/admin-audit';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const { supabase } = await requireAdministrativeAccess(
      request,
      'audit.read',
      { requestId },
    );
    const { page, perPage } = parsePagination(request);
    const data = await listAdministrativeAuditEvents(supabase, page, perPage);
    return NextResponse.json({ data }, { headers: adminResponseHeaders });
  } catch (caught) {
    return handleApiError(caught, requestId);
  }
}
