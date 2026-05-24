import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/testing/index.ts', 'src/mock.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
});
