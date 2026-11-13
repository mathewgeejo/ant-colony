import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  worker: { format: 'es' },
  build: { target: 'es2022', sourcemap: true },
  test: { include: ['tests/**/*.test.ts'], testTimeout: 120000 },
} as any);
