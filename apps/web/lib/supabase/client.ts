'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@poultry/types';
import { getSupabaseConfig, supabaseAuthCookieOptions } from './config';

export function createSupabaseBrowserClient() {
  const { url, publishableKey } = getSupabaseConfig();
  return createBrowserClient<Database>(url, publishableKey, {
    cookieOptions: supabaseAuthCookieOptions,
  });
}
