'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export function ResetPasswordForm({ initialError }: { initialError: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(
    initialError
      ? 'This reset link is invalid or has expired. Request a new one.'
      : null,
  );
  const [sessionState, setSessionState] = useState<
    'loading' | 'ready' | 'missing'
  >(initialError ? 'missing' : 'loading');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (initialError) return;

    let active = true;
    const supabase = createSupabaseBrowserClient();
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setSessionState(data.session ? 'ready' : 'missing');
    });

    return () => {
      active = false;
    };
  }, [initialError]);

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < 12) {
      setError('Use at least 12 characters for your new password.');
      return;
    }
    if (password !== confirmation) {
      setError('The password confirmation does not match.');
      return;
    }

    setPending(true);
    const supabase = createSupabaseBrowserClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(
        'Your password could not be updated. Request a new reset link and try again.',
      );
      setPending(false);
      return;
    }

    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      await supabase.auth.signOut({ scope: 'local' });
    }
    router.replace('/login?reset=success');
    router.refresh();
  }

  if (sessionState === 'loading') {
    return (
      <p className="form-message" role="status">
        Checking your reset link…
      </p>
    );
  }

  if (sessionState === 'missing') {
    return (
      <div className="auth-form">
        {error ? (
          <p className="form-message form-error" role="alert">
            {error}
          </p>
        ) : null}
        <p className="supporting-copy">
          Sign in again or request a new password reset link.
        </p>
        <Link
          className="button button-primary button-full"
          href="/forgot-password"
        >
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <form className="auth-form" method="post" onSubmit={resetPassword}>
      <div className="field">
        <label htmlFor="new-password">New password</label>
        <input
          id="new-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-describedby="password-hint"
          required
          autoFocus
        />
        <p className="field-hint" id="password-hint">
          Use at least 12 characters.
        </p>
      </div>
      <div className="field">
        <label htmlFor="confirm-password">Confirm new password</label>
        <input
          id="confirm-password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={12}
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          required
        />
      </div>
      {error ? (
        <p className="form-message form-error" role="alert">
          {error}
        </p>
      ) : null}
      <button
        className="button button-primary button-full"
        type="submit"
        disabled={pending}
      >
        {pending ? 'Updating password…' : 'Update password'}
      </button>
    </form>
  );
}
