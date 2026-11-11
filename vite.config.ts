import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { packsPlugin } from './build/packs-plugin.ts';

export default defineConfig({
  // Relative base plus hash routing lets the build run from any static host or sub-path.
  base: './',
  plugins: [react(), packsPlugin()],
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'scripts/**/*.test.ts'],
  },
});
