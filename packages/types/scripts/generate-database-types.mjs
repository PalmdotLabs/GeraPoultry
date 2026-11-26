import { spawnSync } from 'node:child_process';
import { writeFileSync, renameSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getHostedDatabaseConnection } from '../../../scripts/hosted-database.mjs';

const workspaceRoot = fileURLToPath(new URL('../../../', import.meta.url));
const outputPath = fileURLToPath(
  new URL('../src/database.ts', import.meta.url),
);
const temporaryPath = `${outputPath}.tmp`;
const executable = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const hosted = process.argv.includes('--hosted');
const generationArgs = [
  '--silent',
  'exec',
  'supabase',
  'gen',
  'types',
  'typescript',
  '--schema',
  'public',
];

let childEnvironment = process.env;
if (hosted) {
  process.loadEnvFile(
    fileURLToPath(new URL('../../../apps/web/.env.local', import.meta.url)),
  );
  const { remoteUrl, environment } = getHostedDatabaseConnection();
  childEnvironment = environment;
  generationArgs.push('--remote', remoteUrl);
} else {
  generationArgs.push('--local');
}

const result = spawnSync(executable, generationArgs, {
  cwd: workspaceRoot,
  env: childEnvironment,
  encoding: 'utf8',
  maxBuffer: 16 * 1024 * 1024,
});

const generatedTypes = result.stdout.trimStart();
if (
  result.error ||
  result.status !== 0 ||
  !/^export type Json\b/.test(generatedTypes)
) {
  throw new Error(
    'Database types could not be generated as valid TypeScript; no output file was changed.',
    result.error ? { cause: result.error } : undefined,
  );
}

try {
  writeFileSync(temporaryPath, result.stdout, 'utf8');
  renameSync(temporaryPath, outputPath);
} finally {
  rmSync(temporaryPath, { force: true });
}

console.log(
  `Generated packages/types/src/database.ts from the ${hosted ? 'hosted development' : 'local'} public schema.`,
);
