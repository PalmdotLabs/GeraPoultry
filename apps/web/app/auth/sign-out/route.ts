import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: 'local' });

  const login = new URL('/login', request.url);
  login.searchParams.set('signedOut', '1');
  return NextResponse.redirect(login, {
    status: 303,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
