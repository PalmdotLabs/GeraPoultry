import { redirect } from 'next/navigation';
import { getCookieSession } from '@/lib/server/session-context';

export type RolePageAccess =
  { status: 'allowed'; canManage: boolean } | { status: 'forbidden' };

export async function requireRoleReadAccess(
  destination: string,
): Promise<RolePageAccess> {
  const result = await getCookieSession();

  if (result.status === 'unauthenticated') {
    redirect(`/login?next=${encodeURIComponent(destination)}`);
  }

  if (
    result.status === 'forbidden' ||
    !result.session.permissions.includes('roles.read')
  ) {
    return { status: 'forbidden' };
  }

  return {
    status: 'allowed',
    canManage: result.session.permissions.includes('roles.manage'),
  };
}
