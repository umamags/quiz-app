import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

// Exclude large media directories from production builds.
// These assets are served from https://ai-lab.in/data/quiz-app/ in production,
// and used locally from public/ during development.
function copyWithExclusionsPlugin() {
  const mediaDirsToExclude = ['audio', 'images', 'images_downloaded', 'countries_images'];

  return {
    name: 'copy-with-exclusions',
    apply: 'build',
    writeBundle(options) {
      const distDir = options.dir;

      // Remove media directories from dist
      for (const dir of mediaDirsToExclude) {
        const dirPath = path.join(distDir, dir);
        if (fs.existsSync(dirPath)) {
          fs.rmSync(dirPath, { recursive: true, force: true });
          console.log(`[build] Excluded ${dir} from production build`);
        }
      }
    },
  };
}

export default defineConfig(({ command }) => {
  // For production deployment on ai-lab.in, use /quiz-app/ base
  // For local dev/preview, use / base
  let base = '/';
  if (command === 'build' && process.env.DEPLOY_ENV === 'production') {
    base = '/quiz-app/';
  }

  return {
    plugins: [react(), copyWithExclusionsPlugin()],
    base,
    test: {
      environment: 'jsdom',
      setupFiles: './src/setupTests.js',
      globals: true,
    },
  };
});
