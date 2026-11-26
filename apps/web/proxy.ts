import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextProxy } from 'next/server';
import type { Database } from '@poultry/types';
import {
  getSupabaseConfig,
  supabaseAuthCookieOptions,
} from '@/lib/supabase/config';

export const proxy: NextProxy = async (request) => {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(
    'x-fieldbook-request-path',
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );

  let response = NextResponse.next({ request: { headers: requestHeaders } });
  const { url, publishableKey } = getSupabaseConfig();
  const supabase = createServerClient<Database>(url, publishableKey, {
    cookieOptions: supabaseAuthCookieOptions,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        requestHeaders.set('cookie', request.headers.get('cookie') ?? '');
        response = NextResponse.next({ request: { headers: requestHeaders } });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
        Object.entries(headers).forEach(([name, value]) => {
          response.headers.set(name, value);
        });
      },
    },
  });

  await supabase.auth.getUser();
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
};

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
