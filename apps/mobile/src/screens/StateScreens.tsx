import { AppButton } from '../components/AppButton';
import { Message } from '../components/Message';
import { StatusScreen } from '../components/StatusScreen';
import { useAuth } from '../auth/AuthProvider';

export function RestoringScreen() {
  return (
    <StatusScreen
      description="Restoring secure sign-in and checking the live employee profile."
      loading
      title="Checking your account"
    />
  );
}

export function VerificationErrorScreen({ message }: { message: string }) {
  const { refresh, signOut } = useAuth();
  return (
    <StatusScreen description={message} title="Account verification needed">
      <AppButton label="Retry verification" onPress={() => void refresh()} />
      <AppButton
        label="Sign out on this device"
        onPress={() => void signOut()}
        variant="secondary"
      />
    </StatusScreen>
  );
}

export function InactiveAccountScreen({
  message,
  cleanupWarning,
}: {
  message: string;
  cleanupWarning: string | null;
}) {
  const { signOut } = useAuth();
  return (
    <StatusScreen description={message} title="Access unavailable">
      {cleanupWarning ? <Message tone="error">{cleanupWarning}</Message> : null}
      <AppButton
        label="Return to sign in"
        onPress={() => void signOut()}
        variant="secondary"
      />
    </StatusScreen>
  );
}

export function CleanupFailedScreen({ message }: { message: string }) {
  const { signOut } = useAuth();
  return (
    <StatusScreen description={message} title="Local cleanup required">
      <AppButton label="Retry local cleanup" onPress={() => void signOut()} />
    </StatusScreen>
  );
}

export function ConfigurationErrorScreen({ message }: { message: string }) {
  return (
    <StatusScreen
      description={`${message} Add only the documented public mobile configuration, then restart the app.`}
      title="Mobile setup required"
    />
  );
}

export function SigningOutScreen() {
  return (
    <StatusScreen
      description="Clearing this device’s protected sign-in. Other sessions are not revoked."
      loading
      title="Signing out"
    />
  );
}
