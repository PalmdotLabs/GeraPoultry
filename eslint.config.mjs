import js from '@eslint/js';
import prettierConfig from 'eslint-config-prettier/flat';
import expoConfig from 'eslint-config-expo/flat.js';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const withFiles = (configs, files, settings = {}) =>
  configs.map((config) => ({
    ...config,
    files,
    settings: { ...config.settings, ...settings },
  }));

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/.pnpm-store/**',
      '**/.expo/**',
      '**/.next/**',
      '**/out/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
    ],
  },
  {
    ...js.configs.recommended,
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: globals.node,
      sourceType: 'module',
    },
  },
  ...tseslint.configs.recommended,
  ...withFiles(expoConfig, ['apps/mobile/**/*.{ts,tsx}']),
  ...withFiles(nextVitals, ['apps/web/**/*.{js,jsx,ts,tsx}'], {
    next: { rootDir: 'apps/web' },
  }),
  ...withFiles(nextTypescript, ['apps/web/**/*.{js,jsx,ts,tsx}'], {
    next: { rootDir: 'apps/web' },
  }),
  prettierConfig,
);
