import { existsSync, writeFileSync } from 'node:fs';

process.loadEnvFile('apps/web/.env.local');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !publishableKey) {
  throw new Error(
    'The hosted project’s public URL and publishable key are required.',
  );
}

const parsed = new URL(url);
if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
  throw new Error(
    'Mobile public configuration must use the hosted HTTPS Supabase URL without embedded credentials.',
  );
}
if (existsSync('apps/mobile/.env.local')) {
  throw new Error(
    'apps/mobile/.env.local already exists. Review it or remove it deliberately before regenerating.',
  );
}

const contents = [
  `EXPO_PUBLIC_SUPABASE_URL=${JSON.stringify(url)}`,
  `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${JSON.stringify(publishableKey)}`,
  'EXPO_PUBLIC_API_URL=http://10.0.2.2:3000',
  '',
].join('\n');
writeFileSync('apps/mobile/.env.local', contents, { mode: 0o600 });
console.log(
  'Created mobile public environment for hosted Auth and Android-emulator API access; no privileged secrets copied.',
);
