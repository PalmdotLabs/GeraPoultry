import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { AdminForbiddenState } from '@/components/admin/admin-states';
import { FlockMortalityScreen } from '@/components/admin/flock-mortality-screen';
import { PageHeader } from '@/components/admin/page-header';
import { getCookieSession } from '@/lib/server/session-context';

export const metadata: Metadata = {
  title: 'Flock counts and mortality | Fieldbook',
};

export default async function FlockMortalityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  ) {
    notFound();
  }

  const access = await getCookieSession();
  const path = `/flocks/${id}/mortality`;
  if (access.status === 'unauthenticated')
    redirect(`/login?next=${encodeURIComponent(path)}`);

  const back = (
    <Link className="button button-secondary" href="/flocks">
      Back to flocks
    </Link>
  );
  if (
    access.status === 'forbidden' ||
    !access.session.permissions.includes('flocks.read')
  ) {
    return (
      <>
        <PageHeader
          title="Live bird counts"
          description="Review current bird counts by shed."
          actions={back}
        />
        <AdminForbiddenState permission="flocks.read" />
      </>
    );
  }

  const { data, error } = await access.supabase
    .from('flocks')
    .select('batch_code')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error('Could not load the flock batch.');
  if (!data) notFound();

  return (
    <>
      <PageHeader
        title={`Batch ${data.batch_code}`}
        description="Review live bird counts and record losses by shed."
        actions={back}
      />
      <FlockMortalityScreen
        flockId={id}
        canRecord={access.session.permissions.includes(
          'flocks.mortality.create',
        )}
        canReadSetup={access.session.permissions.includes('farm.setup.read')}
      />
    </>
  );
}
