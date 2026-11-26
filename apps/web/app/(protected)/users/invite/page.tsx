import type { Metadata } from 'next';
import { InviteUserForm } from '@/components/admin/invite-user-form';
import { PageHeader } from '@/components/admin/page-header';
import { AdminForbiddenState } from '@/components/admin/admin-states';
import { getAdminAccess } from '@/components/admin/server-access';

export const metadata: Metadata = { title: 'Invite a user | Fieldbook' };

export default async function InviteUserPage() {
  const access = await getAdminAccess('users.manage', '/users/invite');

  if (access.status === 'forbidden') {
    return (
      <>
        <PageHeader
          title="Invite a user"
          description="Send a Supabase email invitation without creating or sharing a plaintext password."
        />
        <AdminForbiddenState permission="users.manage" />
      </>
    );
  }

  return (
    <InviteUserForm
      canReadUsers={access.session.permissions.includes('users.read')}
    />
  );
}
