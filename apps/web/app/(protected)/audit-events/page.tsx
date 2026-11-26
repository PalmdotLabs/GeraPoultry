import type { Metadata } from 'next';
import { AuditEventsScreen } from '@/components/admin/audit-events-screen';
import { PageHeader } from '@/components/admin/page-header';
import { AdminForbiddenState } from '@/components/admin/admin-states';
import { getAdminAccess } from '@/components/admin/server-access';

export const metadata: Metadata = { title: 'Audit events | Fieldbook' };

export default async function AuditEventsPage() {
  const access = await getAdminAccess('audit.read', '/audit-events');

  if (access.status === 'forbidden') {
    return (
      <>
        <PageHeader
          title="Audit events"
          description="Inspect read-only server-recorded administration events and JSON metadata."
        />
        <AdminForbiddenState permission="audit.read" />
      </>
    );
  }

  return <AuditEventsScreen />;
}
