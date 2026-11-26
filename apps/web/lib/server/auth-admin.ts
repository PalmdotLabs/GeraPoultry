import 'server-only';

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@poultry/types';
import { getSupabaseConfig } from '@/lib/supabase/config';

export function createAuthAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured.');
  }

  const { url } = getSupabaseConfig();
  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}
