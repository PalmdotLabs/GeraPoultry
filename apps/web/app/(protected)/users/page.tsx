import type { Metadata } from 'next';
import { UsersScreen } from '@/components/admin/users-screen';
import { PageHeader } from '@/components/admin/page-header';
import { AdminForbiddenState } from '@/components/admin/admin-states';
import { getAdminAccess } from '@/components/admin/server-access';

export const metadata: Metadata = { title: 'Users | Fieldbook' };

export default async function UsersPage() {
  const access = await getAdminAccess('users.read', '/users');

  if (access.status === 'forbidden') {
    return (
      <>
        <PageHeader
          title="Users"
          description="Review Auth identity, profile access, invitations, and assigned roles."
        />
        <AdminForbiddenState permission="users.read" />
      </>
    );
  }

  return (
    <UsersScreen
      canManage={access.session.permissions.includes('users.manage')}
    />
  );
}
