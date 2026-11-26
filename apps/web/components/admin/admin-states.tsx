interface AdminLoadingStateProps {
  title?: string;
  description?: string;
  redirecting?: boolean;
}

export function AdminLoadingState({
  title = 'Loading administration data',
  description = 'Retrieving the latest server records.',
  redirecting = false,
}: AdminLoadingStateProps) {
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

export function AdminErrorState({
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

export function AdminForbiddenState({ permission }: { permission?: string }) {
  return (
    <section
      className="session-state session-error admin-forbidden"
      role="alert"
    >
      <div>
        <p className="eyebrow">403 · RESTRICTED</p>
        <h2>You do not have access to this area</h2>
        <p>
          Your current account cannot{' '}
          {permission
            ? `use the ${permission} permission`
            : 'view this administration resource'}
          . Contact an administrator if you believe your access should change.
        </p>
      </div>
    </section>
  );
}
