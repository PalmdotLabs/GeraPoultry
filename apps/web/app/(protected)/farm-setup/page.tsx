import type { Metadata } from 'next';
import { AdminForbiddenState } from '@/components/admin/admin-states';
import { FarmSetupScreen } from '@/components/admin/farm-setup-screen';
import { PageHeader } from '@/components/admin/page-header';
import { getAdminAccess } from '@/components/admin/server-access';

export const metadata: Metadata = { title: 'Farm setup | Fieldbook' };

export default async function FarmSetupPage() {
  const access = await getAdminAccess('farm.setup.read', '/farm-setup');

  return (
    <>
      <PageHeader
        title="Farm setup"
        description="Manage sheds, breeds, and egg grades used in farm records."
      />
      {access.status === 'allowed' ? (
        <FarmSetupScreen
          canCreate={access.session.roles.some(({ code }) => code === 'admin')}
          showEggGrades={access.session.permissions.some(
            (code) =>
              code === 'eggs.collection.create' ||
              code === 'eggs.collection.read',
          )}
        />
      ) : (
        <AdminForbiddenState permission="farm.setup.read" />
      )}
    </>
  );
}
