'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useRoleData } from './role-data';
import { getRoleDirectoryAction } from './role-navigation';
import {
  RoleErrorState,
  RoleForbiddenState,
  RoleLoadingState,
  RolePageHeader,
} from './role-ui';

export function RolesScreen({ canManage }: { canManage: boolean }) {
  const { data, loading, error, terminalStatus, reload } =
    useRoleData('/roles');

  const permissionById = useMemo(
    () =>
      new Map(
        data?.permissions.map((permission) => [permission.id, permission]),
      ),
    [data],
  );

  return (
    <>
      <RolePageHeader
        title="Roles"
        description="Review role definitions and their assigned permissions."
        actions={
          canManage ? (
            <Link className="button button-primary" href="/roles/new">
              Create role
            </Link>
          ) : undefined
        }
      />

      {terminalStatus === 'forbidden' ? <RoleForbiddenState /> : null}
      {terminalStatus === 'redirecting' ? (
        <RoleLoadingState
          title="Your session has expired"
          description="Taking you to sign in before returning to Roles."
          redirecting
        />
      ) : null}
      {terminalStatus === null && loading ? <RoleLoadingState /> : null}
      {terminalStatus === null && !loading && (error || !data) ? (
        <RoleErrorState
          title="Roles unavailable"
          message={error ?? 'The role list could not be loaded.'}
          onRetry={reload}
        />
      ) : null}

      {terminalStatus === null && !loading && data ? (
        <div className="dashboard-stack">
          <section className="admin-panel" aria-labelledby="role-list-heading">
            <div className="admin-panel-heading">
              <div>
                <h2 id="role-list-heading">Role directory</h2>
                <p>
                  {data.roles.length}{' '}
                  {data.roles.length === 1 ? 'role' : 'roles'} returned by the
                  server. System roles are always read-only.
                </p>
              </div>
            </div>

            {data.roles.length === 0 ? (
              <div className="admin-empty" role="status">
                <h3>No roles found</h3>
                <p>
                  No roles have been recorded.{' '}
                  {canManage
                    ? 'Create a custom role to begin.'
                    : 'Contact an administrator if you expected to see a role.'}
                </p>
                {canManage ? (
                  <Link className="button button-primary" href="/roles/new">
                    Create role
                  </Link>
                ) : null}
              </div>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <caption className="sr-only">Custom and system roles</caption>
                  <thead>
                    <tr>
                      <th scope="col">Role</th>
                      <th scope="col">Description</th>
                      <th scope="col">Permissions</th>
                      <th scope="col">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.roles.map((role) => {
                      const action = getRoleDirectoryAction(role, canManage);
                      return (
                        <tr key={role.id}>
                          <th scope="row">
                            {role.name}
                            <span className="admin-secondary-text">
                              <code>{role.code}</code>
                            </span>
                            {role.isSystem ? (
                              <span className="admin-badge admin-badge-inactive">
                                System · read-only
                              </span>
                            ) : null}
                          </th>
                          <td>
                            {role.description || (
                              <span className="admin-secondary-text">
                                No description provided
                              </span>
                            )}
                          </td>
                          <td>
                            {role.permissionIds.length ? (
                              <ul
                                className="permission-list"
                                aria-label={`Permissions assigned to ${role.name}`}
                              >
                                {role.permissionIds.map((permissionId) => {
                                  const permission =
                                    permissionById.get(permissionId);
                                  return (
                                    <li
                                      key={permissionId}
                                      title={permission?.description}
                                    >
                                      {permission?.name ??
                                        'Permission details unavailable'}
                                    </li>
                                  );
                                })}
                              </ul>
                            ) : (
                              <span className="admin-secondary-text">
                                No permissions assigned
                              </span>
                            )}
                          </td>
                          <td>
                            <Link
                              className="text-link"
                              href={action.href}
                              aria-label={action.ariaLabel}
                            >
                              {action.label}
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section
            className="admin-panel"
            aria-labelledby="permission-catalog-heading"
          >
            <div className="admin-panel-heading">
              <div>
                <h2 id="permission-catalog-heading">Permission catalog</h2>
                <p>
                  Read-only permission definitions available for custom role
                  assignments.
                </p>
              </div>
            </div>
            {data.permissions.length === 0 ? (
              <div className="admin-empty" role="status">
                <h3>No permissions available</h3>
                <p>The server returned an empty permission catalog.</p>
              </div>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <caption className="sr-only">
                    Available role permissions
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Permission</th>
                      <th scope="col">Code</th>
                      <th scope="col">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.permissions.map((permission) => (
                      <tr key={permission.id}>
                        <th scope="row">{permission.name}</th>
                        <td>
                          <code>{permission.code}</code>
                        </td>
                        <td>
                          {permission.description || (
                            <span className="admin-secondary-text">
                              No description provided
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
