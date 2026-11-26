import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthLayout } from '@/components/auth/auth-layout';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';

export const metadata: Metadata = { title: 'Reset your password | Fieldbook' };

export default function ForgotPasswordPage() {
  return (
    <AuthLayout
      eyebrow="ACCOUNT RECOVERY"
      title="Reset your password"
      description="Enter your account email and we’ll send a secure reset link if an account matches."
      footer={<Link href="/login">Back to sign in</Link>}
    >
      <ForgotPasswordForm />
    </AuthLayout>
  );
}
