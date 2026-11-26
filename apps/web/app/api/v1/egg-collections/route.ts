import { NextResponse } from 'next/server';
import {
  countCollectedEggs,
  eggCollectionListSchema,
  recordEggCollectionRequestSchema,
} from '@poultry/validation';
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
      'eggs.collection.read',
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
      .from('egg_collections')
      .select(
        'id,collectionDate:collection_date,shedId:shed_id,flockId:flock_id,shift,gradeId:grade_id,goodEggCount:good_egg_count,crackedEggCount:cracked_egg_count,dirtyEggCount:dirty_egg_count,totalEggCount:total_egg_count',
        { count: 'exact' },
      )
      .order('collection_date', { ascending: false })
      .order('id')
      .range(start, end);
    let total = count;
    if (error) {
      if (error.code !== 'PGRST103') throw mapRpcError(error);
      const remaining = await supabase
        .from('egg_collections')
        .select('id', { count: 'exact', head: true });
      if (remaining.error) throw mapRpcError(remaining.error);
      total = remaining.count;
    }
    const result = eggCollectionListSchema.parse({
      collections: data ?? [],
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
      'eggs.collection.create',
      { requestId, mutation: true },
    );
    const input = await parseJsonBody(
      request,
      recordEggCollectionRequestSchema,
    );
    const { data: id, error } = await supabase.rpc('record_egg_collection', {
      p_collection_date: input.collectionDate,
      p_shed_id: input.shedId,
      p_shift: input.shift,
      p_grade_id: input.gradeId,
      p_good_egg_count: countCollectedEggs(input.good),
      p_cracked_egg_count: countCollectedEggs(input.cracked),
      p_dirty_egg_count: countCollectedEggs(input.dirty),
      p_submission_id: input.submissionId,
      p_request_id: requestId,
      ...(input.flockId ? { p_flock_id: input.flockId } : {}),
    });
    if (error) throw mapRpcError(error);
    if (!id) throw new Error('Egg collection did not return an ID.');
    return NextResponse.json(
      { data: { id } },
      { status: 201, headers: adminResponseHeaders },
    );
  } catch (caught) {
    return handleApiError(caught, requestId);
  }
}
