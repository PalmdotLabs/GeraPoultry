'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import type { User } from '@poultry/validation';
import { adminApi } from './admin-api';
import { PageHeader } from './page-header';
import { AdminForbiddenState, AdminLoadingState } from './admin-states';
import { useAdminApiErrors } from './use-admin-data';

export function InviteUserForm({ canReadUsers }: { canReadUsers: boolean }) {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [invitedUser, setInvitedUser] = useState<User | null>(null);
  const { handleError, terminalStatus } = useAdminApiErrors('/users/invite');

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedDisplayName = displayName.trim();

    setError(null);
    setValidationError(null);
    setInvitedUser(null);

    if (!normalizedEmail || normalizedEmail.length > 254) {
      setValidationError(
        'Enter a valid email address of no more than 254 characters.',
      );
      return;
    }
    if (!normalizedDisplayName || normalizedDisplayName.length > 120) {
      setValidationError('Enter a display name between 1 and 120 characters.');
      return;
    }

    setPending(true);
    try {
      const user = await adminApi.inviteUser({
        email: normalizedEmail,
        displayName: normalizedDisplayName,
      });
      setEmail('');
      setDisplayName('');
      setInvitedUser(user);
    } catch (caught) {
      setError(
        handleError(caught, 'The invitation could not be sent. Try again.', {
          source: 'mutation',
        }),
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Invite a user"
        description="Send a Supabase email invitation without creating or sharing a plaintext password."
        actions={
          canReadUsers ? (
            <Link className="button button-secondary" href="/users">
              Back to users
            </Link>
          ) : undefined
        }
      />

      {terminalStatus === 'forbidden' ? (
        <AdminForbiddenState permission="users.manage" />
      ) : null}
      {terminalStatus === 'redirecting' ? (
        <AdminLoadingState
          title="Your session has expired"
          description="Taking you to sign in before returning to the invitation form."
          redirecting
        />
      ) : null}

      {terminalStatus === null ? (
        <section
          className="admin-panel admin-form-panel"
          aria-labelledby="invite-form-heading"
        >
          <div className="admin-panel-heading">
            <div>
              <h2 id="invite-form-heading">Invitation details</h2>
              <p>
                The recipient will use the emailed Auth link to establish their
                credentials. No role is assigned by default.
              </p>
            </div>
          </div>

          {invitedUser ? (
            <div className="form-message form-success" role="status">
              <p>
                <strong>
                  Invitation created for {invitedUser.displayName}.
                </strong>
              </p>
              <p>
                The invitation email is handled by Supabase.{' '}
                {canReadUsers ? (
                  <>
                    Review the{' '}
                    <Link href={`/users/${invitedUser.id}`}>
                      invited user&apos;s live details
                    </Link>
                    .
                  </>
                ) : (
                  'No user detail link is shown because your account cannot read the user directory.'
                )}
              </p>
            </div>
          ) : null}

          {error ? (
            <div className="form-message form-error" role="alert">
              <p>{error}</p>
              {error.includes('audit') ? (
                <p>
                  The invitation may already exist in Auth. Reconcile the user
                  directory before sending another invitation.
                </p>
              ) : null}
            </div>
          ) : null}
          {validationError ? (
            <p className="form-message form-error" role="alert">
              {validationError}
            </p>
          ) : null}

          <form className="admin-form" method="post" onSubmit={invite}>
            <div className="field">
              <label htmlFor="invite-email">Email address</label>
              <input
                id="invite-email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="off"
                required
                maxLength={254}
                value={email}
                disabled={pending}
                aria-invalid={Boolean(validationError && !email.trim())}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setValidationError(null);
                  setError(null);
                }}
              />
              <p className="field-hint">
                The invitation will be sent to this normalized, lower-case
                address.
              </p>
            </div>

            <div className="field">
              <label htmlFor="invite-display-name">Display name</label>
              <input
                id="invite-display-name"
                name="displayName"
                type="text"
                autoComplete="off"
                required
                maxLength={120}
                value={displayName}
                disabled={pending}
                aria-invalid={Boolean(validationError && !displayName.trim())}
                onChange={(event) => {
                  setDisplayName(event.target.value);
                  setValidationError(null);
                  setError(null);
                }}
              />
              <p className="field-hint">
                Use 1–120 characters after trimming surrounding spaces.
              </p>
            </div>

            <div className="admin-form-actions">
              <button
                className="button button-primary"
                type="submit"
                disabled={pending}
              >
                {pending ? 'Sending invitation…' : 'Send invitation'}
              </button>
              {canReadUsers ? (
                <Link className="text-link" href="/users">
                  Cancel
                </Link>
              ) : null}
            </div>
          </form>
        </section>
      ) : null}
    </>
  );
}
