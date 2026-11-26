import assert from 'node:assert/strict';
import test from 'node:test';
import { getHostedDatabaseConnection } from './hosted-database.mjs';

test('matches the configured project and keeps database credentials out of argv and unrelated child environment values', () => {
  const connection = getHostedDatabaseConnection({
    environment: 'development',
    supabaseUrl: 'https://project-ref.supabase.co',
    databaseUrl:
      'postgresql://postgres.project-ref:s3cr3t%40Value@aws-1-test.pooler.supabase.com:5432/postgres?password=discard-me',
  });

  assert.equal(connection.environment.PGPASSWORD, 's3cr3t@Value');
  assert.equal(new URL(connection.remoteUrl).password, '');
  assert.equal(
    new URL(connection.remoteUrl).searchParams.has('password'),
    false,
  );
  assert.equal(connection.remoteUrl.includes('s3cr3t%40Value'), false);
  assert.equal('SUPABASE_SERVICE_ROLE_KEY' in connection.environment, false);
  assert.equal('HOSTED_ADMIN_PASSWORD' in connection.environment, false);
});

test('refuses unrelated or insecure hosted development targets', () => {
  for (const input of [
    {
      environment: 'production',
      supabaseUrl: 'https://project-ref.supabase.co',
      databaseUrl:
        'postgresql://postgres:pass@db.project-ref.supabase.co/postgres',
    },
    {
      environment: 'development',
      supabaseUrl: 'http://project-ref.supabase.co',
      databaseUrl:
        'postgresql://postgres:pass@db.project-ref.supabase.co/postgres',
    },
    {
      environment: 'development',
      supabaseUrl: 'https://project-ref.supabase.co',
      databaseUrl:
        'postgresql://postgres:pass@db.other-ref.supabase.co/postgres',
    },
  ]) {
    assert.throws(() => getHostedDatabaseConnection(input));
  }
});
