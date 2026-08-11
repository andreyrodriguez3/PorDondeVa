import { spawn, ChildProcess } from 'node:child_process';
import path from 'node:path';
import { expect, test } from '@playwright/test';

/**
 * DoD steps 14-18/23 (ROADMAP.md §9.2, "a passenger opens a company host, opens a
 * route, sees a simulated bus move"). Drives the real GPS simulator against the real
 * API, exactly like a driver's phone would — this is the vertical slice Phases 3-4
 * were built to prove.
 */
let simulator: ChildProcess | null = null;

test.afterEach(() => {
  simulator?.kill();
  simulator = null;
});

test('passenger watches a simulated bus appear and move on the route page', async ({ page }) => {
  const simulatorDir = path.resolve(__dirname, '../../../tools/simulator');
  simulator = spawn(
    'npx',
    [
      'ts-node',
      'src/cli.ts',
      '--route',
      'sanjose-palmares',
      '--bus',
      'Bus 24',
      '--speed',
      '300',
      '--interval',
      '1',
      '--admin-host',
      'admin.tubus.localhost',
      '--api-url',
      'http://localhost:8080',
    ],
    { cwd: simulatorDir, shell: true, stdio: 'pipe' },
  );

  let simulatorOutput = '';
  simulator.stdout?.on('data', (chunk) => (simulatorOutput += chunk.toString()));
  simulator.stderr?.on('data', (chunk) => (simulatorOutput += chunk.toString()));

  // Give the simulator a moment to log in, start the trip, and post its first fix
  // before the passenger opens the page — otherwise the very first SSR snapshot
  // would legitimately show no active buses yet.
  await expect.poll(() => simulatorOutput.includes('accepted'), { timeout: 15_000 }).toBe(true);

  await page.goto('/r/sanjose-palmares');

  await expect(page.getByRole('heading', { name: 'San José → Palmares' })).toBeVisible();
  await expect(page.getByText('Bus 24')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/en vivo/i)).toBeVisible({ timeout: 15_000 });
});
