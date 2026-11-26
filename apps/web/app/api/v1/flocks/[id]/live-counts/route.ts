import { NextResponse } from 'next/server';
import { flockLiveCountsSchema } from '@poultry/validation';
import {
  AdministrativeHttpError,
  adminResponseHeaders,
  handleApiError,
  mapRpcError,
  parseUuid,
  requireAdministrativeAccess,
} from '@/lib/server/admin-api';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const requestId = crypto.randomUUID();
  try {
    const { supabase } = await requireAdministrativeAccess(
      request,
      'flocks.read',
      { requestId },
    );
    const flockId = parseUuid((await context.params).id);
    const { data, error } = await supabase
      .from('flock_placements')
      .select(
        'shedId:shed_id,initialBirdCount:bird_count,liveBirdCount:live_bird_count',
      )
      .eq('flock_id', flockId)
      .order('shed_id');
    if (error) throw mapRpcError(error);
    if (!data.length)
      throw new AdministrativeHttpError(
        404,
        'NOT_FOUND',
        'Flock placements not found.',
      );
    const result = flockLiveCountsSchema.parse({ flockId, placements: data });
    return NextResponse.json(
      { data: result },
      { headers: adminResponseHeaders },
    );
  } catch (caught) {
    return handleApiError(caught, requestId);
  }
}
