import { spawnSync } from 'node:child_process';
import { getHostedDatabaseConnection } from './hosted-database.mjs';

process.loadEnvFile('apps/web/.env.local');

const { remoteUrl, environment } = getHostedDatabaseConnection();
const apply = process.argv.includes('--apply');

const executable = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const args = [
  '--silent',
  'exec',
  'supabase',
  'db',
  'push',
  '--remote',
  remoteUrl,
];
args.push(apply ? '--yes' : '--dry-run');

console.log(
  `${apply ? 'Applying' : 'Validating'} hosted development migrations without logging database credentials.`,
);
const result = spawnSync(executable, args, {
  env: environment,
  stdio: 'inherit',
});
if (result.error) throw result.error;
if (result.status !== 0) {
  throw new Error(
    `Hosted migration ${apply ? 'push' : 'dry run'} failed with exit code ${result.status ?? 'unknown'}.`,
  );
}
console.log(
  `${apply ? 'Hosted migration apply completed.' : 'Hosted migration dry run completed.'}`,
);
