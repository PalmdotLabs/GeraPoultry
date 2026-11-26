import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminForbiddenState } from '@/components/admin/admin-states';
import { EggCollectionListScreen } from '@/components/admin/egg-collection-list';
import { PageHeader } from '@/components/admin/page-header';
import { getAdminAccess } from '@/components/admin/server-access';

export const metadata: Metadata = { title: 'Egg collection | Fieldbook' };

export default async function EggCollectionsPage() {
  const access = await getAdminAccess(
    ['eggs.collection.read', 'eggs.collection.create'],
    '/egg-collections',
  );
  const permissions =
    access.status === 'allowed' ? access.session.permissions : [];
  const canReadSetup = permissions.includes('farm.setup.read');
  const canRecord = permissions.includes('eggs.collection.create');

  return (
    <>
      <PageHeader
        title="Egg collection"
        description="Review production by date, shed, shift, grade, and quality."
        actions={
          canRecord && canReadSetup ? (
            <Link className="button button-primary" href="/egg-collections/new">
              Record collection
            </Link>
          ) : undefined
        }
      />
      {canRecord && !canReadSetup && (
        <p className="form-message form-error" role="alert">
          Recording collections requires access to shed and egg grade setup.
        </p>
      )}
      {permissions.includes('eggs.collection.read') ? (
        <EggCollectionListScreen canReadSetup={canReadSetup} />
      ) : access.status === 'forbidden' ? (
        <AdminForbiddenState />
      ) : (
        <p className="admin-empty">
          Viewing collections requires collection read access.
        </p>
      )}
    </>
  );
}
