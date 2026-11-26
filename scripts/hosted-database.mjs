const FORWARDED_ENVIRONMENT_VARIABLES = [
  'PATH',
  'HOME',
  'USERPROFILE',
  'SYSTEMROOT',
  'SystemRoot',
  'WINDIR',
  'ComSpec',
  'PATHEXT',
];

export function getHostedDatabaseConnection({
  environment = process.env.SUPABASE_ENVIRONMENT,
  supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL,
  databaseUrl = process.env.SUPABASE_DB_URL,
} = {}) {
  if (environment !== 'development') {
    throw new Error(
      'SUPABASE_ENVIRONMENT must be development for hosted database commands.',
    );
  }
  if (!supabaseUrl || !databaseUrl) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_DB_URL are required.',
    );
  }

  const publicUrl = new URL(supabaseUrl);
  if (publicUrl.protocol !== 'https:') {
    throw new Error(
      'Hosted database commands require the hosted HTTPS Supabase URL.',
    );
  }

  const projectRef = publicUrl.hostname.split('.')[0];
  const database = new URL(databaseUrl);
  if (!['postgres:', 'postgresql:'].includes(database.protocol)) {
    throw new Error('SUPABASE_DB_URL must be a PostgreSQL connection string.');
  }
  if (!database.username || !database.password) {
    throw new Error('SUPABASE_DB_URL must include database credentials.');
  }

  const directHostMatches =
    database.hostname === `db.${projectRef}.supabase.co`;
  const poolerHostMatches =
    database.hostname.endsWith('.pooler.supabase.com') &&
    decodeURIComponent(database.username).endsWith(`.${projectRef}`);
  if (!directHostMatches && !poolerHostMatches) {
    throw new Error(
      'SUPABASE_DB_URL does not match the configured hosted Supabase project.',
    );
  }

  const password = decodeURIComponent(database.password);
  database.password = '';
  database.searchParams.delete('password');
  database.searchParams.delete('sslpassword');

  const childEnvironment = {};
  for (const key of FORWARDED_ENVIRONMENT_VARIABLES) {
    if (process.env[key]) childEnvironment[key] = process.env[key];
  }
  childEnvironment.PGPASSWORD = password;

  return { remoteUrl: database.toString(), environment: childEnvironment };
}
