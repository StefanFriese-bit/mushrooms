import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { startServer } from './server';
import brand from '../src/brand.json' with { type: 'json' };
import { MODEL_FILES } from '../src/scan/model-files';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { packBackup } from '../src/finds/backup';
import { narrow, QUESTIONS, UNSURE, type Answers } from '../src/identify';
import { searchSpecies } from '../src/species';
import type { SpeciesRecord } from '../src/types';
import { osGridRef, plusCode } from '../src/finds/codes';
import { distanceM, sayDistance } from '../src/finds/geo';

const DIST = fileURLToPath(new URL('../dist', import.meta.url));
const TEST_WORDS = /test version|\(test\)/i; // the early test version's wording, gone since 06/10/2026
let site: Awaited<ReturnType<typeof startServer>>;
// The guide grows batch by batch, so the expected numbers are worked out from the content itself.
const SPECIES_DIR = new URL('../content/species/', import.meta.url);
const ALL = readdirSync(SPECIES_DIR).filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(new URL(f, SPECIES_DIR), 'utf8')) as SpeciesRecord);
/** The Identify answers that the buttons with these labels give, in question order. */
function answersFor(labels: string[]): Answers {
  const a: Answers = {};
  QUESTIONS.forEach((q, i) => { a[q.id] = labels[i] === q.unsureLabel ? UNSURE : q.options.find((o) => o.label === labels[i])!.value; });
  return a;
}

test.beforeEach(async () => { site = await startServer(DIST); });
test.afterEach(async () => { await site.stop(); });

test('every species is in the guide, and no screen calls the app a test version', async ({ page }) => {
  await page.goto(site.url);
  await expect(page.locator('[data-test=species-row]')).toHaveCount(ALL.length);
  expect(await page.title()).not.toMatch(TEST_WORDS);
  for (const route of ['#/guide', '#/identify', '#/scan', '#/finds', '#/learn', '#/about', '#/species/deathcap']) {
    await page.goto(`${site.url}${route}`);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    expect(await page.locator('body').innerText()).not.toMatch(TEST_WORDS);
  }
  await page.goto(`${site.url}#/about`);
  await expect(page.getByText("Never eat a mushroom on this app's word.")).toBeVisible();
});

test('search narrows the list', async ({ page }) => {
  await page.goto(`${site.url}#/guide?q=amanita`);
  const expected = searchSpecies(ALL, 'amanita').length;
  expect(expected).toBeGreaterThan(1);
  expect(expected).toBeLessThan(ALL.length);
  await expect(page.locator('[data-test=species-row]')).toHaveCount(expected);
});

test('a species page shows its edibility, lookalikes and photo credits, and a lookalike opens its page', async ({ page }) => {
  await page.goto(`${site.url}#/species/field-mushroom`);
  await expect(page.getByRole('heading', { name: 'Field Mushroom' })).toBeVisible();
  await expect(page.getByText('Edible, cooked').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: /Yellow Stainer/ })).toBeVisible();
  await expect(page.locator('figcaption').first()).toContainText('iNaturalist');
  await page.getByRole('link', { name: 'Yellow Stainer', exact: true }).click(); // source titles name it too
  await expect(page.getByRole('heading', { name: 'Yellow Stainer', exact: true })).toBeVisible();
  await expect(page.locator('header.app-header')).toContainText(brand.name);
});

test('no page ever says "safe"', async ({ page }) => {
  for (const slug of ALL.map((s) => s.slug)) {
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
  await expect(page.locator('header.app-header')).toContainText(brand.name);
  await expect(page.locator('[data-test=species-row]')).toHaveCount(ALL.length);
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
  await expect(page.locator('[data-test=species-row]')).toHaveCount(ALL.length);
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
  // Every model on the page names it with its own species list (the FungiTastic candidate has 2,829 species).
  for (let k = 1; k < MODEL_FILES.length; k++) {
    await page.getByRole('button', { name: 'Run with WebAssembly' }).nth(k).click();
    const next = page.locator('[data-test=speed-results] tbody tr').nth(k);
    await expect(next).toBeVisible({ timeout: 90_000 });
    await expect(next).toContainText(MODEL_FILES[k].label.split(' (')[0]);
    await expect(next).toContainText('Deathcap');
  }
});

const EDIBILITY_WORDS = /Edible, cooked|Edible, but some people react|Not edible|\bsafe\b/i;

test('Identify narrows question by question and never drops a dangerous lookalike', async ({ page }) => {
  await page.goto(`${site.url}#/identify`);
  await expect(page.getByRole('heading', { name: 'What is under the cap?' })).toBeVisible();
  const labels = ['Gills (thin blades)', 'The ground (soil, grass, leaves)', 'No ring, and no trace of one',
    'No bag: I dug out the whole base', 'Not sure', 'I have not made one'];
  for (const answer of labels) await page.getByRole('link', { name: answer, exact: true }).click();
  const fit = narrow(ALL, answersFor(labels)).matches.length;
  expect(fit).toBeGreaterThan(1);
  await expect(page.getByRole('heading', { name: `Fit every answer (${fit})` })).toBeVisible();
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
  await expect(page.getByRole('heading', { name: `Fit every answer (${ALL.length})` })).toBeVisible();
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

test('Check on a deadly species: its own features are red; an edible lookalike\'s features are no reason to trust it', async ({ page }) => {
  await page.goto(`${site.url}#/check/deathcap`);
  await expect(page.getByRole('heading', { name: /Check: Deathcap/ })).toBeVisible();
  const row = (feature: string) => page.locator('[data-test=check-row]').filter({ has: page.getByRole('heading', { name: feature, exact: true }) });
  await row('Stem base').getByRole('button', { name: /Field Mushroom\s*No bag/ }).click();
  await expect(row('Stem base')).not.toHaveClass(/red/);
  const verdict = page.locator('[data-test=verdict]');
  await expect(verdict).toContainText('That is not proof');
  await expect(verdict).not.toContainText('Treat your mushroom as Field Mushroom');
  await expect(verdict.getByRole('link', { name: /Check it against the Field Mushroom/ })).toBeVisible();
  await row('Spore print').getByRole('button', { name: /Deathcap\s*White/ }).click();
  await expect(row('Spore print')).toHaveClass(/red/);
  await expect(verdict).toContainText('Treat your mushroom as Deathcap: do not eat it');
});

// Finds: no real map service in tests — the map style is a plain background, so only the app's own code is tested.
const PLAIN_MAP = { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#e8efe0' } }] };
const PHOTO = fileURLToPath(new URL('../public/photos/chanterelle/1.webp', import.meta.url));
test.describe('Finds', () => {
  test.use({ serviceWorkers: 'block', geolocation: { latitude: 51.6588, longitude: 0.0466, accuracy: 7 }, permissions: ['geolocation'] });
  test.beforeEach(async ({ page }) => {
    await page.route('https://tiles.openfreemap.org/**', (r) => (r.request().url().includes('/styles/') ? r.fulfill({ json: PLAIN_MAP }) : r.fulfill({ status: 404 })));
  });

  test('a find saves its GPS spot, photo, species and notes on the phone, and "Take me there" walks to it', async ({ page }) => {
    const hosts = new Set<string>();
    page.on('request', (r) => { const u = new URL(r.url()); if (/^https?:$/.test(u.protocol)) hosts.add(u.host); }); // blob: = in the phone's memory
    await page.goto(`${site.url}#/finds`);
    await page.getByRole('link', { name: 'Add a find here' }).click();
    await expect(page.locator('[data-test=where]')).toContainText('Your position, within 7 m', { timeout: 15000 });
    await page.locator('input[type=file]').setInputFiles(PHOTO);
    await expect(page.locator('.thumbs img')).toHaveCount(1);
    await page.getByLabel('What it is').selectOption('Cantharellus cibarius');
    await page.getByLabel('Notes').fill('Under beech, by the stream.');
    await page.getByRole('button', { name: 'Save the find' }).click();
    await expect(page.getByRole('heading', { name: 'Chanterelle', exact: true })).toBeVisible();
    await expect(page.locator('[data-test=take-me-there]')).toHaveAttribute('href', 'https://maps.apple.com/?daddr=51.65880,0.04660&dirflg=w');
    await expect(page.getByText('Under beech, by the stream.')).toBeVisible();
    await expect(page.locator('.photos img')).toHaveCount(1);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Chanterelle', exact: true })).toBeVisible();
    await page.goto(`${site.url}#/finds`);
    await expect(page.locator('[data-test=find-row]')).toHaveCount(1);
    await expect(page.locator('[data-test=map-pin]')).toHaveCount(1);
    // Spec 9: his finds go nowhere — the only addresses are the app's own and the map's.
    expect([...hosts].filter((h) => h !== new URL(site.url).host && h !== 'tiles.openfreemap.org')).toEqual([]);
  });

  test('Find it again: how far and which way, then "you are there" with its photos; its grid reference and Plus Code', async ({ page, context }) => {
    const spot = { lat: 51.6588, lon: 0.0466 };
    await page.goto(`${site.url}#/finds/new`);
    await expect(page.locator('[data-test=where]')).toContainText('within 7 m', { timeout: 15000 });
    await page.locator('input[type=file]').setInputFiles(PHOTO);
    await expect(page.locator('.thumbs img')).toHaveCount(1);
    await page.getByRole('button', { name: 'Save the find' }).click();
    await expect(page.locator('[data-test=os-grid]')).toHaveText(osGridRef(spot)!);
    await expect(page.locator('[data-test=plus-code]')).toHaveText(plusCode(spot));
    // He walks away: 40 m south of it.
    const away = { lat: spot.lat - 0.00036, lon: spot.lon };
    await context.setGeolocation({ latitude: away.lat, longitude: away.lon, accuracy: 5 });
    await page.locator('[data-test=find-again]').click();
    await expect(page.locator('[data-test=go-distance]')).toHaveText(sayDistance(distanceM(away, spot)), { timeout: 15000 });
    await expect(page.getByText('Head north', { exact: true })).toBeVisible();
    await expect(page.locator('[data-test=go-arrow]')).toHaveCount(1);
    await expect(page.locator('[data-test=here-dot]')).toHaveCount(1);
    // Back at the spot: as close as GPS can tell, and his own photos to recognise it by.
    await context.setGeolocation({ latitude: spot.lat, longitude: spot.lon, accuracy: 5 });
    await page.reload();
    await expect(page.locator('[data-test=go-distance]')).toHaveText('You are there', { timeout: 15000 });
    await expect(page.locator('[data-test=go-there] img')).toHaveCount(1);
  });

  test('backup and restore: one file brings a deleted find back with its photo; a damaged file changes nothing', async ({ page }, info) => {
    await page.addInitScript(() => { Object.defineProperty(navigator, 'canShare', { value: undefined }); }); // the download route
    await page.goto(`${site.url}#/finds/new`);
    await expect(page.locator('[data-test=where]')).toContainText('within 7 m', { timeout: 15000 });
    await page.locator('input[type=file]').setInputFiles(PHOTO);
    await expect(page.locator('.thumbs img')).toHaveCount(1);
    await page.getByLabel('What it is').selectOption('Cantharellus cibarius');
    await page.getByRole('button', { name: 'Save the find' }).click();
    await expect(page.getByRole('heading', { name: 'Chanterelle', exact: true })).toBeVisible();
    await page.goto(`${site.url}#/finds`);
    await expect(page.locator('[data-test=backup-reminder]')).toContainText('1 find is not in a backup yet');
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Back up 1 find' }).click()]);
    expect(download.suggestedFilename()).toMatch(/^mushroom-finds-\d{4}-\d{2}-\d{2}\.zip$/);
    const file = info.outputPath('backup.zip');
    await download.saveAs(file);
    await expect(page.locator('[data-test=backup-reminder]')).toHaveCount(0);
    await expect(page.locator('[data-test=backup]')).toContainText('Last backup:');
    // The find is deleted …
    await page.locator('[data-test=find-row]').first().click();
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Delete this find' }).click();
    await expect(page.locator('[data-test=find-row]')).toHaveCount(0);
    // … and the file brings it back, photo and all.
    await page.getByLabel('Backup file to restore').setInputFiles(file);
    await expect(page.locator('[data-test=backup-said]')).toHaveText('Restored 1 find.');
    await expect(page.locator('[data-test=find-row]')).toHaveCount(1);
    await page.locator('[data-test=find-row]').first().click();
    await expect(page.getByRole('heading', { name: 'Chanterelle', exact: true })).toBeVisible();
    await expect(page.locator('.photos img')).toHaveCount(1);
    // Restoring again adds nothing twice; a damaged file changes nothing.
    await page.goto(`${site.url}#/finds`);
    await page.getByLabel('Backup file to restore').setInputFiles(file);
    await expect(page.locator('[data-test=backup-said]')).toHaveText('Restored 0 finds; 1 find was already on this phone and left as it was.');
    const bytes = readFileSync(file);
    await page.getByLabel('Backup file to restore').setInputFiles({ name: 'broken.zip', mimeType: 'application/zip', buffer: bytes.subarray(0, bytes.length - 60) });
    await expect(page.locator('[data-test=backup-said]')).toHaveText("That file can't be restored. Nothing was changed.");
    await expect(page.locator('[data-test=find-row]')).toHaveCount(1);
  });

  test('filters: by species, and this month in past years — the map and the list together', async ({ page }, info) => {
    const now = new Date();
    const on = (y: number, m: number) => new Date(now.getFullYear() - y, m, 5, 10).toISOString();
    const other = (now.getMonth() + 6) % 12;
    const f = (id: string, at: string, species: string | null) =>
      ({ id, at, spot: { lat: 51.6588, lon: 0.0466 + Number(id.slice(1)) / 1000, accuracy: 8 }, species, notes: '', photoIds: [] });
    const file = info.outputPath('old-finds.zip');
    writeFileSync(file, packBackup([
      f('f1', on(1, now.getMonth()), 'Cantharellus cibarius'), // this month, last year
      f('f2', on(1, other), 'Cantharellus cibarius'), // another month, last year
      f('f3', on(0, now.getMonth()), 'Boletus edulis'), // this month, this year
      f('f4', on(2, now.getMonth()), null), // this month, two years ago, not identified
    ], [], now));
    await page.goto(`${site.url}#/finds`);
    await page.getByLabel('Backup file to restore').setInputFiles(file);
    await expect(page.locator('[data-test=find-row]')).toHaveCount(4);
    const which = page.getByLabel('Which finds to show');
    await which.selectOption('Cantharellus cibarius');
    await expect(page.locator('[data-test=find-row]')).toHaveCount(2);
    await expect(page.locator('[data-test=filter-count]')).toContainText('Showing 2 of 4');
    await expect(page.locator('[data-test=map-pin]')).toHaveCount(2);
    await page.getByLabel(/in past years/).check();
    await expect(page.locator('[data-test=find-row]')).toHaveCount(1); // f1 only
    await which.selectOption('all');
    await expect(page.locator('[data-test=find-row]')).toHaveCount(2); // f1 and f4: not this year's, not another month's
    await expect(page.locator('[data-test=map-pin]')).toHaveCount(2);
    await which.selectOption('Boletus edulis');
    await expect(page.locator('[data-test=filter-empty]')).toContainText('in earlier years for this species');
    await page.getByRole('button', { name: 'Show all' }).click();
    await expect(page.locator('[data-test=find-row]')).toHaveCount(4);
  });

  test('a find can be changed and deleted', async ({ page }) => {
    await page.goto(`${site.url}#/finds/new`);
    await expect(page.locator('[data-test=where]')).toContainText('within 7 m', { timeout: 15000 });
    await page.getByRole('button', { name: 'Save the find' }).click();
    await expect(page.getByRole('heading', { name: 'Not identified yet' })).toBeVisible();
    await page.getByRole('button', { name: 'Change what it is or the notes' }).click();
    await page.getByLabel('What it is').selectOption('Macrolepiota procera');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('heading', { name: 'Parasol', exact: true })).toBeVisible();
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Delete this find' }).click();
    await expect(page.getByRole('heading', { name: 'Finds' })).toBeVisible();
    await expect(page.locator('[data-test=find-row]')).toHaveCount(0);
  });
});

test.describe('Finds without location', () => {
  test.use({ serviceWorkers: 'block', permissions: [] });
  test('with location refused, the pin is placed by hand on the map', async ({ page }) => {
    await page.route('https://tiles.openfreemap.org/**', (r) => (r.request().url().includes('/styles/') ? r.fulfill({ json: PLAIN_MAP }) : r.fulfill({ status: 404 })));
    await page.goto(`${site.url}#/finds/new`);
    await expect(page.locator('[data-test=where]')).toContainText(/Location is off|No GPS fix/, { timeout: 35000 });
    await page.locator('[data-test=map] canvas').click({ position: { x: 120, y: 90 } });
    await expect(page.locator('[data-test=where]')).toHaveText('Placed by hand on the map');
    await page.getByRole('button', { name: 'Save the find' }).click();
    await expect(page.getByText('placed by hand')).toBeVisible();
  });
});

test('the scan runs the model on the phone: the Deathcap\'s photo puts the Deathcap on the shortlist under the red banner', async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto(`${site.url}#/scan`);
  await expect(page.getByRole('heading', { name: 'Scan: its test first' })).toBeVisible();
  await expect(page.getByText(/Tested on [\d,]+ UK finds it had never seen/)).toBeVisible();
  await page.getByRole('button', { name: /switch the scan on/ }).click();
  await page.getByLabel('Top of the cap photo').setInputFiles(fileURLToPath(new URL('../public/photos/deathcap/1.webp', import.meta.url)));
  await page.getByRole('button', { name: 'Scan', exact: true }).click();
  const result = page.locator('[data-test=scan-result]');
  await expect(result).toBeVisible({ timeout: 120_000 });
  await expect(result.locator('[data-test=scan-row]').filter({ hasText: 'Deathcap' })).toHaveCount(1);
  await expect(result.getByText('A dangerous species is on this list')).toBeVisible();
  await expect(result.locator('[data-test=scan-group]')).toContainText('Most likely an Amanita');
  expect(await page.locator('main').innerText()).not.toMatch(/Edible, cooked|Edible, but some people react|Not edible|\bsafe\b/i);
  await page.reload(); // the record page is shown once
  await expect(page.getByRole('heading', { name: 'Scan', exact: true })).toBeVisible();
});

test('the scan names the group, and gives English names to species the guide does not cover', async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto(`${site.url}#/scan`);
  await page.getByRole('button', { name: /switch the scan on/ }).click();
  await page.getByLabel('Top of the cap photo').setInputFiles(fileURLToPath(new URL('../public/photos/sickener/1.webp', import.meta.url)));
  await page.getByRole('button', { name: 'Scan', exact: true }).click();
  const result = page.locator('[data-test=scan-result]');
  await expect(result).toBeVisible({ timeout: 120_000 });
  const group = result.locator('[data-test=scan-group]');
  await expect(group).toContainText('Most likely one of the brittlegills (Russula)');
  await expect(group.getByRole('link', { name: 'Sickener' })).toBeVisible(); // the guide's brittlegills, linked
  await expect(result.locator('[data-test=scan-row]').filter({ hasText: 'Crab Brittlegill' })).toContainText('Not in the guide');
  expect(await page.locator('main').innerText()).not.toMatch(/Edible, cooked|Edible, but some people react|Not edible|\bsafe\b/i);
});

test('when the scan is not certain it says how often the right species is still on the list', async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto(`${site.url}#/scan`);
  await page.getByRole('button', { name: /switch the scan on/ }).click();
  await page.getByLabel('Top of the cap photo').setInputFiles(fileURLToPath(new URL('../public/photos/charcoal-burner/1.webp', import.meta.url)));
  await page.getByRole('button', { name: 'Scan', exact: true }).click();
  const notSure = page.locator('[data-test=not-sure]');
  await expect(notSure).toBeVisible({ timeout: 120_000 });
  await expect(notSure).toContainText(/still on this list \d+(\.\d)?% of the time/);
  await expect(page.getByText('the scan can\'t tell from these photos')).toHaveCount(0); // the old wording, read as "no result"
});

test('search finds a species by another name, even misspelt, and its page lists the other names', async ({ page }) => {
  await page.goto(`${site.url}#/guide?q=porchini`);
  const rows = page.locator('[data-test=species-row]');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('Penny Bun');
  await rows.first().click();
  await expect(page.locator('[data-test=other-names]')).toContainText('Porcini');
});
