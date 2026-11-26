import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminForbiddenState } from '@/components/admin/admin-states';
import { FlockArrivalForm } from '@/components/admin/flock-arrival-form';
import { PageHeader } from '@/components/admin/page-header';
import { getAdminAccess } from '@/components/admin/server-access';

export const metadata: Metadata = { title: 'Register flock | Fieldbook' };

export default async function RegisterFlockPage() {
  const access = await getAdminAccess('flocks.create', '/flocks/new');
  const canReadSetup =
    access.status === 'allowed' &&
    access.session.permissions.includes('farm.setup.read');
  const canManageSetup =
    access.status === 'allowed' &&
    access.session.roles.some(({ code }) => code === 'admin');

  return (
    <>
      <PageHeader
        title="Register flock"
        description="Record the batch arrival and allocate every housed bird to a shed."
        actions={
          <Link className="button button-secondary" href="/flocks">
            Back to flocks
          </Link>
        }
      />
      {canReadSetup ? (
        <FlockArrivalForm canManageSetup={canManageSetup} />
      ) : (
        <AdminForbiddenState
          permission={
            access.status === 'forbidden' ? 'flocks.create' : 'farm.setup.read'
          }
        />
      )}
    </>
  );
}
