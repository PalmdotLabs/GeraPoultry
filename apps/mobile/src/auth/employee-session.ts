import {
  isAuthApiError,
  isAuthError,
  isAuthRetryableFetchError,
  isAuthSessionMissingError,
} from '@supabase/supabase-js';
import {
  ApiClientError,
  type ApiClient,
  type Session,
} from '@poultry/api-client';

export type EmployeeSessionResult =
  | { kind: 'verified'; account: Session }
  | { kind: 'inactive' }
  | { kind: 'unauthenticated' }
  | { kind: 'retryable' };

export const validateEmployeeSession = async (
  apiClient: ApiClient,
): Promise<EmployeeSessionResult> => {
  try {
    const account = await apiClient.getSession();
    return { kind: 'verified', account };
  } catch (error) {
    if (error instanceof ApiClientError) {
      if (error.status === 403 || error.code === 'FORBIDDEN') {
        return { kind: 'inactive' };
      }
      if (error.status === 401 || error.code === 'UNAUTHENTICATED') {
        return { kind: 'unauthenticated' };
      }
    }
    return { kind: 'retryable' };
  }
};

export type AuthSessionErrorDecision = 'absent' | 'rejected' | 'retryable';

const rejectedAuthCodes: Record<string, true> = {
  bad_jwt: true,
  user_not_found: true,
  session_not_found: true,
  session_expired: true,
  refresh_token_not_found: true,
  refresh_token_already_used: true,
};

export const classifyAuthSessionError = (
  error: unknown,
): AuthSessionErrorDecision => {
  if (isAuthSessionMissingError(error)) return 'absent';
  if (isAuthRetryableFetchError(error)) return 'retryable';
  if (!isAuthError(error)) return 'retryable';

  if (
    typeof error.code === 'string' &&
    rejectedAuthCodes[error.code] === true
  ) {
    return 'rejected';
  }
  if (
    isAuthApiError(error) &&
    error.status >= 400 &&
    error.status < 500 &&
    error.status !== 408 &&
    error.status !== 429
  ) {
    return 'rejected';
  }
  return 'retryable';
};

export type AutomaticValidationState =
  | 'configurationError'
  | 'restoring'
  | 'signedOut'
  | 'validating'
  | 'validationError'
  | 'inactive'
  | 'authenticated'
  | 'signingOut'
  | 'cleanupFailed';

export const allowsAutomaticSessionValidation = (
  status: AutomaticValidationState,
): boolean => status === 'authenticated';

export type ExclusiveAuthOperation = 'sign-in' | 'cleanup';

/**
 * Synchronously owns authentication generations. Claiming or invalidating an
 * operation happens before its first await, so late promises cannot acquire a
 * newer operation's authority.
 */
export class AuthOperationCoordinator {
  private generation = 0;
  private active = true;
  private exclusive: {
    generation: number;
    kind: ExclusiveAuthOperation;
  } | null = null;

  begin(): number {
    this.generation += 1;
    return this.generation;
  }

  claimExclusive(
    kind: ExclusiveAuthOperation,
    generation?: number,
  ): number | null {
    if (this.exclusive) return null;
    const claimed = generation ?? this.begin();
    if (!this.isCurrent(claimed)) return null;
    this.exclusive = { generation: claimed, kind };
    return claimed;
  }

  transitionExclusive(
    from: ExclusiveAuthOperation,
    to: ExclusiveAuthOperation,
    generation: number,
  ): boolean {
    if (
      !this.isCurrent(generation) ||
      this.exclusive?.generation !== generation ||
      this.exclusive.kind !== from
    ) {
      return false;
    }
    this.exclusive = { generation, kind: to };
    return true;
  }

  finishExclusive(generation: number, kind: ExclusiveAuthOperation): void {
    if (
      this.exclusive?.generation === generation &&
      this.exclusive.kind === kind
    ) {
      this.exclusive = null;
    }
  }

  hasExclusiveOperation(): boolean {
    return this.exclusive !== null;
  }

  isCurrent(operation: number): boolean {
    return this.active && operation === this.generation;
  }

  current(): number {
    return this.generation;
  }

  invalidate(): number {
    this.exclusive = null;
    return this.begin();
  }

  unmount(): void {
    this.active = false;
    this.invalidate();
  }

  remount(): void {
    this.active = true;
  }
}

export const isLogoutCleanupRequired = async (
  getLogoutCleanupRequired: () => Promise<boolean>,
): Promise<boolean> => {
  try {
    return await getLogoutCleanupRequired();
  } catch {
    // An unreadable barrier cannot safely authorize restoring stored secrets.
    return true;
  }
};

export type LogoutCleanupRestoreResult<Result> =
  { kind: 'cleanup-required' } | { kind: 'ready'; result: Result };

export const restoreSessionWithCleanupBarrier = async <Result>(
  getLogoutCleanupRequired: () => Promise<boolean>,
  restore: () => Promise<Result>,
): Promise<LogoutCleanupRestoreResult<Result>> => {
  if (await isLogoutCleanupRequired(getLogoutCleanupRequired)) {
    return { kind: 'cleanup-required' };
  }
  return { kind: 'ready', result: await restore() };
};

export interface LocalSignOutAuth {
  signOut(options: { scope: 'local' }): Promise<{ error: unknown }>;
}

export interface LocalSignOutResult {
  cleared: boolean;
  warning: string | null;
}

export const signOutLocally = async (
  auth: LocalSignOutAuth,
  clearProtectedSession: () => Promise<void>,
  shouldClearProtectedSession: () => boolean = () => true,
): Promise<LocalSignOutResult> => {
  try {
    const result = await auth.signOut({ scope: 'local' });
    if (result.error) {
      throw new Error('Local sign-out did not complete.');
    }
    if (!shouldClearProtectedSession()) {
      return { cleared: false, warning: null };
    }
    return { cleared: true, warning: null };
  } catch {
    if (!shouldClearProtectedSession()) {
      return { cleared: false, warning: null };
    }
    try {
      await clearProtectedSession();
      return {
        cleared: true,
        warning:
          'Signed out on this device. Other devices were not signed out.',
      };
    } catch {
      return {
        cleared: false,
        warning:
          'Protected sign-in data could not be fully cleared. Retry local cleanup before signing in again.',
      };
    }
  }
};

export interface LogoutCleanupBarrier {
  markLogoutCleanupRequired(): Promise<void>;
  clearLogoutCleanupRequired(): Promise<void>;
  withLogoutCleanupReadAuthority?<Result>(
    operation: () => Promise<Result>,
  ): Promise<Result>;
}

export const signOutWithLogoutCleanupBarrier = async (
  auth: LocalSignOutAuth,
  clearProtectedSession: () => Promise<void>,
  shouldClearProtectedSession: () => boolean,
  barrier: LogoutCleanupBarrier,
): Promise<LocalSignOutResult> => {
  if (!shouldClearProtectedSession()) {
    return { cleared: false, warning: null };
  }

  try {
    await barrier.markLogoutCleanupRequired();
  } catch {
    // A marker write failure must not suppress the actual Auth cleanup attempt.
  }
  if (!shouldClearProtectedSession()) {
    return { cleared: false, warning: null };
  }

  const scopedAuth: LocalSignOutAuth = {
    signOut: (options) =>
      barrier.withLogoutCleanupReadAuthority
        ? barrier.withLogoutCleanupReadAuthority(() => auth.signOut(options))
        : auth.signOut(options),
  };
  const result = await signOutLocally(
    scopedAuth,
    clearProtectedSession,
    shouldClearProtectedSession,
  );
  if (!result.cleared || !shouldClearProtectedSession()) return result;

  try {
    await barrier.clearLogoutCleanupRequired();
    return result;
  } catch {
    return {
      cleared: false,
      warning:
        'Protected sign-in data could not be fully cleared. Retry local cleanup before signing in again.',
    };
  }
};
