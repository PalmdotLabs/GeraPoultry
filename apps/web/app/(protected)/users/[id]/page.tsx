import type { Metadata } from 'next';
import { UserDetailScreen } from '@/components/admin/user-detail-screen';
import { PageHeader } from '@/components/admin/page-header';
import { AdminForbiddenState } from '@/components/admin/admin-states';
import { getAdminAccess } from '@/components/admin/server-access';

export const metadata: Metadata = { title: 'User details | Fieldbook' };

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const access = await getAdminAccess('users.read', `/users/${id}`);

  if (access.status === 'forbidden') {
    return (
      <>
        <PageHeader
          title="User details"
          description="Inspect Auth and profile state, activation, and assigned roles."
        />
        <AdminForbiddenState permission="users.read" />
      </>
    );
  }

  return (
    <UserDetailScreen
      userId={id}
      canManageUsers={access.session.permissions.includes('users.manage')}
      canReadRoles={access.session.permissions.includes('roles.read')}
    />
  );
}
