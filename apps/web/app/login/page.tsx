import type { Metadata } from 'next';
import { AuthLayout } from '@/components/auth/auth-layout';
import { SignInForm } from '@/components/auth/sign-in-form';
import { safeLocalDestination } from '@/lib/navigation';

export const metadata: Metadata = { title: 'Sign in | Fieldbook' };

type LoginSearchParams = {
  next?: string | string[];
  reset?: string;
  signedOut?: string;
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<LoginSearchParams>;
}) {
  const params = await searchParams;
  const next = safeLocalDestination(
    Array.isArray(params.next) ? params.next[0] : params.next,
  );

  return (
    <AuthLayout
      eyebrow="WELCOME BACK"
      title="Sign in to Fieldbook"
      description="Use your administrator email and password to continue."
    >
      {params.reset === 'success' ? (
        <p className="form-message form-success" role="status">
          Your password has been updated. Sign in with the new password.
        </p>
      ) : null}
      {params.signedOut === '1' ? (
        <p className="form-message form-success" role="status">
          You have signed out.
        </p>
      ) : null}
      <SignInForm next={next} />
    </AuthLayout>
  );
}
