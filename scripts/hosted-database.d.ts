export interface HostedDatabaseConnectionInput {
  environment?: string;
  supabaseUrl?: string;
  databaseUrl?: string;
}

export interface HostedDatabaseConnection {
  remoteUrl: string;
  environment: NodeJS.ProcessEnv;
}

export function getHostedDatabaseConnection(
  input?: HostedDatabaseConnectionInput,
): HostedDatabaseConnection;
