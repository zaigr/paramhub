import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/cli.ts'],
    format: ['esm'],
    dts: true,
    clean: true,
    sourcemap: true,
    external: ['react', 'ink'],
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
  {
    entry: ['src/app.tsx'],
    format: ['esm'],
    dts: true,
    sourcemap: true,
    external: ['react', 'ink'],
  },
]);
