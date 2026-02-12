import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: {
    resolve: true,
  },
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  external: ['@modelcontextprotocol/sdk'],
  tsconfig: './tsconfig.json',
});
