import { redirect } from 'next/navigation';
import type { Session } from '@poultry/validation';
import { getCookieSession } from '@/lib/server/session-context';

export type AdminPermission =
  'users.read' | 'users.manage' | 'roles.read' | 'roles.manage' | 'audit.read';

export type AdminAccess =
  { status: 'allowed'; session: Session } | { status: 'forbidden' };

export async function getAdminAccess(
  permission: AdminPermission,
  destination: string,
): Promise<AdminAccess> {
  const result = await getCookieSession();

  if (result.status === 'unauthenticated') {
    redirect(`/login?next=${encodeURIComponent(destination)}`);
  }

  if (
    result.status === 'forbidden' ||
    !result.session.permissions.includes(permission)
  ) {
    return { status: 'forbidden' };
  }

  return { status: 'allowed', session: result.session };
}
