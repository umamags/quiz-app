import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Served from https://umamags.github.io/quiz-app/ (a project subpath, not the
// domain root), so built asset URLs need that prefix -- otherwise the browser
// requests /assets/... instead of /quiz-app/assets/... and gets 404s, which
// is what caused the blank page. Dev server keeps using '/' unaffected.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/quiz-app/' : '/',
  test: {
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
    globals: true,
  },
}));
