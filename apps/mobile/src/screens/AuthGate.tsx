import { useAuth } from '../auth/AuthProvider';
import { EmployeeShell } from './EmployeeShell';
import { SignInScreen } from './SignInScreen';
import {
  CleanupFailedScreen,
  ConfigurationErrorScreen,
  InactiveAccountScreen,
  RestoringScreen,
  SigningOutScreen,
  VerificationErrorScreen,
} from './StateScreens';

export function AuthGate() {
  const { state } = useAuth();

  switch (state.status) {
    case 'configurationError':
      return <ConfigurationErrorScreen message={state.message} />;
    case 'restoring':
    case 'validating':
      return <RestoringScreen />;
    case 'signedOut':
      return <SignInScreen message={state.message} />;
    case 'validationError':
      return <VerificationErrorScreen message={state.message} />;
    case 'inactive':
      return (
        <InactiveAccountScreen
          cleanupWarning={state.cleanupWarning}
          message={state.message}
        />
      );
    case 'authenticated':
      return (
        <EmployeeShell
          account={state.account}
          refreshError={state.refreshError}
          refreshing={state.refreshing}
          verifiedAt={state.verifiedAt}
        />
      );
    case 'signingOut':
      return <SigningOutScreen />;
    case 'cleanupFailed':
      return <CleanupFailedScreen message={state.message} />;
  }
}
