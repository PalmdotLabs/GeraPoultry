import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCookieSession } from '@/lib/server/session-context';
import { safeLocalDestination } from '@/lib/navigation';

function SignOutButton() {
  return (
    <form action="/auth/sign-out" method="post">
      <button className="button button-secondary" type="submit">
        Sign out
      </button>
    </form>
  );
}

function ForbiddenState({ inactive }: { inactive: boolean }) {
  return (
    <main className="state-page">
      <section className="state-card" role="alert">
        <span className="state-code">403</span>
        <p className="eyebrow">ACCESS RESTRICTED</p>
        <h1>
          {inactive
            ? 'This account is not active'
            : 'Administrator access required'}
        </h1>
        <p>
          {inactive
            ? 'Your identity was verified, but its profile is missing or inactive. Contact the workspace administrator before trying again.'
            : 'Your account is active, but it does not have permission to open farm administration. Contact the workspace administrator if you believe this is incorrect.'}
        </p>
        <div className="state-actions">
          <SignOutButton />
          <Link className="text-link" href="/login">
            Return to sign in
          </Link>
        </div>
      </section>
    </main>
  );
}

const navigation = [
  {
    href: '/dashboard',
    label: 'Overview',
    icon: (
      <path d="m4 10 8-6 8 6v9a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z" />
    ),
  },
  {
    href: '/flocks',
    label: 'Flocks',
    permissions: ['flocks.read', 'flocks.create'],
    icon: <path d="M4 7h16M4 12h16M4 17h16M8 5v14m8-14v14" />,
  },
  {
    href: '/egg-collections',
    label: 'Egg collection',
    permissions: ['eggs.collection.read', 'eggs.collection.create'],
    icon: <path d="M18 14a6 6 0 0 1-12 0C6 10 9 4 12 4s6 6 6 10Z" />,
  },
  {
    href: '/farm-setup',
    label: 'Farm setup',
    permission: 'farm.setup.read',
    icon: <path d="M3 10l9-6 9 6M5 9v11h14V9M9 20v-7h6v7" />,
  },
  {
    href: '/users',
    label: 'Users',
    permission: 'users.read',
    icon: (
      <>
        <path d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M19 8v6m3-3h-6" />
      </>
    ),
  },
  {
    href: '/roles',
    label: 'Roles',
    permission: 'roles.read',
    icon: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0M8 8V5m8 3V5" />
      </>
    ),
  },
  {
    href: '/audit-events',
    label: 'Audit history',
    permission: 'audit.read',
    icon: (
      <>
        <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
        <path d="M3 3v5h5m4-1v5l3 2" />
      </>
    ),
  },
];

function AdministrationNavigation({
  permissions,
  path,
}: {
  permissions: string[];
  path: string;
}) {
  return (
    <nav className="rail-nav" aria-label="Administration">
      {navigation
        .filter((item) => {
          const required =
            item.permissions ?? (item.permission ? [item.permission] : []);
          return (
            required.length === 0 ||
            required.some((code) => permissions.includes(code))
          );
        })
        .map((item) => {
          const current =
            path === item.href ||
            (item.href !== '/dashboard' && path.startsWith(`${item.href}/`));
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={current ? 'page' : undefined}
            >
              <span className="nav-icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                >
                  {item.icon}
                </svg>
              </span>
              {item.label}
            </Link>
          );
        })}
      <button type="button" disabled title="Settings are not configured yet">
        <span className="nav-icon" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
          >
            <path d="M4 7h16M4 17h16" />
            <circle cx="9" cy="7" r="2" fill="var(--paper)" />
            <circle cx="15" cy="17" r="2" fill="var(--paper)" />
          </svg>
        </span>
        Settings
        <span className="nav-note">Not configured</span>
      </button>
    </nav>
  );
}

export default async function ProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const result = await getCookieSession();

  if (result.status === 'unauthenticated') {
    const requestHeaders = await headers();
    const destination = safeLocalDestination(
      requestHeaders.get('x-fieldbook-request-path'),
    );
    redirect(`/login?next=${encodeURIComponent(destination)}`);
  }

  if (result.status === 'forbidden') {
    return <ForbiddenState inactive />;
  }

  if (!result.session.permissions.includes('admin.access')) {
    return <ForbiddenState inactive={false} />;
  }

  const requestHeaders = await headers();
  const destination = safeLocalDestination(
    requestHeaders.get('x-fieldbook-request-path'),
  );
  const path = destination.split(/[?#]/, 1)[0];

  return (
    <div className="admin-shell">
      <aside className="side-rail">
        <Link
          className="brand-lockup"
          href="/dashboard"
          aria-label="Fieldbook overview"
        >
          <span className="brand-mark" aria-hidden="true">
            F
          </span>
          <span>Fieldbook</span>
        </Link>
        <p className="rail-label">FARM ADMINISTRATION</p>
        <AdministrationNavigation
          permissions={result.session.permissions}
          path={path}
        />
        <div className="rail-footer">
          <p>Signed in securely</p>
          <SignOutButton />
        </div>
      </aside>
      <main className="admin-main">{children}</main>
    </div>
  );
}
