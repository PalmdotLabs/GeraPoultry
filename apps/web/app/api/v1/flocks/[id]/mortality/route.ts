import { NextResponse } from 'next/server';
import { recordFlockMortalityRequestSchema } from '@poultry/validation';
import {
  AdministrativeHttpError,
  adminResponseHeaders,
  handleApiError,
  mapRpcError,
  parseJsonBody,
  parseUuid,
  requireAdministrativeAccess,
} from '@/lib/server/admin-api';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const requestId = crypto.randomUUID();
  try {
    const { supabase } = await requireAdministrativeAccess(
      request,
      'flocks.mortality.create',
      { requestId, mutation: true },
    );
    const flockId = parseUuid((await context.params).id);
    const input = await parseJsonBody(
      request,
      recordFlockMortalityRequestSchema,
    );
    const { data: id, error } = await supabase.rpc('record_flock_mortality', {
      p_flock_id: flockId,
      p_shed_id: input.shedId,
      p_recorded_date: input.recordedDate,
      p_bird_count: input.birdCount,
      p_remarks: input.remarks ?? '',
      p_submission_id: input.submissionId,
      p_request_id: requestId,
    });
    if (error?.code === 'P0410') {
      throw new AdministrativeHttpError(
        409,
        'CONFLICT',
        'Mortality exceeds the current live bird count in this shed.',
      );
    }
    if (error) throw mapRpcError(error);
    if (!id) throw new Error('Mortality entry did not return an ID.');
    return NextResponse.json(
      { data: { id } },
      { status: 201, headers: adminResponseHeaders },
    );
  } catch (caught) {
    return handleApiError(caught, requestId);
  }
}
