import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Use BASE_URL env var for GitHub Pages, otherwise use root
  base: process.env.BASE_URL || '/',
  resolve: {
    alias: {
      '@core': resolve(__dirname, 'src/core'),
      '@renderer': resolve(__dirname, 'src/renderer'),
      '@ui': resolve(__dirname, 'src/ui')
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
