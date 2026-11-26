import type { Metadata } from 'next';
import { AuthLayout } from '@/components/auth/auth-layout';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';

export const metadata: Metadata = {
  title: 'Choose a new password | Fieldbook',
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <AuthLayout
      eyebrow="ACCOUNT RECOVERY"
      title="Choose a new password"
      description="Your reset link creates a short-lived recovery session. Choose a new password to finish."
    >
      <ResetPasswordForm initialError={error === 'recovery'} />
    </AuthLayout>
  );
}
