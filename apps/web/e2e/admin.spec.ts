import { expect, Page, test } from '@playwright/test';

/**
 * DoD-style smoke flow (ROADMAP.md §9.2): an admin logs in, creates a route, a
 * variant, and a stop, and the result appears on the public passenger surface —
 * exercising Phase 2 (domain CRUD) and Phase 5 (admin dashboard) end to end through
 * the real UI, not just the API.
 *
 * `next dev` JIT-compiles each route on first visit, which can briefly hot-reload the
 * page (and reset in-flight controlled-input state) shortly after it first paints.
 * `settle()` waits out both the network activity and that reload window before any
 * form is touched.
 */
const ADMIN_BASE = 'http://admin.tubus.localhost:3100';
const SLUG = `e2e-route-${Date.now()}`;

async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
}

test('admin creates a route with a variant and a stop, and it appears on the public page', async ({
  page,
}) => {
  await page.goto(`${ADMIN_BASE}/login`);
  await page.getByLabel('Correo electrónico').fill('admin@rutaejemplo.dev');
  await page.getByLabel('Contraseña').fill('ChangeMe123!');
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await page.waitForURL(`${ADMIN_BASE}/live`);

  await page.goto(`${ADMIN_BASE}/routes`);
  await settle(page);
  await page.getByLabel('Nombre', { exact: true }).fill('Ruta E2E');
  await page.getByLabel('Origen').fill('Origen E2E');
  await page.getByLabel('Destino').fill('Destino E2E');
  await page.getByLabel('Slug público').fill(SLUG);
  await page.getByRole('button', { name: 'Crear ruta' }).click();

  const routeLink = page.getByRole('link', { name: new RegExp(`Ruta E2E.*${SLUG}`) });
  await expect(routeLink).toBeVisible({ timeout: 10_000 });
  await routeLink.click();
  await settle(page);

  await page.getByLabel('Nombre', { exact: true }).fill('Variante E2E');
  await page.getByLabel('Rótulo (headsign)').fill('Hacia Destino E2E');
  await page.getByRole('button', { name: 'Crear variante' }).click();
  await expect(page.getByText('Variante E2E — Hacia Destino E2E')).toBeVisible({
    timeout: 10_000,
  });

  await page.goto(`${ADMIN_BASE}/stops`);
  await settle(page);
  const stopName = `Parada E2E ${Date.now()}`;
  await page.getByLabel('Nombre', { exact: true }).fill(stopName);
  await page.getByLabel('Latitud').fill('9.9333');
  await page.getByLabel('Longitud').fill('-84.0833');
  await page.getByRole('button', { name: 'Agregar parada' }).click();
  // Scoped to the table: a success toast bearing the same name briefly overlaps it.
  await expect(page.getByRole('cell', { name: stopName })).toBeVisible({ timeout: 10_000 });

  await page.goto(`${ADMIN_BASE}/routes`);
  await settle(page);
  await routeLink.click();
  await settle(page);
  // The variant card is collapsed by default — expand it before reaching into its form.
  await page.getByText('Variante E2E — Hacia Destino E2E').click();
  await page
    .locator('form')
    .filter({ hasText: 'Agregar parada' })
    .getByRole('combobox')
    .selectOption({ label: stopName });
  await page.getByRole('button', { name: 'Agregar', exact: true }).click();
  await expect(page.getByRole('listitem').filter({ hasText: stopName })).toBeVisible({
    timeout: 10_000,
  });

  await page.goto(`http://rutaejemplo.localhost:3100/r/${SLUG}`);
  await expect(page.getByText('Origen E2E → Destino E2E')).toBeVisible();
  await expect(page.getByText(stopName)).toBeVisible();
});
