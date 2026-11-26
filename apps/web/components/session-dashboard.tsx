'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiClientError, createApiClient } from '@poultry/api-client';
import type { Session } from '@poultry/validation';

const apiClient = createApiClient({ credentials: 'same-origin' });

export function SessionDashboard() {
  const router = useRouter();
  const terminalErrorHandled = useRef(false);
  const [session, setSession] = useState<Session | null>(null);
  const [revision, setRevision] = useState(0);
  const request = useMemo(() => ({ revision, router }), [revision, router]);
  const [settlement, setSettlement] = useState<{
    request: object;
    error: string | null;
  } | null>(null);
  const loading = settlement?.request !== request;
  const error = settlement?.request === request ? settlement.error : null;
  const retry = useCallback(() => {
    setRevision((current) => current + 1);
  }, []);

  useEffect(() => {
    let active = true;

    async function loadSession() {
      try {
        const currentSession = await apiClient.getSession();
        if (!active) return;
        setSession(currentSession);
        setSettlement({ request, error: null });
      } catch (caught) {
        if (!active) return;

        if (
          caught instanceof ApiClientError &&
          (caught.status === 401 || caught.status === 403)
        ) {
          setSession(null);

          if (!terminalErrorHandled.current) {
            terminalErrorHandled.current = true;
            if (caught.status === 401) {
              request.router.replace('/login?next=%2Fdashboard');
            } else {
              request.router.refresh();
            }
          }
          return;
        }

        setSession(null);
        setSettlement({
          request,
          error:
            caught instanceof ApiClientError
              ? caught.message
              : 'Your session details could not be loaded. Try again.',
        });
      }
    }

    void loadSession();
    return () => {
      active = false;
    };
  }, [request]);

  if (loading) {
    return (
      <section className="session-state" aria-busy="true" role="status">
        <span className="loading-indicator" aria-hidden="true" />
        <div>
          <h2>Loading your access</h2>
          <p>Checking the latest account and permission details.</p>
        </div>
      </section>
    );
  }

  if (error || !session) {
    return (
      <section className="session-state session-error" role="alert">
        <div>
          <h2>Session details unavailable</h2>
          <p>{error ?? 'Your session details could not be loaded.'}</p>
        </div>
        <button
          className="button button-secondary"
          type="button"
          onClick={retry}
        >
          Try again
        </button>
      </section>
    );
  }

  return (
    <div className="dashboard-stack">
      <section className="identity-card" aria-labelledby="identity-heading">
        <div className="identity-heading">
          <div className="avatar" aria-hidden="true">
            {session.user.displayName.trim().charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="eyebrow">SIGNED-IN ACCOUNT</p>
            <h2 id="identity-heading">{session.user.displayName}</h2>
            <p>
              {session.user.email ??
                'No email address is associated with this account.'}
            </p>
          </div>
          <span className="status-badge">Active</span>
        </div>
        <dl className="access-details">
          <div>
            <dt>Roles</dt>
            <dd>
              {session.roles.length ? (
                <ul className="role-list" aria-label="Assigned roles">
                  {session.roles.map((role) => (
                    <li key={role.code}>
                      <span>{role.name}</span>
                      <code>{role.code}</code>
                    </li>
                  ))}
                </ul>
              ) : (
                'No roles are assigned.'
              )}
            </dd>
          </div>
          <div>
            <dt>Permissions</dt>
            <dd>
              {session.permissions.length ? (
                <ul
                  className="permission-list"
                  aria-label="Effective permissions"
                >
                  {session.permissions.map((permission) => (
                    <li key={permission}>{permission}</li>
                  ))}
                </ul>
              ) : (
                'No effective permissions.'
              )}
            </dd>
          </div>
        </dl>
      </section>

      <section className="setup-card" aria-labelledby="setup-heading">
        <div className="setup-icon" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="m5 12 4 4L19 6" />
          </svg>
        </div>
        <div>
          <p className="eyebrow">WORKSPACE STATUS</p>
          <h2 id="setup-heading">Identity and access are ready</h2>
          <p>
            Your access comes from the live server session. Operational areas
            have not been configured, so there are no farm records or reports to
            show here yet.
          </p>
        </div>
      </section>
    </div>
  );
}
