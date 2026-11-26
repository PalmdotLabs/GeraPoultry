import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@poultry/types';
import type { AuditEvent } from '@poultry/validation';

export async function listAdministrativeAuditEvents(
  supabase: SupabaseClient<Database>,
  page: number,
  perPage: number,
) {
  const from = (page - 1) * perPage;
  if (!Number.isSafeInteger(from)) {
    throw new Error('The requested audit offset is too large.');
  }

  const { data, error, count } = await supabase
    .from('audit_events')
    .select(
      'id,actor_id,action,target_type,target_id,request_id,occurred_at,metadata',
      { count: 'exact' },
    )
    .order('occurred_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, from + perPage - 1);
  if (error) throw new Error('Unable to read audit events.');

  const events: AuditEvent[] = data.map((event) => ({
    id: event.id,
    actorId: event.actor_id,
    action: event.action,
    targetType: event.target_type,
    targetId: event.target_id ?? null,
    requestId: event.request_id,
    occurredAt: event.occurred_at,
    metadata:
      event.metadata !== null &&
      typeof event.metadata === 'object' &&
      !Array.isArray(event.metadata)
        ? event.metadata
        : {},
  }));

  return { events, page, perPage, total: count ?? 0 };
}
