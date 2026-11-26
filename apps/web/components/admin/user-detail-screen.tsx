'use client';

import { useCallback, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ApiClientError } from '@poultry/api-client';
import { adminApi, type AdminRoleCatalog, type AdminUser } from './admin-api';
import { AdminTimestamp } from './format';
import { PageHeader } from './page-header';
import {
  AdminErrorState,
  AdminForbiddenState,
  AdminLoadingState,
} from './admin-states';
import { useAdminData } from './use-admin-data';

interface UserDetailData {
  user: AdminUser;
  catalog: AdminRoleCatalog | null;
}

interface UserDetailScreenProps {
  userId: string;
  canManageUsers: boolean;
  canReadRoles: boolean;
}

function MutationMessage({
  error,
  conflict,
  success,
  onReload,
}: {
  error: string | null;
  conflict: boolean;
  success: string | null;
  onReload: () => void;
}) {
  return (
    <>
      {error ? (
        <div className="form-message form-error" role="alert">
          <p>{error}</p>
          {conflict ? (
            <>
              <p>
                The server rejected the change. Reload the current state before
                trying again; final-admin and other integrity safeguards remain
                authoritative.
              </p>
              <button
                className="text-link admin-inline-button"
                type="button"
                onClick={onReload}
              >
                Reload current user
              </button>
            </>
          ) : null}
        </div>
      ) : null}
      {success ? (
        <p className="form-message form-success" role="status">
          {success}
        </p>
      ) : null}
    </>
  );
}

export function UserDetailScreen({
  userId,
  canManageUsers,
  canReadRoles,
}: UserDetailScreenProps) {
  const includeCatalog = canManageUsers && canReadRoles;
  const load = useCallback(
    async (signal: AbortSignal): Promise<UserDetailData> => {
      const [user, catalog] = await Promise.all([
        adminApi.getUser(userId, { signal }),
        includeCatalog ? adminApi.listRoles({ signal }) : Promise.resolve(null),
      ]);
      return { user, catalog };
    },
    [includeCatalog, userId],
  );
  const { data, setData, loading, error, terminalStatus, reload, handleError } =
    useAdminData<UserDetailData>(load, `/users/${userId}`);

  const [active, setActive] = useState(false);
  const [activeDirty, setActiveDirty] = useState(false);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [rolesDirty, setRolesDirty] = useState(false);
  const [pending, setPending] = useState<'active' | 'roles' | null>(null);
  const [confirmingDeactivation, setConfirmingDeactivation] = useState(false);
  const [activeError, setActiveError] = useState<string | null>(null);
  const [activeConflict, setActiveConflict] = useState(false);
  const [activeSuccess, setActiveSuccess] = useState<string | null>(null);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const [rolesConflict, setRolesConflict] = useState(false);
  const [rolesSuccess, setRolesSuccess] = useState<string | null>(null);
  const [loadedDraftData, setLoadedDraftData] = useState<UserDetailData | null>(
    null,
  );

  if (data !== loadedDraftData) {
    const isDifferentUser = data?.user.id !== loadedDraftData?.user.id;
    setLoadedDraftData(data);
    if (data && (isDifferentUser || !activeDirty)) {
      setActive(data.user.isActive);
    }
    if (data && (isDifferentUser || !rolesDirty)) {
      setSelectedRoleIds(data.user.roles.map((role) => role.id));
    }
  }

  function reloadDetails() {
    setActiveDirty(false);
    setRolesDirty(false);
    setConfirmingDeactivation(false);
    setActiveError(null);
    setActiveConflict(false);
    setActiveSuccess(null);
    setRolesError(null);
    setRolesConflict(false);
    setRolesSuccess(null);
    reload();
  }

  async function saveActive() {
    if (!data || pending || !activeDirty) return;

    setPending('active');
    setActiveError(null);
    setActiveConflict(false);
    setActiveSuccess(null);
    try {
      const user = await adminApi.setUserActive(data.user.id, {
        isActive: active,
      });
      setData((current) => (current ? { ...current, user } : current));
      setActiveDirty(false);
      setConfirmingDeactivation(false);
      setActiveSuccess(
        user.isActive
          ? 'The user profile is active.'
          : 'The user profile is inactive. Their assigned roles were not changed.',
      );
    } catch (caught) {
      setActiveConflict(
        caught instanceof ApiClientError && caught.status === 409,
      );
      setActiveError(
        handleError(
          caught,
          'The active status could not be saved. Try again.',
          { source: 'mutation' },
        ),
      );
    } finally {
      setPending(null);
    }
  }

  function submitActive(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!active) {
      setConfirmingDeactivation(true);
      return;
    }
    void saveActive();
  }

  async function saveRoles(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data || pending || !rolesDirty || !includeCatalog) return;

    setPending('roles');
    setRolesError(null);
    setRolesConflict(false);
    setRolesSuccess(null);
    try {
      const user = await adminApi.setUserRoles(data.user.id, {
        roleIds: selectedRoleIds,
      });
      setData((current) => (current ? { ...current, user } : current));
      setRolesDirty(false);
      setRolesSuccess(
        user.roles.length
          ? 'The assigned roles were saved.'
          : 'All role assignments were removed.',
      );
    } catch (caught) {
      setRolesConflict(
        caught instanceof ApiClientError && caught.status === 409,
      );
      setRolesError(
        handleError(
          caught,
          'The role assignments could not be saved. Try again.',
          { source: 'mutation' },
        ),
      );
    } finally {
      setPending(null);
    }
  }

  const canEditRoles = includeCatalog && Boolean(data?.catalog);

  return (
    <>
      <PageHeader
        title={data?.user.displayName ?? 'User details'}
        description="Inspect Auth and profile state, then save activation and role assignments independently."
        actions={
          <Link className="button button-secondary" href="/users">
            Back to users
          </Link>
        }
      />

      {terminalStatus === 'forbidden' ? (
        <AdminForbiddenState permission="users.read" />
      ) : null}
      {terminalStatus === 'redirecting' ? (
        <AdminLoadingState
          title="Your session has expired"
          description="Taking you to sign in before returning to this user."
          redirecting
        />
      ) : null}
      {terminalStatus === null && loading ? (
        <AdminLoadingState title="Loading user details" />
      ) : null}
      {terminalStatus === null && !loading && (error || !data) ? (
        <AdminErrorState
          title="User details unavailable"
          message={error ?? 'The current user record could not be loaded.'}
          onRetry={reloadDetails}
        />
      ) : null}

      {terminalStatus === null && !loading && data ? (
        <div className="admin-detail-stack">
          <section
            className="identity-card"
            aria-labelledby="user-identity-heading"
          >
            <div className="identity-heading">
              <div className="avatar" aria-hidden="true">
                {data.user.displayName.trim().charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="eyebrow">USER IDENTITY</p>
                <h2 id="user-identity-heading">{data.user.displayName}</h2>
                <p>{data.user.email ?? 'No email recorded'}</p>
              </div>
              <span
                className={`admin-badge ${data.user.isActive ? 'admin-badge-active' : 'admin-badge-inactive'}`}
              >
                {data.user.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <dl className="admin-detail-grid">
              <div>
                <dt>User ID</dt>
                <dd>
                  <code>{data.user.id}</code>
                </dd>
              </div>
              <div>
                <dt>Created</dt>
                <dd>
                  <AdminTimestamp value={data.user.createdAt} />
                </dd>
              </div>
              <div>
                <dt>Invited</dt>
                <dd>
                  {data.user.invitedAt ? (
                    <AdminTimestamp value={data.user.invitedAt} />
                  ) : (
                    'Not recorded'
                  )}
                </dd>
              </div>
              <div>
                <dt>Email confirmed</dt>
                <dd>
                  {data.user.emailConfirmedAt ? (
                    <AdminTimestamp value={data.user.emailConfirmedAt} />
                  ) : (
                    'Not confirmed'
                  )}
                </dd>
              </div>
              <div>
                <dt>Last sign-in</dt>
                <dd>
                  {data.user.lastSignInAt ? (
                    <AdminTimestamp value={data.user.lastSignInAt} />
                  ) : (
                    'Never'
                  )}
                </dd>
              </div>
            </dl>
          </section>

          <section
            className="admin-panel"
            aria-labelledby="profile-status-heading"
          >
            <div className="admin-panel-heading">
              <div>
                <h2 id="profile-status-heading">Profile activation</h2>
                <p>
                  Activation is separate from role assignment. Inactive users
                  can be reactivated.
                </p>
              </div>
            </div>
            {canManageUsers ? (
              <form
                className="admin-form"
                method="post"
                onSubmit={submitActive}
              >
                <label className="admin-checkbox">
                  <input
                    type="checkbox"
                    checked={active}
                    disabled={pending !== null || confirmingDeactivation}
                    onChange={(event) => {
                      setActive(event.target.checked);
                      setActiveDirty(true);
                      setActiveError(null);
                      setActiveSuccess(null);
                    }}
                  />
                  <span>
                    <strong>Active profile</strong>
                    <small>
                      Allow this identity to use its assigned access.
                    </small>
                  </span>
                </label>
                <MutationMessage
                  error={activeError}
                  conflict={activeConflict}
                  success={activeSuccess}
                  onReload={reloadDetails}
                />
                {confirmingDeactivation ? (
                  <div className="admin-confirmation" role="alert">
                    <h3>Deactivate this user?</h3>
                    <p>
                      This changes profile access only; it does not delete Auth
                      data or role assignments. The server may refuse a
                      final-admin change.
                    </p>
                    <div className="admin-form-actions">
                      <button
                        className="button button-danger"
                        type="button"
                        disabled={pending !== null}
                        onClick={() => void saveActive()}
                      >
                        {pending === 'active'
                          ? 'Deactivating…'
                          : 'Confirm deactivation'}
                      </button>
                      <button
                        className="button button-secondary"
                        type="button"
                        disabled={pending !== null}
                        onClick={() => setConfirmingDeactivation(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="admin-form-actions">
                    <button
                      className="button button-primary"
                      type="submit"
                      disabled={pending !== null || !activeDirty}
                    >
                      {pending === 'active'
                        ? 'Saving status…'
                        : 'Save active status'}
                    </button>
                    {activeDirty ? (
                      <span className="admin-secondary-text">
                        Unsaved activation change
                      </span>
                    ) : null}
                  </div>
                )}
              </form>
            ) : (
              <p className="supporting-copy">
                Profile activation is read-only because your account lacks
                users.manage.
              </p>
            )}
          </section>

          <section className="admin-panel" aria-labelledby="user-roles-heading">
            <div className="admin-panel-heading">
              <div>
                <h2 id="user-roles-heading">Assigned roles</h2>
                <p>
                  Role changes have their own save action and do not alter
                  activation.
                </p>
              </div>
            </div>
            {canEditRoles && data.catalog ? (
              <form className="admin-form" method="post" onSubmit={saveRoles}>
                {data.catalog.roles.length ? (
                  <fieldset
                    className="admin-role-fieldset"
                    disabled={pending !== null}
                  >
                    <legend>Available roles</legend>
                    <div className="admin-checkbox-grid">
                      {data.catalog.roles.map((role) => (
                        <label className="admin-checkbox" key={role.id}>
                          <input
                            type="checkbox"
                            checked={selectedRoleIds.includes(role.id)}
                            onChange={(event) => {
                              setSelectedRoleIds((current) =>
                                event.target.checked
                                  ? [
                                      ...current.filter((id) => id !== role.id),
                                      role.id,
                                    ]
                                  : current.filter((id) => id !== role.id),
                              );
                              setRolesDirty(true);
                              setRolesError(null);
                              setRolesSuccess(null);
                            }}
                          />
                          <span>
                            <strong>{role.name}</strong>
                            <small>
                              <code>{role.code}</code>
                              {role.description ? ` · ${role.description}` : ''}
                            </small>
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ) : (
                  <p className="admin-empty">
                    No roles exist yet. An authorized roles.manage administrator
                    must create a role before one can be assigned.
                  </p>
                )}
                <MutationMessage
                  error={rolesError}
                  conflict={rolesConflict}
                  success={rolesSuccess}
                  onReload={reloadDetails}
                />
                <div className="admin-form-actions">
                  <button
                    className="button button-primary"
                    type="submit"
                    disabled={pending !== null || !rolesDirty}
                  >
                    {pending === 'roles'
                      ? 'Saving roles…'
                      : 'Save role assignments'}
                  </button>
                  {rolesDirty ? (
                    <span className="admin-secondary-text">
                      Unsaved role change
                    </span>
                  ) : null}
                </div>
              </form>
            ) : (
              <>
                {data.user.roles.length ? (
                  <ul
                    className="role-list admin-role-list"
                    aria-label="Current assigned roles"
                  >
                    {data.user.roles.map((role) => (
                      <li key={role.id}>
                        <span>{role.name}</span>
                        <code>{role.code}</code>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="admin-empty">
                    No roles are assigned to this user.
                  </p>
                )}
                <p className="supporting-copy">
                  {canManageUsers && !canReadRoles
                    ? 'Role editing also requires roles.read so the complete role catalog can be verified.'
                    : 'Role assignment is read-only because your account lacks users.manage.'}
                </p>
              </>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
