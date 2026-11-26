import { spawn } from 'node:child_process';
import { getLocalSupabaseStatus } from './local-supabase';

const [command, ...args] = process.argv.slice(2);
if (!command) {
  throw new Error(
    'Usage: tsx scripts/with-local-supabase.ts <command> [...args]',
  );
}

const status = getLocalSupabaseStatus();
if (!status.API_URL || !status.ANON_KEY) {
  throw new Error(
    'Local Supabase anonymous key is unavailable. Start local Supabase first.',
  );
}

const child = spawn(command, args, {
  env: {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
    // Override both aliases: Next otherwise loads a hosted publishable key from
    // .env.local, which config.ts prefers over this local anonymous key.
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.ANON_KEY,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY,
  },
  stdio: 'inherit',
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill(signal);
    }
  });
}

child.on('error', (error) => {
  throw error;
});

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`Local web command stopped by ${signal}.`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = code ?? 1;
});
