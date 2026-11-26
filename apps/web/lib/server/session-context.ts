import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@poultry/types';
import { sessionContextSchema, type Session } from '@poultry/validation';
import { getSupabaseConfig } from '@/lib/supabase/config';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export type SessionResolution =
  | {
      status: 'authenticated';
      session: Session;
      supabase: SupabaseClient<Database>;
    }
  | { status: 'unauthenticated' }
  | { status: 'forbidden' };

async function resolveSession(
  supabase: SupabaseClient<Database>,
  accessToken?: string,
): Promise<SessionResolution> {
  const { data, error } = accessToken
    ? await supabase.auth.getUser(accessToken)
    : await supabase.auth.getUser();

  if (error || !data.user) {
    return { status: 'unauthenticated' };
  }

  const { data: context, error: contextError } = await supabase.rpc(
    'get_session_context',
  );
  if (contextError) {
    throw new Error('Unable to load the session context.');
  }

  if (context === null) {
    return { status: 'forbidden' };
  }

  const parsed = sessionContextSchema.safeParse(context);
  if (!parsed.success) {
    throw new Error('The session context did not match the shared contract.');
  }

  return {
    status: 'authenticated',
    supabase,
    session: {
      user: {
        id: data.user.id,
        email: data.user.email ?? null,
        displayName: parsed.data.displayName,
      },
      roles: parsed.data.roles,
      permissions: parsed.data.permissions,
    },
  };
}

export async function getCookieSession(): Promise<SessionResolution> {
  const supabase = await createSupabaseServerClient();
  return resolveSession(supabase);
}

export async function getRequestSession(
  request: Request,
): Promise<SessionResolution> {
  const authorization = request.headers.get('authorization');
  if (!authorization) {
    return getCookieSession();
  }

  const match = /^Bearer\s+([^\s]+)$/i.exec(authorization.trim());
  if (!match) {
    return { status: 'unauthenticated' };
  }

  const accessToken = match[1];
  const { url, publishableKey } = getSupabaseConfig();
  const supabase = createClient<Database>(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });

  return resolveSession(supabase, accessToken);
}
