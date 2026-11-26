import { redirect } from 'next/navigation';
import type { Session } from '@poultry/validation';
import { getCookieSession } from '@/lib/server/session-context';

export type AdminPermission =
  | 'users.read'
  | 'users.manage'
  | 'roles.read'
  | 'roles.manage'
  | 'audit.read'
  | 'farm.setup.read'
  | 'flocks.read'
  | 'flocks.create'
  | 'eggs.collection.read'
  | 'eggs.collection.create';

export type AdminAccess =
  { status: 'allowed'; session: Session } | { status: 'forbidden' };

export async function getAdminAccess(
  permission: AdminPermission | readonly AdminPermission[],
  destination: string,
): Promise<AdminAccess> {
  const result = await getCookieSession();

  if (result.status === 'unauthenticated') {
    redirect(`/login?next=${encodeURIComponent(destination)}`);
  }

  const allowedPermissions =
    typeof permission === 'string' ? [permission] : permission;
  if (
    result.status === 'forbidden' ||
    !allowedPermissions.some((code) =>
      result.session.permissions.includes(code),
    )
  ) {
    return { status: 'forbidden' };
  }

  return { status: 'allowed', session: result.session };
}
