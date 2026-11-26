import { NextResponse } from 'next/server';
import {
  createFarmSetupRecordRequestSchema,
  farmSetupKindSchema,
} from '@poultry/validation';
import {
  AdministrativeHttpError,
  adminResponseHeaders,
  handleApiError,
  mapRpcError,
  parseJsonBody,
  requireAdministrativeAccess,
} from '@/lib/server/admin-api';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ kind: string }> };

async function farmSetupKind(context: Context) {
  const kind = farmSetupKindSchema.safeParse((await context.params).kind);
  if (!kind.success) {
    throw new AdministrativeHttpError(
      404,
      'NOT_FOUND',
      'Farm setup list not found.',
    );
  }
  return kind.data === 'egg-grades' ? 'egg_grades' : kind.data;
}

export async function GET(request: Request, context: Context) {
  const requestId = crypto.randomUUID();
  try {
    const { supabase } = await requireAdministrativeAccess(
      request,
      'farm.setup.read',
      { requestId },
    );
    const kind = await farmSetupKind(context);
    const { data, error } = await supabase
      .from(kind)
      .select('id,name')
      .order('name')
      .order('id');
    if (error) throw mapRpcError(error);
    return NextResponse.json(
      { data: { records: data } },
      { headers: adminResponseHeaders },
    );
  } catch (caught) {
    return handleApiError(caught, requestId);
  }
}

export async function POST(request: Request, context: Context) {
  const requestId = crypto.randomUUID();
  try {
    const { session, supabase } = await requireAdministrativeAccess(
      request,
      'farm.setup.read',
      { requestId, mutation: true },
    );
    if (!session.roles.some(({ code }) => code === 'admin')) {
      throw new AdministrativeHttpError(
        403,
        'FORBIDDEN',
        'Only administrators can add farm setup records.',
      );
    }
    const kind = await farmSetupKind(context);
    const input = await parseJsonBody(
      request,
      createFarmSetupRecordRequestSchema,
    );
    const { data, error } = await supabase
      .from(kind)
      .insert(input)
      .select('id,name')
      .single();
    if (error) throw mapRpcError(error);
    return NextResponse.json(
      { data: { record: data } },
      { status: 201, headers: adminResponseHeaders },
    );
  } catch (caught) {
    return handleApiError(caught, requestId);
  }
}
