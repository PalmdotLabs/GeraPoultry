import type { Metadata } from 'next';
import { SessionDashboard } from '@/components/session-dashboard';

export const metadata: Metadata = { title: 'Workspace overview | Fieldbook' };

export default function DashboardPage() {
  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">ADMINISTRATION</p>
          <h1>Workspace overview</h1>
          <p>Your account and current access, checked against the server.</p>
        </div>
      </header>
      <SessionDashboard />
    </>
  );
}
