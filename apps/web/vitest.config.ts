import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    // e2e/ holds Playwright specs (`pnpm test:e2e`) — Vitest's default glob would
    // otherwise pick them up too and fail on Playwright's own `test()` global.
    exclude: ['**/node_modules/**', 'e2e/**'],
  },
});
