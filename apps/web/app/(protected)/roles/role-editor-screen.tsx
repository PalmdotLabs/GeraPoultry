'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiClientError } from '@poultry/api-client';
import type { Role } from '@poultry/validation';
import { roleApi, useRoleData } from './role-data';
import {
  RoleErrorState,
  RoleForbiddenState,
  RoleLoadingState,
  RolePageHeader,
} from './role-ui';

const ROLE_CODE_PATTERN = /^[a-z][a-z0-9_]{1,39}$/;

interface RoleEditorScreenProps {
  mode: 'create' | 'edit';
  roleId?: string;
  canManage: boolean;
}

export function RoleEditorScreen({
  mode,
  roleId,
  canManage,
}: RoleEditorScreenProps) {
  const router = useRouter();
  const returnTo =
    mode === 'edit'
      ? `/roles/${encodeURIComponent(roleId ?? '')}/edit`
      : '/roles/new';
  const { data, setData, loading, error, terminalStatus, reload, handleError } =
    useRoleData(returnTo);
  const role =
    mode === 'edit'
      ? (data?.roles.find((candidate) => candidate.id === roleId) ?? null)
      : null;

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(
    new Set(),
  );
  const [pending, setPending] = useState<'save' | 'delete' | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [createdRole, setCreatedRole] = useState<Role | null>(null);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const roleDraftKey = role
    ? JSON.stringify([
        role.id,
        role.updatedAt,
        role.code,
        role.name,
        role.description,
        role.permissionIds,
      ])
    : null;
  const [loadedRoleDraftKey, setLoadedRoleDraftKey] = useState<string | null>(
    null,
  );

  if (roleDraftKey !== loadedRoleDraftKey) {
    setLoadedRoleDraftKey(roleDraftKey);
    setCode(role?.code ?? '');
    setName(role?.name ?? '');
    setDescription(role?.description ?? '');
    setSelectedPermissions(new Set(role?.permissionIds ?? []));
  }

  function clearMutationFeedback() {
    setMutationError(null);
    setSuccessMessage(null);
  }

  function togglePermission(permissionId: string) {
    clearMutationFeedback();
    setSelectedPermissions((current) => {
      const next = new Set(current);
      if (next.has(permissionId)) next.delete(permissionId);
      else next.add(permissionId);
      return next;
    });
  }

  async function saveRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearMutationFeedback();

    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    if (mode === 'create' && !ROLE_CODE_PATTERN.test(code)) {
      setMutationError(
        'Role code must be 2–40 characters of lower snake case: start with a letter and use only lowercase letters, numbers, and underscores.',
      );
      return;
    }
    if (!trimmedName || trimmedName.length > 80) {
      setMutationError(
        'Role name is required and must be no more than 80 characters.',
      );
      return;
    }
    if (trimmedDescription.length > 240) {
      setMutationError('Description must be no more than 240 characters.');
      return;
    }
    if (selectedPermissions.size > 50) {
      setMutationError('Choose no more than 50 permissions.');
      return;
    }
    if (mode === 'edit' && (!role || role.isSystem || !canManage)) return;

    setPending('save');
    const permissionIds =
      data?.permissions
        .filter((permission) => selectedPermissions.has(permission.id))
        .map((permission) => permission.id) ?? [];

    try {
      if (mode === 'create') {
        const created = await roleApi.createRole({
          code,
          name: trimmedName,
          description: trimmedDescription,
          permissionIds,
        });
        setCreatedRole(created);
        setData((current) =>
          current
            ? { ...current, roles: [...current.roles, created] }
            : current,
        );
      } else if (role) {
        const updated = await roleApi.updateRole(role.id, {
          name: trimmedName,
          description: trimmedDescription,
          permissionIds,
        });
        setData((current) =>
          current
            ? {
                ...current,
                roles: current.roles.map((candidate) =>
                  candidate.id === updated.id ? updated : candidate,
                ),
              }
            : current,
        );
        setSuccessMessage('Role changes saved.');
      }
    } catch (caught: unknown) {
      let message = handleError(
        caught,
        mode === 'create'
          ? 'The role could not be created. Try again.'
          : 'The role changes could not be saved. Try again.',
        { source: 'mutation' },
      );
      if (caught instanceof ApiClientError && caught.code === 'CONFLICT') {
        message =
          mode === 'create'
            ? `The server refused this role because its code is already in use. Choose a different code. ${caught.message}`
            : `The server refused these role changes. Reload the role and try again. ${caught.message}`;
      }
      setMutationError(message);
    } finally {
      setPending(null);
    }
  }

  async function confirmDelete() {
    if (!role || role.isSystem || !canManage) return;
    setPending('delete');
    clearMutationFeedback();

    try {
      await roleApi.deleteRole(role.id);
      router.replace('/roles');
      router.refresh();
    } catch (caught: unknown) {
      let message = handleError(
        caught,
        'The role could not be deleted. Try again.',
        { source: 'mutation' },
      );
      if (caught instanceof ApiClientError && caught.code === 'CONFLICT') {
        message = `The server refused deletion because this role is still assigned to one or more users. Reassign those users before trying again. ${caught.message}`;
      }
      setMutationError(message);
      setPending(null);
    }
  }

  const readOnly = mode === 'edit' && role && (role.isSystem || !canManage);
  const showForm =
    mode === 'create'
      ? canManage && !createdRole
      : Boolean(role && canManage && !role.isSystem);

  const title =
    mode === 'create'
      ? 'Create role'
      : role
        ? role.isSystem || !canManage
          ? role.name
          : `Edit ${role.name}`
        : 'Role details';
  const pageDescription =
    mode === 'create'
      ? 'Define a custom role and explicitly choose its permissions.'
      : role?.isSystem
        ? 'Review the protected system role. Its definition and permissions cannot be edited or deleted.'
        : !canManage
          ? 'Review this role and its permission assignments. Management access is required to make changes.'
          : 'Update the role name, description, and permissions, or delete this custom role.';

  return (
    <>
      <RolePageHeader
        title={title}
        description={pageDescription}
        actions={
          <Link className="button button-secondary" href="/roles">
            Back to roles
          </Link>
        }
      />

      {terminalStatus === 'forbidden' ? <RoleForbiddenState /> : null}
      {terminalStatus === 'redirecting' ? (
        <RoleLoadingState
          title="Your session has expired"
          description="Taking you to sign in before returning to this role."
          redirecting
        />
      ) : null}
      {terminalStatus === null && mode === 'create' && !canManage ? (
        <RoleForbiddenState management />
      ) : null}
      {terminalStatus === null &&
      !(mode === 'create' && !canManage) &&
      loading ? (
        <RoleLoadingState
          title={
            mode === 'create' ? 'Loading permission catalog' : 'Loading role'
          }
          description="Retrieving the latest role and permission records."
        />
      ) : null}
      {terminalStatus === null &&
      !(mode === 'create' && !canManage) &&
      !loading &&
      (error || !data) ? (
        <RoleErrorState
          title={
            mode === 'create'
              ? 'Permission catalog unavailable'
              : 'Role unavailable'
          }
          message={error ?? 'The role data could not be loaded.'}
          onRetry={reload}
        />
      ) : null}

      {terminalStatus === null && !loading && data ? (
        <div className="dashboard-stack">
          {mode === 'edit' && !role ? (
            <section className="admin-panel admin-empty" role="alert">
              <h2>Role not found</h2>
              <p>
                No role with this ID was returned by the server. It may have
                been deleted or the link may be invalid.
              </p>
              <div className="role-actions">
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={reload}
                >
                  Reload roles
                </button>
                <Link className="text-link" href="/roles">
                  Return to roles
                </Link>
              </div>
            </section>
          ) : null}

          {createdRole ? (
            <section
              className="admin-panel"
              role="status"
              aria-labelledby="role-created-heading"
            >
              <div className="admin-panel-heading">
                <div>
                  <h2 id="role-created-heading">Role created</h2>
                  <p>
                    <strong>{createdRole.name}</strong> (
                    <code>{createdRole.code}</code>) was saved with{' '}
                    {createdRole.permissionIds.length}{' '}
                    {createdRole.permissionIds.length === 1
                      ? 'permission'
                      : 'permissions'}
                    .
                  </p>
                </div>
              </div>
              <div className="role-actions">
                <Link
                  className="button button-primary"
                  href={`/roles/${encodeURIComponent(createdRole.id)}/edit`}
                >
                  Review role
                </Link>
                <Link className="button button-secondary" href="/roles">
                  Return to roles
                </Link>
              </div>
            </section>
          ) : null}

          {readOnly && role ? (
            <section
              className="admin-panel role-readonly"
              aria-labelledby="readonly-role-heading"
            >
              <div className="admin-panel-heading">
                <div>
                  <h2 id="readonly-role-heading">Role definition</h2>
                  <p>
                    {role.isSystem
                      ? 'System role · read-only'
                      : 'Read-only access'}
                  </p>
                </div>
                {role.isSystem ? (
                  <span className="admin-badge admin-badge-inactive">
                    System · read-only
                  </span>
                ) : null}
              </div>
              <p className="form-message">
                {role.isSystem
                  ? 'The system administrator role is protected by the server and cannot be edited or deleted.'
                  : 'Your account can review this role but cannot change it without the roles.manage permission.'}
              </p>
              <dl className="access-details role-summary">
                <div>
                  <dt>Role code</dt>
                  <dd>
                    <code>{role.code}</code>
                  </dd>
                </div>
                <div>
                  <dt>Role name</dt>
                  <dd>{role.name}</dd>
                </div>
                <div>
                  <dt>Description</dt>
                  <dd>{role.description || 'No description provided'}</dd>
                </div>
                <div>
                  <dt>Permissions</dt>
                  <dd>{role.permissionIds.length} assigned</dd>
                </div>
              </dl>
              <section aria-labelledby="readonly-permissions-heading">
                <h3 id="readonly-permissions-heading">Assigned permissions</h3>
                {role.permissionIds.length ? (
                  <ul className="permission-list">
                    {role.permissionIds.map((permissionId) => {
                      const permission = data.permissions.find(
                        (candidate) => candidate.id === permissionId,
                      );
                      return (
                        <li key={permissionId} title={permission?.description}>
                          {permission
                            ? `${permission.name} (${permission.code})`
                            : `Permission ${permissionId}`}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="admin-secondary-text">
                    No permissions assigned.
                  </p>
                )}
              </section>
            </section>
          ) : null}

          {showForm ? (
            <section
              className="admin-panel"
              aria-labelledby="role-form-heading"
            >
              <div className="admin-panel-heading">
                <div>
                  <h2 id="role-form-heading">
                    {mode === 'create'
                      ? 'Role definition'
                      : 'Edit role definition'}
                  </h2>
                  <p>
                    Permission changes are not applied until you explicitly save
                    this form.
                  </p>
                </div>
              </div>
              <form
                className="role-form"
                method="post"
                onSubmit={saveRole}
                noValidate
                aria-busy={pending === 'save'}
              >
                <div className="role-form-grid">
                  <div className="field">
                    <label htmlFor="role-code">Role code</label>
                    <input
                      id="role-code"
                      name="code"
                      type="text"
                      value={code}
                      onChange={(event) => {
                        clearMutationFeedback();
                        setCode(event.target.value);
                      }}
                      required
                      minLength={2}
                      maxLength={40}
                      pattern="[a-z][a-z0-9_]{1,39}"
                      autoCapitalize="none"
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck={false}
                      readOnly={mode === 'edit'}
                      aria-readonly={mode === 'edit'}
                      aria-describedby="role-code-hint"
                      disabled={pending !== null}
                    />
                    <p className="field-hint" id="role-code-hint">
                      {mode === 'edit'
                        ? 'The role code is immutable.'
                        : 'Use 2–40 characters of lower snake case, for example records_viewer.'}
                    </p>
                  </div>
                  <div className="field">
                    <label htmlFor="role-name">Role name</label>
                    <input
                      id="role-name"
                      name="name"
                      type="text"
                      value={name}
                      onChange={(event) => {
                        clearMutationFeedback();
                        setName(event.target.value);
                      }}
                      required
                      maxLength={80}
                      autoComplete="off"
                      disabled={pending !== null}
                    />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="role-description">Description</label>
                  <textarea
                    className="role-textarea"
                    id="role-description"
                    name="description"
                    value={description}
                    onChange={(event) => {
                      clearMutationFeedback();
                      setDescription(event.target.value);
                    }}
                    rows={4}
                    maxLength={240}
                    disabled={pending !== null}
                    aria-describedby="role-description-hint"
                  />
                  <p className="field-hint" id="role-description-hint">
                    Optional, up to 240 characters. {description.length}/240
                    entered.
                  </p>
                </div>

                <fieldset
                  className="role-permissions"
                  disabled={pending !== null}
                >
                  <legend>Permissions</legend>
                  <p className="field-hint">
                    Select only the access this role needs. Empty permission
                    sets are allowed.
                  </p>
                  {data.permissions.length ? (
                    <div className="role-permission-grid">
                      {data.permissions.map((permission) => (
                        <label
                          className="role-permission-option"
                          key={permission.id}
                          htmlFor={`permission-${permission.id}`}
                        >
                          <input
                            id={`permission-${permission.id}`}
                            type="checkbox"
                            checked={selectedPermissions.has(permission.id)}
                            onChange={() => togglePermission(permission.id)}
                          />
                          <span className="role-permission-copy">
                            <strong>{permission.name}</strong>
                            <code>{permission.code}</code>
                            <span>
                              {permission.description ||
                                'No description provided'}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="admin-secondary-text">
                      The server returned no permissions to assign.
                    </p>
                  )}
                </fieldset>

                {mutationError ? (
                  <p className="form-message form-error" role="alert">
                    {mutationError}
                  </p>
                ) : null}
                {successMessage ? (
                  <p className="form-message form-success" role="status">
                    {successMessage}
                  </p>
                ) : null}
                <div className="role-form-actions">
                  <button
                    className="button button-primary"
                    type="submit"
                    disabled={pending !== null}
                  >
                    {pending === 'save'
                      ? mode === 'create'
                        ? 'Creating…'
                        : 'Saving…'
                      : mode === 'create'
                        ? 'Create role'
                        : 'Save changes'}
                  </button>
                  <Link className="button button-secondary" href="/roles">
                    Cancel
                  </Link>
                </div>
              </form>
            </section>
          ) : null}

          {mode === 'edit' && role && canManage && !role.isSystem ? (
            <section
              className="admin-panel role-delete-zone"
              aria-labelledby="delete-role-heading"
            >
              <div className="admin-panel-heading">
                <div>
                  <h2 id="delete-role-heading">Delete role</h2>
                  <p>
                    Deletion is permanent. The server will refuse to delete a
                    role assigned to any user.
                  </p>
                </div>
              </div>
              {!deleteArmed ? (
                <button
                  className="button button-danger"
                  type="button"
                  onClick={() => {
                    clearMutationFeedback();
                    setDeleteArmed(true);
                  }}
                  disabled={pending !== null}
                >
                  Delete role
                </button>
              ) : (
                <div
                  className="form-message form-error role-delete-confirm"
                  role="alert"
                >
                  <p>
                    <strong>Delete {role.name}?</strong> This action cannot be
                    undone. Assigned users must be moved to other roles first.
                  </p>
                  {mutationError ? <p>{mutationError}</p> : null}
                  <div className="role-actions">
                    <button
                      className="button button-danger"
                      type="button"
                      onClick={confirmDelete}
                      disabled={pending !== null}
                    >
                      {pending === 'delete'
                        ? 'Deleting…'
                        : `Permanently delete ${role.name}`}
                    </button>
                    <button
                      className="button button-secondary"
                      type="button"
                      onClick={() => setDeleteArmed(false)}
                      disabled={pending !== null}
                    >
                      Keep role
                    </button>
                  </div>
                </div>
              )}
            </section>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
