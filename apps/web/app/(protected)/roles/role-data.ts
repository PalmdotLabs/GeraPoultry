'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { useRouter } from 'next/navigation';
import { ApiClientError, createApiClient } from '@poultry/api-client';
import type { RoleList } from '@poultry/validation';

export const roleApi = createApiClient({ credentials: 'same-origin' });

type TerminalStatus = 'redirecting' | 'forbidden' | null;
type ErrorSource = 'load' | 'mutation';

interface RoleData {
  data: RoleList | null;
  setData: Dispatch<SetStateAction<RoleList | null>>;
  loading: boolean;
  error: string | null;
  terminalStatus: TerminalStatus;
  reload: () => void;
  handleError: (
    caught: unknown,
    fallback: string,
    options?: { source?: ErrorSource },
  ) => string;
}

export function useRoleData(returnTo: string): RoleData {
  const router = useRouter();
  const [data, setData] = useState<RoleList | null>(null);
  const [revision, setRevision] = useState(0);
  const [terminalStatus, setTerminalStatus] = useState<TerminalStatus>(null);

  const handleError = useCallback(
    (
      caught: unknown,
      fallback: string,
      options: { source?: ErrorSource } = {},
    ) => {
      if (!(caught instanceof ApiClientError)) return fallback;

      if (caught.status === 401) {
        setTerminalStatus('redirecting');
        router.replace(`/login?next=${encodeURIComponent(returnTo)}`);
      } else if (
        caught.status === 403 &&
        (options.source ?? 'load') === 'load'
      ) {
        setTerminalStatus('forbidden');
      }

      return caught.message;
    },
    [returnTo, router],
  );

  const reload = useCallback(() => {
    setRevision((current) => current + 1);
  }, []);
  const request = useMemo(
    () => ({ handleError, revision }),
    [handleError, revision],
  );
  const [settlement, setSettlement] = useState<{
    request: object;
    error: string | null;
  } | null>(null);
  const loading = settlement?.request !== request;
  const error = settlement?.request === request ? settlement.error : null;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    void roleApi
      .listRoles({ signal: controller.signal })
      .then((result) => {
        if (!active) return;
        setData(result);
        setSettlement({ request, error: null });
      })
      .catch((caught: unknown) => {
        if (!active || controller.signal.aborted) return;
        setData(null);
        setSettlement({
          request,
          error: request.handleError(
            caught,
            'Roles and permissions could not be loaded. Try again.',
          ),
        });
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [request]);

  return {
    data,
    setData,
    loading,
    error,
    terminalStatus,
    reload,
    handleError,
  };
}
