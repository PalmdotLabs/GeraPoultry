import {
  isAuthRetryableFetchError,
  type AuthError,
  type AuthSession,
} from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { AppState } from 'react-native';
import type { Session } from '@poultry/api-client';
import { createAuthServices, type AuthServices } from './auth-services';
import {
  allowsAutomaticSessionValidation,
  AuthOperationCoordinator,
  classifyAuthSessionError,
  isLogoutCleanupRequired,
  restoreSessionWithCleanupBarrier,
  signOutWithLogoutCleanupBarrier,
  validateEmployeeSession,
} from './employee-session';

export type AuthState =
  | { status: 'configurationError'; message: string }
  | { status: 'restoring' }
  | { status: 'signedOut'; message: string | null }
  | { status: 'validating' }
  | { status: 'validationError'; message: string }
  | { status: 'inactive'; message: string; cleanupWarning: string | null }
  | {
      status: 'authenticated';
      account: Session;
      verifiedAt: number;
      refreshing: boolean;
      refreshError: string | null;
    }
  | { status: 'signingOut' }
  | { status: 'cleanupFailed'; message: string };

type ValidationSource = 'restore' | 'sign-in' | 'foreground' | 'manual';

interface StoredSessionResult {
  data: { session: AuthSession | null };
  error: AuthError | null;
}

interface AuthContextValue {
  state: AuthState;
  signIn: (email: string, password: string) => Promise<string | null>;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const inactiveMessage =
  'This account is not active. Contact your administrator before trying again.';
const retryMessage =
  'Live account verification failed. Check the API connection and try again.';
const refreshErrorMessage =
  'Could not verify current access. Showing the last verified account details; this is not offline authentication.';
const cleanupFailureMessage =
  'Protected sign-in data could not be fully cleared. Retry local cleanup before signing in again.';

const loadServices = (): {
  services: AuthServices | null;
  message: string | null;
} => {
  try {
    return { services: createAuthServices(), message: null };
  } catch (error) {
    return {
      services: null,
      message:
        error instanceof Error
          ? error.message
          : 'Mobile authentication is not configured.',
    };
  }
};

export function AuthProvider({ children }: PropsWithChildren) {
  const [{ services, message: configurationMessage }] = useState(loadServices);
  const [state, setState] = useState<AuthState>(
    services
      ? { status: 'restoring' }
      : {
          status: 'configurationError',
          message:
            configurationMessage ?? 'Mobile authentication is not configured.',
        },
  );
  const stateRef = useRef(state);
  const [operations] = useState(() => new AuthOperationCoordinator());
  const initializedRef = useRef(false);
  const cleanupOwnerRef = useRef<number | null>(null);

  const commitState = useCallback((next: AuthState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const performOwnedCleanup = useCallback(
    async (operation: number) => {
      if (!services || !operations.isCurrent(operation)) {
        return { cleared: false, warning: null };
      }

      return signOutWithLogoutCleanupBarrier(
        services.supabase.auth,
        services.clearPersistedSession,
        () => operations.isCurrent(operation),
        services,
      );
    },
    [operations, services],
  );

  const finishRejectedSession = useCallback(
    async (kind: 'inactive' | 'unauthenticated', operation: number) => {
      if (!services || !operations.isCurrent(operation)) return;

      const claimed =
        operations.claimExclusive('cleanup', operation) !== null ||
        operations.transitionExclusive('sign-in', 'cleanup', operation);
      if (!claimed) return;

      // Revocation is already definitive: remove identity before any await.
      commitState({ status: 'signingOut' });
      cleanupOwnerRef.current = operation;

      try {
        const result = await performOwnedCleanup(operation);
        if (!operations.isCurrent(operation)) return;

        if (!result.cleared) {
          commitState({
            status: 'cleanupFailed',
            message: result.warning ?? cleanupFailureMessage,
          });
        } else if (kind === 'inactive') {
          commitState({
            status: 'inactive',
            message: inactiveMessage,
            cleanupWarning: null,
          });
        } else {
          commitState({
            status: 'signedOut',
            message: 'Your sign-in has expired or was revoked. Sign in again.',
          });
        }
      } finally {
        operations.finishExclusive(operation, 'cleanup');
        if (cleanupOwnerRef.current === operation) {
          cleanupOwnerRef.current = null;
        }
      }
    },
    [commitState, operations, performOwnedCleanup, services],
  );

  const applyRetryableOutcome = useCallback(
    (
      previousAccount: Extract<AuthState, { status: 'authenticated' }> | null,
    ) => {
      if (previousAccount) {
        commitState({
          ...previousAccount,
          refreshing: false,
          refreshError: refreshErrorMessage,
        });
      } else {
        commitState({ status: 'validationError', message: retryMessage });
      }
    },
    [commitState],
  );

  const validate = useCallback(
    async (source: ValidationSource, ownedOperation?: number) => {
      if (!services) return;
      // Retry local cleanup is the only exit, even if marker creation itself failed.
      if (stateRef.current.status === 'cleanupFailed') return;
      if (
        source === 'foreground' &&
        !allowsAutomaticSessionValidation(stateRef.current.status)
      ) {
        return;
      }
      // Explicit retries cannot supersede an unfinished credential exchange or
      // destructive local cleanup. Only retry-cleanup may finish that work.
      if (source !== 'sign-in' && operations.hasExclusiveOperation()) return;

      const operation = ownedOperation ?? operations.begin();
      if (!operations.isCurrent(operation)) return;
      const previous = stateRef.current;
      const previousAccount =
        previous.status === 'authenticated' ? previous : null;

      if (previousAccount && (source === 'manual' || source === 'foreground')) {
        commitState({
          ...previousAccount,
          refreshing: true,
          refreshError: null,
        });
      } else {
        commitState({ status: 'validating' });
      }

      let sessionResult: StoredSessionResult;
      try {
        const restoration = await restoreSessionWithCleanupBarrier(
          services.getLogoutCleanupRequired,
          () => services.supabase.auth.getSession(),
        );
        if (!operations.isCurrent(operation)) return;
        if (restoration.kind === 'cleanup-required') {
          commitState({
            status: 'cleanupFailed',
            message: cleanupFailureMessage,
          });
          return;
        }
        sessionResult = restoration.result;
      } catch {
        if (!operations.isCurrent(operation)) return;
        // Thrown transport and protected-storage errors are not revocation.
        applyRetryableOutcome(previousAccount);
        return;
      }
      if (!operations.isCurrent(operation)) return;

      if (sessionResult.error) {
        const decision = classifyAuthSessionError(sessionResult.error);
        if (decision === 'rejected') {
          await finishRejectedSession('unauthenticated', operation);
          return;
        }
        if (decision === 'absent') {
          commitState({ status: 'signedOut', message: null });
          return;
        }
        applyRetryableOutcome(previousAccount);
        return;
      }

      // A genuinely absent session is not a destructive cleanup outcome.
      if (!sessionResult.data.session) {
        commitState({ status: 'signedOut', message: null });
        return;
      }

      const result = await validateEmployeeSession(services.apiClient);
      if (!operations.isCurrent(operation)) return;

      if (result.kind === 'verified') {
        commitState({
          status: 'authenticated',
          account: result.account,
          verifiedAt: Date.now(),
          refreshing: false,
          refreshError: null,
        });
        return;
      }

      if (result.kind === 'inactive' || result.kind === 'unauthenticated') {
        await finishRejectedSession(result.kind, operation);
        return;
      }

      applyRetryableOutcome(previousAccount);
    },
    [
      applyRetryableOutcome,
      commitState,
      finishRejectedSession,
      operations,
      services,
    ],
  );

  const signOut = useCallback(async () => {
    if (!services) return;
    const operation = operations.claimExclusive('cleanup');
    if (operation === null) return;

    // Invalidate validation and intermediate SIGNED_OUT before the first await.
    commitState({ status: 'signingOut' });
    cleanupOwnerRef.current = operation;

    try {
      const result = await performOwnedCleanup(operation);
      if (!operations.isCurrent(operation)) return;
      if (!result.cleared) {
        commitState({
          status: 'cleanupFailed',
          message: result.warning ?? cleanupFailureMessage,
        });
        return;
      }
      commitState({
        status: 'signedOut',
        message:
          result.warning ??
          'Signed out on this device. Other sessions were not revoked.',
      });
    } finally {
      // Only this generation can release its duplicate-operation and event guards.
      operations.finishExclusive(operation, 'cleanup');
      if (cleanupOwnerRef.current === operation) {
        cleanupOwnerRef.current = null;
      }
    }
  }, [commitState, operations, performOwnedCleanup, services]);

  useEffect(() => {
    if (!services) return;
    operations.remount();
    let effectActive = true;
    let scheduledValidation = 0;
    const { data } = services.supabase.auth.onAuthStateChange((event) => {
      if (!effectActive) return;
      if (event === 'SIGNED_OUT') {
        // Supabase emits this before local signOut has actually settled.
        if (cleanupOwnerRef.current !== null) return;
        operations.invalidate();
        commitState({ status: 'signedOut', message: null });
      }
      if (event === 'TOKEN_REFRESHED' && initializedRef.current) {
        if (!allowsAutomaticSessionValidation(stateRef.current.status)) return;
        const generation = ++scheduledValidation;
        const operation = operations.current();
        setTimeout(() => {
          if (
            effectActive &&
            generation === scheduledValidation &&
            operations.isCurrent(operation)
          ) {
            void validate('foreground');
          }
        }, 0);
      }
    });

    const appStateSubscription = AppState.addEventListener(
      'change',
      (nextState) => {
        if (
          effectActive &&
          nextState === 'active' &&
          initializedRef.current &&
          allowsAutomaticSessionValidation(stateRef.current.status)
        ) {
          void validate('foreground');
        }
      },
    );

    void validate('restore').finally(() => {
      if (effectActive) initializedRef.current = true;
    });

    return () => {
      effectActive = false;
      operations.unmount();
      initializedRef.current = false;
      ++scheduledValidation;
      data.subscription.unsubscribe();
      appStateSubscription.remove();
    };
  }, [commitState, operations, services, validate]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<string | null> => {
      if (!services) return 'Mobile authentication is not configured.';
      if (stateRef.current.status === 'cleanupFailed') return null;
      const operation = operations.claimExclusive('sign-in');
      if (operation === null) {
        return 'Another account operation is already in progress. Try again shortly.';
      }

      try {
        if (await isLogoutCleanupRequired(services.getLogoutCleanupRequired)) {
          if (operations.isCurrent(operation)) {
            commitState({
              status: 'cleanupFailed',
              message: cleanupFailureMessage,
            });
          }
          return null;
        }
        if (!operations.isCurrent(operation)) return null;

        const { error } = await services.supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (!operations.isCurrent(operation)) return null;
        if (error) {
          return isAuthRetryableFetchError(error)
            ? 'Sign-in could not be completed. Check your connection and try again.'
            : 'Email or password is incorrect, or this account cannot sign in.';
        }
        await validate('sign-in', operation);
        return null;
      } catch (error) {
        return isAuthRetryableFetchError(error)
          ? 'Sign-in could not be completed. Check your connection and try again.'
          : 'Email or password is incorrect, or this account cannot sign in.';
      } finally {
        operations.finishExclusive(operation, 'sign-in');
      }
    },
    [commitState, operations, services, validate],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      signIn,
      signOut,
      refresh: () => validate('manual'),
    }),
    [signIn, signOut, state, validate],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = (): AuthContextValue => {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider.');
  return value;
};
