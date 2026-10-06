import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { startServer } from './server';
import brand from '../src/brand.json' with { type: 'json' };

const DIST = fileURLToPath(new URL('../dist', import.meta.url));
const BANNER = 'Test version — not for identifying mushrooms';
let site: Awaited<ReturnType<typeof startServer>>;

test.beforeEach(async () => { site = await startServer(DIST); });
test.afterEach(async () => { await site.stop(); });

test('shows the TEST banner and the ten sample species', async ({ page }) => {
  await page.goto(site.url);
  await expect(page.getByText(BANNER)).toBeVisible();
  await expect(page.locator('[data-test=species-row]')).toHaveCount(10);
});

test('search narrows the list', async ({ page }) => {
  await page.goto(`${site.url}#/guide?q=amanita`);
  await expect(page.locator('[data-test=species-row]')).toHaveCount(2);
});

test('a species page shows its edibility, lookalikes and photo credits, and a lookalike opens its page', async ({ page }) => {
  await page.goto(`${site.url}#/species/field-mushroom`);
  await expect(page.getByRole('heading', { name: 'Field Mushroom' })).toBeVisible();
  await expect(page.getByText('Edible, cooked').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: /Yellow Stainer/ })).toBeVisible();
  await expect(page.locator('figcaption').first()).toContainText('iNaturalist');
  await page.getByRole('link', { name: 'Yellow Stainer', exact: true }).click(); // source titles name it too
  await expect(page.getByRole('heading', { name: 'Yellow Stainer', exact: true })).toBeVisible();
  await expect(page.getByText(BANNER)).toBeVisible();
});

test('no page ever says "safe"', async ({ page }) => {
  for (const slug of ['field-mushroom', 'horse-mushroom', 'yellow-stainer', 'destroying-angel', 'deathcap', 'chanterelle', 'false-chanterelle', 'deadly-webcap', 'parasol', 'deadly-dapperling']) {
    await page.goto(`${site.url}#/species/${slug}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await page.locator('main').innerText()).not.toMatch(/\bsafe\b/i);
  }
});

test('works with the server switched off once it has been opened', async ({ page }) => {
  await page.goto(site.url);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await site.stop();
  await page.reload();
  await expect(page.getByText(BANNER)).toBeVisible();
  await expect(page.locator('[data-test=species-row]')).toHaveCount(10);
  await page.goto(`${site.url}#/species/deathcap`);
  await expect(page.getByRole('heading', { name: 'Deathcap' })).toBeVisible();
});

test('About says whether the phone keeps the data (the app asks at start)', async ({ page }) => {
  await page.goto(`${site.url}#/about`);
  await expect(page.getByText(/Storage kept by the phone: (yes|not yet|not supported in this browser)$/)).toBeVisible();
});

test('the header shows the name and tagline from src/brand.json, and takes you to the guide', async ({ page }) => {
  await page.goto(`${site.url}#/learn`);
  const header = page.locator('header.app-header');
  await expect(header).toContainText(brand.name);
  await expect(header).toContainText(brand.tagline);
  await header.getByRole('link').click();
  await expect(page.locator('[data-test=species-row]')).toHaveCount(10);
});
