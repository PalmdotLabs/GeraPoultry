import { NextResponse } from 'next/server';
import { safeLocalDestination } from '@/lib/navigation';
import { verifyAuthCallback } from '@/lib/auth-callback';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const destination = safeLocalDestination(
    url.searchParams.get('next'),
    '/reset-password',
  );
  const failure = new URL('/reset-password', url.origin);
  failure.searchParams.set('error', 'recovery');

  const supabase = await createSupabaseServerClient();
  let verified = false;
  try {
    verified = await verifyAuthCallback(url.searchParams, supabase.auth);
  } catch {
    // Auth transport failures must not leak callback credentials or claim success.
  }
  if (!verified) {
    return NextResponse.redirect(failure, {
      status: 303,
      headers: {
        'Cache-Control': 'private, no-store',
        'Referrer-Policy': 'no-referrer',
      },
    });
  }

  return NextResponse.redirect(new URL(destination, url.origin), {
    status: 303,
    headers: {
      'Cache-Control': 'private, no-store',
      'Referrer-Policy': 'no-referrer',
    },
  });
}
