import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { startServer } from './server';
import brand from '../src/brand.json' with { type: 'json' };
import { MODEL_FILES } from '../src/scan/model-files';

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

test('the hidden speed test runs the scan model and names the Deathcap from its own photo', async ({ page }) => {
  test.setTimeout(120_000);
  test.skip(MODEL_FILES.length === 0, 'no 8-bit model file yet (plan 2d-1, task 7)');
  await page.goto(`${site.url}#/about`);
  await page.getByRole('link', { name: 'Scan speed test' }).click();
  await expect(page.getByRole('heading', { name: 'Scan speed test' })).toBeVisible();
  await page.getByRole('button', { name: 'Run with WebAssembly' }).first().click();
  const row = page.locator('[data-test=speed-results] tbody tr').first();
  await expect(row).toBeVisible({ timeout: 90_000 });
  await expect(row.locator('[data-test=scan-seconds]')).toHaveText(/^\d+\.\d\d s$/);
  await expect(row).toContainText('Deathcap');
});

const EDIBILITY_WORDS = /Edible, cooked|Edible, but some people react|Not edible|\bsafe\b/i;

test('Identify narrows question by question and never drops a dangerous lookalike', async ({ page }) => {
  await page.goto(`${site.url}#/identify`);
  await expect(page.getByRole('heading', { name: 'What is under the cap?' })).toBeVisible();
  for (const answer of ['Gills (thin blades)', 'The ground (soil, grass, leaves)', 'No ring, and no trace of one',
    'No bag: I dug out the whole base', 'Not sure', 'I have not made one']) {
    await page.getByRole('link', { name: answer, exact: true }).click();
  }
  await expect(page.getByRole('heading', { name: 'Fit every answer (4)' })).toBeVisible();
  const rows = page.locator('[data-test=identify-row]');
  await expect(rows.filter({ hasText: 'Field Mushroom' }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: /Kept on the list: dangerous lookalikes/ })).toBeVisible();
  for (const name of ['Deathcap', 'Destroying Angel']) {
    await expect(rows.filter({ hasText: name }).filter({ hasText: 'Mistaken for Field Mushroom' })).toHaveCount(1);
  }
  expect(await page.locator('main').innerText()).not.toMatch(EDIBILITY_WORDS);
});

test('Identify: "Not sure" never narrows, and an answer can be changed', async ({ page }) => {
  await page.goto(`${site.url}#/identify`);
  await page.getByRole('link', { name: 'Gills (thin blades)', exact: true }).click();
  await expect(page.locator('[data-test=answers]')).toContainText('Gills (thin blades)');
  await page.getByRole('link', { name: 'change' }).click();
  await expect(page.getByRole('heading', { name: 'What is under the cap?' })).toBeVisible();
  await expect(page.locator('[data-test=answers]')).toHaveCount(0);
  for (let i = 0; i < 6; i++) await page.locator('a.choice.unsure').click();
  await expect(page.getByRole('heading', { name: 'Fit every answer (10)' })).toBeVisible();
});

test('Check turns a feature red when it fits a lookalike, and never says anything about eating it', async ({ page }) => {
  await page.goto(`${site.url}#/species/field-mushroom`);
  await page.getByRole('link', { name: 'Check a mushroom against this one' }).click();
  await expect(page.getByRole('heading', { name: 'Check: Field Mushroom' })).toBeVisible();
  const spore = page.locator('[data-test=check-row]').filter({ has: page.getByRole('heading', { name: 'Spore print' }) });
  await spore.getByRole('button', { name: /Deathcap\s*White/ }).click();
  await expect(spore).toHaveClass(/red/);
  await expect(page.locator('[data-test=verdict]')).toContainText('Treat your mushroom as Deathcap or Destroying Angel');
  await spore.getByRole('button', { name: /Field Mushroom\s*Chocolate brown/ }).click();
  await expect(spore).not.toHaveClass(/red/);
  await expect(page.locator('[data-test=verdict]')).toContainText('That is not proof');
  await expect(page.getByRole('heading', { name: 'Before eating any wild mushroom' })).toBeVisible();
  expect(await page.locator('main').innerText()).not.toMatch(EDIBILITY_WORDS);
});
