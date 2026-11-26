import { execFileSync } from 'node:child_process';

export interface LocalSupabaseStatus {
  API_URL?: string;
  ANON_KEY?: string;
  DB_URL?: string;
  SERVICE_ROLE_KEY?: string;
}

const LOOPBACK_HOSTS: Record<string, true> = {
  '127.0.0.1': true,
  localhost: true,
  '[::1]': true,
};

export function assertLoopbackHttpUrl(value: string, label: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid HTTP loopback URL.`);
  }

  if (
    url.protocol !== 'http:' ||
    !Object.hasOwn(LOOPBACK_HOSTS, url.hostname) ||
    url.username ||
    url.password
  ) {
    throw new Error(
      `${label} must use HTTP on loopback without embedded credentials.`,
    );
  }

  return value;
}

export function getLocalSupabaseStatus(): LocalSupabaseStatus {
  const status = JSON.parse(
    execFileSync('supabase', ['status', '-o', 'json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
    }),
  ) as LocalSupabaseStatus;

  if (!status.API_URL) {
    throw new Error(
      'Local Supabase API URL is unavailable. Start local Supabase first.',
    );
  }
  assertLoopbackHttpUrl(status.API_URL, 'Supabase API_URL');
  return status;
}
