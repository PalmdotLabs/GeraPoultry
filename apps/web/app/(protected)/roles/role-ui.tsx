import type { ReactNode } from 'react';

export function RolePageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">ADMINISTRATION</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions ? <div className="page-header-actions">{actions}</div> : null}
    </header>
  );
}

export function RoleLoadingState({
  title = 'Loading roles',
  description = 'Retrieving roles and the current permission catalog.',
  redirecting = false,
}: {
  title?: string;
  description?: string;
  redirecting?: boolean;
}) {
  return (
    <section className="session-state" aria-busy="true" role="status">
      <span className="loading-indicator" aria-hidden="true" />
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {redirecting ? (
        <span className="sr-only">Redirecting to sign in.</span>
      ) : null}
    </section>
  );
}

export function RoleErrorState({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry: () => void;
}) {
  return (
    <section className="session-state session-error" role="alert">
      <div>
        <h2>{title}</h2>
        <p>{message}</p>
      </div>
      <button
        className="button button-secondary"
        type="button"
        onClick={onRetry}
      >
        Try again
      </button>
    </section>
  );
}

export function RoleForbiddenState({
  management = false,
}: {
  management?: boolean;
}) {
  return (
    <section
      className="session-state session-error admin-forbidden"
      role="alert"
    >
      <div>
        <p className="eyebrow">403 · RESTRICTED</p>
        <h2>You do not have access to this area</h2>
        <p>
          Your current account does not have the{' '}
          {management ? 'roles.manage' : 'roles.read'} permission. Contact an
          administrator if you believe your access should change.
        </p>
      </div>
    </section>
  );
}
