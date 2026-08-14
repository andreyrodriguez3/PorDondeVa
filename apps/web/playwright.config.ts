import { defineConfig } from '@playwright/test';

/**
 * Two smoke flows only (ROADMAP.md §9.2): a passenger watching a simulated bus move,
 * and an admin creating a route end to end and seeing it on the public surface.
 * Requires a running Postgres reachable at DATABASE_URL and a seeded database
 * (`pnpm db:seed`) — the specs log in as the seeded company admin and driver.
 */
const PORT = 3100;
const API_PORT = 8080;

export default defineConfig({
  testDir: './e2e',
  // 60s: `next dev` JIT-compiles each route on first hit, and the admin flow now
  // pulls in the full design-system bundle (motion, MapLibre) on that first compile.
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: `http://rutaejemplo.localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'pnpm --filter api dev',
      cwd: '../..',
      url: `http://localhost:${API_PORT}/healthz`,
      reuseExistingServer: true,
      timeout: 60_000,
      env: {
        // Explicit values here win over the repo-root `.env` (dotenv never overrides an
        // already-set process.env var), so this server always resolves the *.localhost
        // hosts the browser and the simulator use, regardless of what `.env` currently
        // has for the jest e2e suite (which needs `admin.tubus.example` instead).
        DATABASE_URL:
          process.env.DATABASE_URL ?? 'postgresql://tubus:tubus@localhost:5433/tubus?schema=public',
        JWT_ACCESS_SECRET: 'playwright-access-secret-not-for-production',
        JWT_REFRESH_SECRET: 'playwright-refresh-secret-not-for-production',
        ACCESS_TOKEN_TTL: '15m',
        REFRESH_TOKEN_TTL: '30d',
        PLATFORM_DOMAIN: 'tubus.localhost',
        ADMIN_HOST: 'admin.tubus.localhost',
        LOG_LEVEL: 'warn',
      },
    },
    {
      command: `next dev -p ${PORT}`,
      cwd: '.',
      // Plain `localhost` — this machine's Node resolver doesn't do the *.localhost
      // special-casing browsers do, so a *.localhost health-check URL never resolves.
      url: `http://localhost:${PORT}/api/health`,
      reuseExistingServer: true,
      timeout: 60_000,
      env: {
        ADMIN_HOST: 'admin.tubus.localhost',
        PUBLIC_API_URL: `http://localhost:${API_PORT}`,
        NEXT_PUBLIC_WS_URL: `ws://localhost:${API_PORT}`,
      },
    },
  ],
});
