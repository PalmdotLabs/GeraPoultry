'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { adminApi, type AdminUserList } from './admin-api';
import { AdminTimestamp } from './format';
import { PageHeader } from './page-header';
import { Pagination } from './pagination';
import {
  AdminErrorState,
  AdminForbiddenState,
  AdminLoadingState,
} from './admin-states';
import { useAdminData } from './use-admin-data';

const PAGE_SIZE = 50;

export function UsersScreen({ canManage }: { canManage: boolean }) {
  const [page, setPage] = useState(1);
  const load = useCallback(
    (signal: AbortSignal) =>
      adminApi.listUsers({ page, perPage: PAGE_SIZE, signal }),
    [page],
  );
  const { data, loading, error, terminalStatus, reload } =
    useAdminData<AdminUserList>(load, '/users');

  return (
    <>
      <PageHeader
        title="Users"
        description="Review Auth identity, profile access, invitations, and assigned roles."
        actions={
          canManage ? (
            <Link className="button button-primary" href="/users/invite">
              Invite user
            </Link>
          ) : undefined
        }
      />

      {terminalStatus === 'forbidden' ? (
        <AdminForbiddenState permission="users.read" />
      ) : null}
      {terminalStatus === 'redirecting' ? (
        <AdminLoadingState
          title="Your session has expired"
          description="Taking you to sign in before returning to Users."
          redirecting
        />
      ) : null}
      {terminalStatus === null && loading ? (
        <AdminLoadingState title="Loading users" />
      ) : null}
      {terminalStatus === null && !loading && (error || !data) ? (
        <AdminErrorState
          title="Users unavailable"
          message={error ?? 'The user list could not be loaded.'}
          onRetry={reload}
        />
      ) : null}

      {terminalStatus === null && !loading && data ? (
        <section className="admin-panel" aria-labelledby="users-list-heading">
          <div className="admin-panel-heading">
            <div>
              <h2 id="users-list-heading">User directory</h2>
              <p>
                Accounts are ordered by email and ID, exactly as returned by the
                server.
              </p>
            </div>
          </div>

          {data.users.length === 0 ? (
            <div className="admin-empty" role="status">
              <h3>No users found</h3>
              <p>
                There are no accounts on this page. Return to the first page or
                invite a user if you have management access.
              </p>
              {page > 1 ? (
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => setPage(1)}
                >
                  Return to first page
                </button>
              ) : null}
            </div>
          ) : (
            <>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <caption className="sr-only">
                    Administrative users, page {data.page}
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">User</th>
                      <th scope="col">Profile</th>
                      <th scope="col">Invitation and confirmation</th>
                      <th scope="col">Last sign-in</th>
                      <th scope="col">Roles</th>
                      <th scope="col">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.users.map((user) => (
                      <tr key={user.id}>
                        <th scope="row">
                          <Link
                            className="admin-user-link"
                            href={`/users/${user.id}`}
                          >
                            {user.displayName}
                          </Link>
                          <span className="admin-secondary-text">
                            {user.email ?? 'No email recorded'}
                          </span>
                        </th>
                        <td>
                          <span
                            className={`admin-badge ${user.isActive ? 'admin-badge-active' : 'admin-badge-inactive'}`}
                          >
                            {user.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          <ul className="admin-event-list">
                            <li>
                              {user.invitedAt ? (
                                <>
                                  Invited{' '}
                                  <AdminTimestamp value={user.invitedAt} />
                                </>
                              ) : (
                                'No invitation recorded'
                              )}
                            </li>
                            <li>
                              {user.emailConfirmedAt ? (
                                <>
                                  Email confirmed{' '}
                                  <AdminTimestamp
                                    value={user.emailConfirmedAt}
                                  />
                                </>
                              ) : user.invitedAt ? (
                                'Invitation awaiting confirmation'
                              ) : (
                                'Email not confirmed'
                              )}
                            </li>
                          </ul>
                        </td>
                        <td>
                          {user.lastSignInAt ? (
                            <AdminTimestamp value={user.lastSignInAt} />
                          ) : (
                            'Never'
                          )}
                        </td>
                        <td>
                          {user.roles.length ? (
                            <ul
                              className="role-list admin-role-list"
                              aria-label={`Roles assigned to ${user.displayName}`}
                            >
                              {user.roles.map((role) => (
                                <li key={role.id}>
                                  <span>{role.name}</span>
                                  <code>{role.code}</code>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="admin-secondary-text">
                              No roles assigned
                            </span>
                          )}
                        </td>
                        <td>
                          <Link
                            className="text-link"
                            href={`/users/${user.id}`}
                            aria-label={`View ${user.displayName}`}
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                label="User pages"
                page={data.page}
                perPage={data.perPage}
                total={data.total}
                busy={loading}
                onPageChange={setPage}
              />
            </>
          )}
        </section>
      ) : null}
    </>
  );
}
