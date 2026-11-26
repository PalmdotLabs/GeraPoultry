import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminForbiddenState } from '@/components/admin/admin-states';
import { EggCollectionForm } from '@/components/admin/egg-collection-form';
import { PageHeader } from '@/components/admin/page-header';
import { getAdminAccess } from '@/components/admin/server-access';

export const metadata: Metadata = {
  title: 'Record egg collection | Fieldbook',
};

export default async function RecordEggCollectionPage() {
  const access = await getAdminAccess(
    'eggs.collection.create',
    '/egg-collections/new',
  );
  const session = access.status === 'allowed' ? access.session : null;

  return (
    <>
      <PageHeader
        title="Record egg collection"
        description="Enter the tray and loose egg counts for a single shed, shift, and grade."
        actions={
          <Link className="button button-secondary" href="/egg-collections">
            Back to collections
          </Link>
        }
      />
      {session?.permissions.includes('farm.setup.read') ? (
        <EggCollectionForm
          canReadFlocks={session.permissions.includes('flocks.read')}
          canManageSetup={session.roles.some(({ code }) => code === 'admin')}
        />
      ) : (
        <AdminForbiddenState
          permission={session ? 'farm.setup.read' : 'eggs.collection.create'}
        />
      )}
    </>
  );
}
