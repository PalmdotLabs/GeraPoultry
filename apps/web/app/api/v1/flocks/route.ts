import { NextResponse } from 'next/server';
import { createFlockRequestSchema, flockListSchema } from '@poultry/validation';
import {
  AdministrativeHttpError,
  adminResponseHeaders,
  handleApiError,
  mapRpcError,
  parseJsonBody,
  parsePagination,
  requireAdministrativeAccess,
} from '@/lib/server/admin-api';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const { supabase } = await requireAdministrativeAccess(
      request,
      'flocks.read',
      { requestId },
    );
    const { page, perPage } = parsePagination(request);
    const start = (page - 1) * perPage;
    const end = start + perPage - 1;
    if (!Number.isSafeInteger(end)) {
      throw new AdministrativeHttpError(
        400,
        'VALIDATION_ERROR',
        'The page is out of range.',
      );
    }
    const { data, count, error } = await supabase
      .from('flocks')
      .select(
        'id,batchCode:batch_code,breedId:breed_id,arrivalDate:arrival_date,ageAtArrival:age_at_arrival,ageUnit:age_unit,birdsHoused:birds_housed,placements:flock_placements(shedId:shed_id,birdCount:bird_count)',
        { count: 'exact' },
      )
      .order('arrival_date', { ascending: false })
      .order('id')
      .order('shed_id', { referencedTable: 'placements' })
      .range(start, end);
    let total = count;
    if (error) {
      if (error.code !== 'PGRST103') throw mapRpcError(error);
      const remaining = await supabase
        .from('flocks')
        .select('id', { count: 'exact', head: true });
      if (remaining.error) throw mapRpcError(remaining.error);
      total = remaining.count;
    }
    const result = flockListSchema.parse({
      flocks: data ?? [],
      page,
      perPage,
      total,
    });
    return NextResponse.json(
      { data: result },
      { headers: adminResponseHeaders },
    );
  } catch (caught) {
    return handleApiError(caught, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const { supabase } = await requireAdministrativeAccess(
      request,
      'flocks.create',
      { requestId, mutation: true },
    );
    const input = await parseJsonBody(request, createFlockRequestSchema);
    const { data: id, error } = await supabase.rpc('register_flock', {
      p_batch_code: input.batchCode,
      p_breed_id: input.breedId,
      p_arrival_date: input.arrivalDate,
      p_age_at_arrival: input.ageAtArrival,
      p_age_unit: input.ageUnit,
      p_birds_housed: input.birdsHoused,
      p_placements: input.placements,
      p_submission_id: input.submissionId,
      p_request_id: requestId,
    });
    if (error) throw mapRpcError(error);
    if (!id) throw new Error('Flock registration did not return an ID.');
    return NextResponse.json(
      { data: { id } },
      { status: 201, headers: adminResponseHeaders },
    );
  } catch (caught) {
    return handleApiError(caught, requestId);
  }
}
