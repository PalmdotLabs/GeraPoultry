import { createApiClient, type ApiClient } from '@poultry/api-client';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  getMobileEnvironment,
  type MobileEnvironment,
} from '../config/environment';
import { secureStoreAuthStorage } from './secure-store-adapter';

const AUTH_STORAGE_KEY = 'poultry-employee-auth';

export interface AuthServices {
  supabase: SupabaseClient;
  apiClient: ApiClient;
  environment: MobileEnvironment;
  clearPersistedSession: () => Promise<void>;
  markLogoutCleanupRequired: () => Promise<void>;
  getLogoutCleanupRequired: () => Promise<boolean>;
  clearLogoutCleanupRequired: () => Promise<void>;
  withLogoutCleanupReadAuthority: <Result>(
    operation: () => Promise<Result>,
  ) => Promise<Result>;
}

export const createBearerTokenProvider =
  (supabase: SupabaseClient) => async (): Promise<string> => {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      throw new Error('The current access token is unavailable.');
    }
    if (!data.session?.access_token) {
      throw new Error('An authenticated access token is required.');
    }
    return data.session.access_token;
  };

export const createAuthServices = (): AuthServices => {
  const environment = getMobileEnvironment();
  const supabase = createClient(
    environment.supabaseUrl,
    environment.supabasePublishableKey,
    {
      auth: {
        storageKey: AUTH_STORAGE_KEY,
        storage: secureStoreAuthStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    },
  );

  return {
    environment,
    supabase,
    clearPersistedSession: () =>
      secureStoreAuthStorage.removeItem(AUTH_STORAGE_KEY),
    markLogoutCleanupRequired: () =>
      secureStoreAuthStorage.markLogoutCleanupRequired(AUTH_STORAGE_KEY),
    getLogoutCleanupRequired: () =>
      secureStoreAuthStorage.getLogoutCleanupRequired(AUTH_STORAGE_KEY),
    clearLogoutCleanupRequired: () =>
      secureStoreAuthStorage.clearLogoutCleanupRequired(AUTH_STORAGE_KEY),
    withLogoutCleanupReadAuthority: <Result>(
      operation: () => Promise<Result>,
    ) =>
      secureStoreAuthStorage.withLogoutCleanupReadAuthority(
        AUTH_STORAGE_KEY,
        operation,
      ),
    apiClient: createApiClient({
      baseUrl: environment.apiUrl,
      getAccessToken: createBearerTokenProvider(supabase),
    }),
  };
};
