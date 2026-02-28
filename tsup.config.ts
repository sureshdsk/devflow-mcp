import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server/start.ts'],
  outDir: 'dist/server',
  format: ['cjs'],
  target: 'node20',
  clean: true,
  sourcemap: true,
  noExternal: [/(.*)/],
  external: ['better-sqlite3', 'libsql'],
});
