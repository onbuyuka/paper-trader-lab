import path from 'path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Project site on GitHub Pages: https://<user>.github.io/paper-trader-lab/
export default defineConfig({
  base: '/paper-trader-lab/',
  // Keep Vitest's dep-optimization cache separate from `vite build`'s, otherwise
  // running a build and the tests back to back corrupts the shared cache.
  cacheDir: process.env.VITEST ? 'node_modules/.vitest-cache' : 'node_modules/.vite',
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
  },
});
