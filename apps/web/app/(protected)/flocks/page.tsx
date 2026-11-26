import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminForbiddenState } from '@/components/admin/admin-states';
import { FlockListScreen } from '@/components/admin/flock-list-screen';
import { PageHeader } from '@/components/admin/page-header';
import { getAdminAccess } from '@/components/admin/server-access';

export const metadata: Metadata = { title: 'Flocks | Fieldbook' };

export default async function FlocksPage() {
  const access = await getAdminAccess(
    ['flocks.read', 'flocks.create'],
    '/flocks',
  );

  if (access.status === 'forbidden') {
    return (
      <>
        <PageHeader
          title="Flocks"
          description="Flock arrivals and initial shed placements."
        />
        <AdminForbiddenState />
      </>
    );
  }

  const { permissions } = access.session;
  const canRead = permissions.includes('flocks.read');
  const canCreate = permissions.includes('flocks.create');
  const canReadSetup = permissions.includes('farm.setup.read');

  return (
    <>
      <PageHeader
        title="Flocks"
        description="Flock arrivals and initial shed placements."
        actions={
          canCreate && canReadSetup ? (
            <Link className="button button-primary" href="/flocks/new">
              Register flock
            </Link>
          ) : undefined
        }
      />
      {canCreate && !canReadSetup && (
        <p className="form-message form-error" role="alert">
          Registering flocks requires access to shed and breed setup.
        </p>
      )}
      {canRead ? (
        <FlockListScreen canReadSetup={canReadSetup} />
      ) : (
        <p className="admin-empty">
          Viewing registrations requires flock read access.
        </p>
      )}
    </>
  );
}
