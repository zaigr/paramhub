import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/testing/index.ts', 'src/mock.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  // vitest is a devDependency, so tsup would otherwise bundle it into the
  // testing entry. The conformance suite must use the *consumer's* vitest
  // instance (the one running the tests) or its describe/it calls register
  // against a detached runner and silently collect nothing.
  external: ['vitest'],
});
