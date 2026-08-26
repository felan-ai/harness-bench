import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: '/tests',
  resolve: {
    alias: { '@': resolve(process.env.STORZY_ROOT ?? '/workspace') },
  },
  test: {
    environment: 'node',
    passWithNoTests: false,
  },
});
