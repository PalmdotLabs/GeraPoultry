'use client';

import { useState, type FormEvent } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function requestRecovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      },
    );

    setPending(false);
    if (recoveryError) {
      setError('A recovery email could not be requested. Try again.');
      return;
    }

    setMessage(
      'If this email belongs to an account, a password reset link is on its way.',
    );
  }

  return (
    <form className="auth-form" method="post" onSubmit={requestRecovery}>
      <div className="field">
        <label htmlFor="email">Email address</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          autoFocus
        />
      </div>
      {message ? (
        <p className="form-message form-success" role="status">
          {message}
        </p>
      ) : null}
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
        {pending ? 'Requesting reset link…' : 'Send reset link'}
      </button>
    </form>
  );
}
