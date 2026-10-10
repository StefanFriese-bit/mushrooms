import { expect, test, type Page } from '@playwright/test';
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

/** A scan photo: chosen for a slot, then "Use this" on the crop screen (its starting view is the centre square, which
 * is what the scan looked at before cropping existed). */
async function addScanPhoto(page: Page, slot: string, photo: string) {
  await page.getByLabel(`${slot} photo`, { exact: true }).setInputFiles(fileURLToPath(new URL(`../public/photos/${photo}`, import.meta.url)));
  const crop = page.locator('[data-test=cropper]');
  await expect(crop).toBeVisible();
  await crop.getByRole('button', { name: 'Use this' }).click();
  await expect(crop).toHaveCount(0);
}

test.beforeEach(async () => { site = await startServer(DIST); });
test.afterEach(async () => { await site.stop(); });

test('every species is in the guide, and no screen calls the app a test version', async ({ page }) => {
  await page.goto(`${site.url}#/guide`);
  await expect(page.locator('[data-test=species-row]')).toHaveCount(ALL.length);
  expect(await page.title()).not.toMatch(TEST_WORDS);
  for (const route of ['#/guide', '#/identify', '#/scan', '#/map', '#/finds', '#/learn', '#/about', '#/species/deathcap']) {
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

test('a species\' poisonous lookalikes, one at a time: the two side by side, then the points that tell them apart', async ({ page }) => {
  await page.goto(`${site.url}#/species/velvet-shank`);
  // The button counts only what its name says: two poisonous lookalikes, and Sheathed Woodtuft, which is edible.
  await expect(page.locator('[data-test=lookalikes-button]')).toHaveText('Poisonous lookalikes (2) and 1 other');
  await page.locator('[data-test=lookalikes-button]').click();
  await expect(page.getByRole('heading', { name: 'Poisonous lookalikes' })).toBeVisible();
  await expect(page.locator('[data-test=lookalike-count]')).toHaveText('Velvet Shank · 1 of 3');
  const pair = page.locator('[data-test=pair]');
  await expect(pair).toContainText('Funeral Bell'); // the deadly one first
  await expect(pair).toContainText('Deadly');
  const rows = page.locator('[data-test=apart-row]');
  await expect(rows.first()).toContainText('Ring'); // a ring settles it fastest, so it comes first
  await expect(rows.first().locator('.apart-line.danger')).toContainText('A small, fragile ring');
  await page.locator('[data-test=next-lookalike]').click();
  await expect(page.locator('[data-test=lookalike-count]')).toHaveText('Velvet Shank · 2 of 3');
  await expect(pair).toContainText('Common Rustgill');
  await expect(page.getByRole('heading', { name: 'Poisonous lookalikes' })).toBeVisible();
  await page.locator('[data-test=next-lookalike]').click();
  await expect(page.locator('[data-test=lookalike-count]')).toHaveText('Velvet Shank · 3 of 3');
  await expect(pair).toContainText('Sheathed Woodtuft');
  await expect(page.getByRole('heading', { name: 'Other lookalikes' })).toBeVisible(); // a harmless one is never called poisonous
  await expect(page.getByRole('heading', { name: 'Poisonous lookalikes' })).toHaveCount(0);
  await expect(page.locator('[data-test=next-lookalike]')).toHaveCount(0);
  await page.getByRole('link', { name: 'Previous' }).click();
  await expect(pair).toContainText('Common Rustgill');
  await page.getByRole('link', { name: 'Previous' }).click();
  await expect(pair).toContainText('Funeral Bell');
  await pair.getByRole('link', { name: /Funeral Bell/ }).click(); // the lookalike's own page
  await expect(page.getByRole('heading', { name: 'Funeral Bell', exact: true })).toBeVisible();
  await page.locator('[data-test=lookalikes-button]').click(); // a deadly species: what it is mistaken for
  await expect(page.getByRole('heading', { name: 'Mistaken for' })).toBeVisible();
  await page.locator('[data-test=back-link]').click();
  await expect(page.getByRole('heading', { name: 'Funeral Bell', exact: true })).toBeVisible();
});

test('a species page puts its lookalikes under the right heading, and says which sites name no dangerous one', async ({ page }) => {
  // An edible species: "Dangerous lookalikes" holds only dangerous ones (or which sites name none); the harmless ones it
  // is mixed up with stand apart, under "Other lookalikes" (10/10/2026: the lookalike audit added them).
  await page.goto(`${site.url}#/species/penny-bun-cep`);
  await expect(page.locator('[data-test=lookalikes-first]')).toHaveText('Dangerous lookalikes');
  await expect(page.locator('[data-test=no-dangerous]')).toContainText('First Nature and Wild Food UK name no dangerous lookalike');
  await expect(page.locator('[data-test=lookalikes-rest]')).toHaveText('Other lookalikes');
  /** The lookalike cards between a heading and the next one. */
  const cardsUnder = (test: string) => page.evaluate((t) => {
    const out: string[] = [];
    let el = document.querySelector(`[data-test=${t}]`)?.nextElementSibling;
    while (el && el.tagName !== 'H2') { if (el.matches('.card')) out.push(el.querySelector('h3')?.textContent ?? ''); el = el.nextElementSibling; }
    return out;
  }, test);
  expect(await cardsUnder('lookalikes-first')).toEqual([]); // none dangerous: no card under "Dangerous lookalikes"
  const others = await cardsUnder('lookalikes-rest');
  expect(others.some((t) => t.includes('Bitter Bolete'))).toBe(true);
  expect(others.some((t) => t.includes('Bay Bolete'))).toBe(true);
  // A dangerous species: the edible species it is mistaken for first; a poisonous lookalike of it is not called edible.
  await page.goto(`${site.url}#/species/deathcap`);
  await expect(page.locator('[data-test=lookalikes-first]')).toHaveText('Edible species it is mistaken for');
  const firstCards = await cardsUnder('lookalikes-first');
  expect(firstCards.length).toBeGreaterThan(0);
  expect(firstCards.every((t) => /Edible/.test(t))).toBe(true);
  expect(firstCards.some((t) => /False Death-cap/.test(t))).toBe(false);
  await expect(page.locator('[data-test=lookalikes-rest]')).toHaveText('Other lookalikes');
  expect((await cardsUnder('lookalikes-rest')).some((t) => /False Death-cap/.test(t))).toBe(true);
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
  await expect(page.locator('[data-test=home] a')).toHaveCount(4);
  await page.locator('[data-test=home-guide]').click();
  await expect(page.locator('[data-test=species-row]')).toHaveCount(ALL.length);
  await page.goto(`${site.url}#/species/deathcap`);
  await expect(page.getByRole('heading', { name: 'Deathcap' })).toBeVisible();
});

test('About says whether the phone keeps the data (the app asks at start)', async ({ page }) => {
  await page.goto(`${site.url}#/about`);
  await expect(page.getByText(/Storage kept by the phone: (yes|not yet|not supported in this browser)$/)).toBeVisible();
});

test('the home page: the four sections in Stefan\'s order, the Map first, and no bar at the foot', async ({ page }) => {
  await page.goto(site.url);
  const buttons = page.locator('[data-test=home] a');
  await expect(buttons).toHaveText(['Map', 'Scan', 'Guide', 'Identify']); // Learn taken off 10/10/2026: "not useful for me"
  await expect(page.locator('nav.tabs')).toHaveCount(0);
  await expect(page.locator('[data-test=home-button]')).toHaveCount(0); // already home
  expect(await page.title()).toBe(brand.name);
  // The Map offers two things: save where he stands, or see the map.
  await page.locator('[data-test=home-map]').click();
  await expect(page.getByRole('heading', { name: 'Map', exact: true })).toBeVisible();
  await expect(page.locator('[data-test=save-location]')).toContainText('Save a location');
  await expect(page.locator('[data-test=view-map]')).toContainText('View map');
  await expect(page.locator('[data-test=saved-count]')).toHaveText('No saved locations yet');
  // Every other page has the four sections at its foot, its own lit, in the same order.
  const bar = page.locator('nav.tabs a');
  await expect(bar).toHaveText(['Map', 'Scan', 'Guide', 'Identify']);
  await expect(page.locator('nav.tabs a[aria-current=page]')).toHaveText('Map');
  await bar.filter({ hasText: 'Identify' }).click();
  await expect(page.locator('nav.tabs a[aria-current=page]')).toHaveText('Identify');
  // The four share the foot's width evenly.
  const widths = await bar.evaluateAll((as) => as.map((a) => Math.round(a.getBoundingClientRect().width)));
  expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(1);
  expect(widths.reduce((a, b) => a + b, 0)).toBeGreaterThan((page.viewportSize()!.width > 760 ? 720 : page.viewportSize()!.width) * 0.8);
});

test('the header shows the name and tagline from src/brand.json; Home goes home, the i opens About', async ({ page }) => {
  await page.goto(`${site.url}#/identify`);
  const header = page.locator('header.app-header');
  await expect(header).toContainText(brand.name);
  await expect(header).toContainText(brand.tagline);
  await header.locator('[data-test=about-button]').click();
  await expect(page.getByRole('heading', { name: 'About' })).toBeVisible();
  await header.locator('[data-test=home-button]').click();
  await expect(page.locator('[data-test=home] a')).toHaveCount(4);
  await page.goto(`${site.url}#/species/deathcap`);
  await header.getByRole('link', { name: `${brand.name}, home` }).click();
  await expect(page.locator('[data-test=home] a')).toHaveCount(4);
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

// No offline download here: its "Saving the guide…" bar appears at the top part-way through and can take a tap meant for
// the page (seen once under a full run's load).
test.describe('the cap ruler', () => {
  test.use({ serviceWorkers: 'block' });
test('How wide is the cap: a centimetre ruler down the right edge; it can be checked against a bank card and keeps the check', async ({ page }, info) => {
  // The questions before it answered "Not sure", as a person could.
  await page.goto(`${site.url}#/identify?underside=unsure&growsOn=unsure&ring=unsure&bag=unsure`);
  await expect(page.getByRole('heading', { name: 'How wide is the cap?' })).toBeVisible();
  const ruler = page.locator('[data-test=screen-ruler]');
  await expect(ruler).toBeVisible();
  const note = page.locator('[data-test=ruler-note]');
  // The iPhone engine runs as an iPhone 15 (3 pixels a point): Apple's 460 ppi. The desktop browser is no iPhone.
  const iPhone = info.project.name === 'iphone-safari-engine';
  await expect(note).toContainText(iPhone ? 'Set for this iPhone’s screen.' : 'Not checked on this phone yet');
  const px = Number(await ruler.getAttribute('data-px-per-cm'));
  if (iPhone) expect(px).toBeCloseTo(460 / 2.54 / 3, 2);
  // The 5 and 10 cm marks — where the answers change — sit 5 and 10 cm from the top of the ruler.
  const top = (await ruler.boundingBox())!.y;
  const at = async (cm: number) => { const b = (await ruler.locator(`[data-cm="${cm}"]`).boundingBox())!; return b.y + b.height / 2 - top; };
  expect(await at(5)).toBeCloseTo(5 * px, 0);
  if ((await ruler.boundingBox())!.height > 10 * px) expect(await at(10)).toBeCloseTo(10 * px, 0);
  // Nothing on the page hides under it.
  const rulerLeft = (await ruler.boundingBox())!.x;
  for (const el of await page.locator('a.choice').all()) { const b = (await el.boundingBox())!; expect(b.x + b.width).toBeLessThanOrEqual(rulerLeft + 0.5); }
  // He lays a card on the outline and makes it 1 px a centimetre larger; the ruler follows and keeps it.
  await page.locator('[data-test=ruler-check-open]').click();
  const sheet = page.locator('[data-test=ruler-check]');
  const outline = sheet.locator('[data-test=card-outline]');
  expect((await outline.boundingBox())!.height).toBeCloseTo(8.56 * px, 0);
  for (let i = 0; i < 10; i++) await sheet.getByRole('button', { name: 'Larger' }).click();
  expect((await outline.boundingBox())!.height).toBeCloseTo(8.56 * (px + 1), 0);
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(note).toContainText('Checked against a bank card.');
  await expect(ruler).toHaveAttribute('data-px-per-cm', (px + 1).toFixed(2));
  await page.reload();
  await expect(ruler).toHaveAttribute('data-px-per-cm', (px + 1).toFixed(2));
  // Only on this question: answering it takes the ruler away, and the page uses the whole width again.
  await page.getByRole('link', { name: /Under 5 cm/ }).click();
  await expect(page.getByRole('heading', { name: 'What colour is its spore print?' })).toBeVisible();
  await expect(ruler).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.classList.contains('ruler-on'))).toBe(false);
  // The check can be forgotten.
  await page.goBack();
  await page.locator('[data-test=ruler-check-open]').click();
  await sheet.getByRole('button', { name: 'Forget the check' }).click();
  await expect(note).not.toContainText('Checked against a bank card.');
  await expect(ruler).toHaveAttribute('data-px-per-cm', px.toFixed(2));
});
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

// The Map: no real map service in tests — the map style is a plain background, so only the app's own code is tested.
const PLAIN_MAP = { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#e8efe0' } }] };
const PHOTO = fileURLToPath(new URL('../public/photos/chanterelle/1.webp', import.meta.url));
test.describe('Map', () => {
  test.use({ serviceWorkers: 'block', geolocation: { latitude: 51.6588, longitude: 0.0466, accuracy: 7 }, permissions: ['geolocation'] });
  test.beforeEach(async ({ page }) => {
    await page.route('https://tiles.openfreemap.org/**', (r) => (r.request().url().includes('/styles/') ? r.fulfill({ json: PLAIN_MAP }) : r.fulfill({ status: 404 })));
  });

  test('Save a location keeps the exact spot, a description and a photo on the phone; its pin offers Take me there', async ({ page }) => {
    const hosts = new Set<string>();
    page.on('request', (r) => { const u = new URL(r.url()); if (/^https?:$/.test(u.protocol)) hosts.add(u.host); }); // blob: = in the phone's memory
    await page.goto(site.url);
    await page.locator('[data-test=home-map]').click();
    await page.locator('[data-test=save-location]').click();
    await expect(page.getByRole('heading', { name: 'Save a location' })).toBeVisible();
    await expect(page.locator('[data-test=where]')).toContainText('Your position, within 7 m', { timeout: 15000 });
    await page.getByLabel('Description').fill('Chanterelles, a dozen\nunder the big beech by the stream');
    await page.getByLabel('Photo').setInputFiles(PHOTO);
    await expect(page.locator('.thumbs img')).toHaveCount(1);
    const savedFrom = new Date(); // the saved time is a minute between this and the check below
    await page.getByRole('button', { name: 'Save location' }).click();
    await expect(page.locator('[data-test=saved-note]')).toHaveText('Location saved on this phone.');
    await expect(page.getByRole('heading', { name: 'Chanterelles, a dozen', exact: true })).toBeVisible();
    // The date and time are saved by themselves (Stefan 10/10/2026), shown in the phone's own time.
    const today = new Date().toLocaleDateString('en-GB', { dateStyle: 'medium' });
    await expect(page.getByText(new RegExp(`^Saved ${today}(,| at) \\d{2}:\\d{2} · within 7 m$`))).toBeVisible();
    await expect(page.getByText('under the big beech by the stream')).toBeVisible();
    await expect(page.locator('[data-test=take-me-there]')).toHaveAttribute('href', 'https://maps.apple.com/?daddr=51.65880,0.04660&dirflg=w');
    await expect(page.locator('.photos img')).toHaveCount(1);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Chanterelles, a dozen', exact: true })).toBeVisible();
    await expect(page.locator('[data-test=saved-note]')).toHaveCount(0); // said once, straight after saving
    await page.goto(`${site.url}#/map`);
    await expect(page.locator('[data-test=saved-count]')).toHaveText('1 saved location, and the way back to each');
    await page.locator('[data-test=view-map]').click();
    await expect(page.locator('[data-test=find-row]')).toHaveCount(1);
    await expect(page.locator('[data-test=find-row] .loc-desc')).toHaveText('Chanterelles, a dozen · under the big beech by the stream');
    // Every minute from just before Save to now: a save at 09:40:59 is listed 09:40 though the check runs at 09:41.
    const listed = (d: Date) => `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
    const minutes = new Set<string>();
    for (let t = savedFrom.getTime() - (savedFrom.getTime() % 60000); t <= Date.now(); t += 60000) minutes.add(listed(new Date(t)));
    expect([...minutes]).toContain(await page.locator('[data-test=find-row] .loc-date').innerText());
    await page.locator('[data-test=map-pin]').click();
    const go = page.locator('.pin-pop-go');
    await expect(go).toHaveText('Take me there');
    await go.click();
    await expect(page.getByRole('heading', { name: 'Back to: Chanterelles, a dozen' })).toBeVisible();
    await expect(page.locator('[data-test=go-distance]')).toHaveText('You are there', { timeout: 15000 });
    // One tap back to the map (Stefan 10/10/2026: "how do I go back to just the map"): from the walk back, from the
    // location's own page, and from the map up to the Map's two choices.
    await page.locator('[data-test=back-link]').click();
    await expect(page.getByRole('heading', { name: 'View map' })).toBeVisible();
    await expect(page.locator('[data-test=find-row]')).toHaveCount(1);
    await page.locator('[data-test=find-row] .loc-main').click();
    await expect(page.getByRole('heading', { name: 'Chanterelles, a dozen', exact: true })).toBeVisible();
    await page.locator('[data-test=back-link]').click();
    await expect(page.getByRole('heading', { name: 'View map' })).toBeVisible();
    await page.locator('[data-test=back-link]').click();
    await expect(page.locator('[data-test=save-location]')).toBeVisible();
    // Spec 9: his locations go nowhere — the only addresses are the app's own and the map's.
    expect([...hosts].filter((h) => h !== new URL(site.url).host && h !== 'tiles.openfreemap.org')).toEqual([]);
  });

  test('Take me there: how far and which way, then "you are there" with its photos; its grid reference and Plus Code', async ({ page, context }) => {
    const spot = { lat: 51.6588, lon: 0.0466 };
    await page.goto(`${site.url}#/finds/new`);
    await expect(page.locator('[data-test=where]')).toContainText('within 7 m', { timeout: 15000 });
    await page.getByLabel('Photo').setInputFiles(PHOTO);
    await expect(page.locator('.thumbs img')).toHaveCount(1);
    await page.getByRole('button', { name: 'Save location' }).click();
    await expect(page.getByRole('heading', { name: 'Saved location', exact: true })).toBeVisible();
    await expect(page.locator('[data-test=os-grid]')).toHaveText(osGridRef(spot)!);
    await expect(page.locator('[data-test=plus-code]')).toHaveText(plusCode(spot));
    // The way back comes first (Stefan 10/10/2026): Take me there sits above the photos, on the first screen.
    await expect(page.locator('.photos img')).toHaveCount(1);
    const goButton = (await page.locator('[data-test=find-again]').boundingBox())!;
    expect(goButton.y).toBeLessThan((await page.locator('.photos img').boundingBox())!.y);
    expect(goButton.y + goButton.height).toBeLessThanOrEqual((await page.locator('nav.tabs').boundingBox())!.y);
    // He walks away: 40 m south of it.
    const away = { lat: spot.lat - 0.00036, lon: spot.lon };
    await context.setGeolocation({ latitude: away.lat, longitude: away.lon, accuracy: 5 });
    await page.locator('[data-test=find-again]').click();
    await expect(page.locator('[data-test=go-distance]')).toHaveText(sayDistance(distanceM(away, spot)), { timeout: 15000 });
    await expect(page.getByText(/^Head north/)).toBeVisible();
    await expect(page.locator('[data-test=go-arrow]')).toHaveCount(1);
    await expect(page.locator('[data-test=here-dot]')).toHaveCount(1);
    // The arrow, the distance and the map on one screen (at least 150 points of map above the bar at the foot), and
    // walking directions one tap away.
    const foot = (await page.locator('nav.tabs').boundingBox())!.y;
    expect((await page.locator('[data-test=go-distance]').boundingBox())!.y).toBeLessThan(foot);
    expect((await page.locator('.map-wrap.short [data-test=map]').boundingBox())!.y + 150).toBeLessThanOrEqual(foot);
    await expect(page.locator('[data-test=go-directions]')).toHaveAttribute('href', 'https://maps.apple.com/?daddr=51.65880,0.04660&dirflg=w');
    // Back at the spot: as close as GPS can tell, and his own photos to recognise it by.
    await context.setGeolocation({ latitude: spot.lat, longitude: spot.lon, accuracy: 5 });
    await page.reload();
    await expect(page.locator('[data-test=go-distance]')).toHaveText('You are there', { timeout: 15000 });
    await expect(page.locator('[data-test=go-there] img')).toHaveCount(1);
  });

  test('Take me there asks for the compass in the same tap, and the arrow follows it', async ({ page, context }) => {
    // An iPhone: the compass has to be asked for, and only a tap may ask.
    await page.addInitScript(() => {
      const w = window as unknown as Record<string, any>;
      const DOE = w.DeviceOrientationEvent ?? function DeviceOrientationEvent() {};
      w.__asked = [];
      DOE.requestPermission = function (this: unknown) {
        const ua = (navigator as unknown as { userActivation?: { isActive: boolean } }).userActivation;
        w.__asked.push({ tap: ua ? ua.isActive : null, self: this === DOE });
        return new Promise((done) => { w.__allow = () => done('granted'); });
      };
      w.DeviceOrientationEvent = DOE;
    });
    const spot = { lat: 51.6588, lon: 0.0466 };
    await page.goto(`${site.url}#/finds/new`);
    await expect(page.locator('[data-test=where]')).toContainText('within 7 m', { timeout: 15000 });
    await page.getByRole('button', { name: 'Save location' }).click();
    await expect(page.getByRole('heading', { name: 'Saved location', exact: true })).toBeVisible();
    await context.setGeolocation({ latitude: spot.lat - 0.00036, longitude: spot.lon, accuracy: 5 }); // 40 m south of it
    expect(await page.evaluate(() => (window as unknown as { __asked: unknown[] }).__asked)).toHaveLength(0); // not before the tap
    await page.locator('[data-test=find-again]').click();
    // The screen opens at once, with the phone's own question on top of it.
    await expect(page.locator('[data-test=find-go]')).toBeVisible();
    await expect(page.getByText('Asking for the compass…')).toBeVisible();
    const asked = await page.evaluate(() => (window as unknown as { __asked: Array<{ tap: boolean | null; self: boolean }> }).__asked);
    expect(asked).toHaveLength(1);
    expect(asked[0].self).toBe(true); // asked of the phone's own object
    expect(asked[0].tap).not.toBe(false); // inside his tap (null: this browser cannot tell)
    await page.evaluate(() => (window as unknown as { __allow: () => void }).__allow());
    // He allows it. The phone's top points east (90°), the find is due north: the arrow turns to his left (270°).
    await expect(async () => {
      await page.evaluate(() => {
        for (const type of ['deviceorientation', 'deviceorientationabsolute']) {
          const e = new Event(type);
          Object.assign(e, { alpha: 270, webkitCompassHeading: 90, webkitCompassAccuracy: 10 });
          window.dispatchEvent(e);
        }
      });
      await expect(page.getByText('Head north: follow the arrow')).toBeVisible({ timeout: 500 });
    }).toPass({ timeout: 10000 });
    await expect(page.locator('[data-test=go-arrow]')).toHaveAttribute('transform', 'rotate(270)');
    await expect(page.getByText('Asking for the compass…')).toHaveCount(0);
  });

  test('the map zooms in until a few metres fill the screen', async ({ page }) => {
    await page.goto(`${site.url}#/finds/new`);
    await expect(page.locator('[data-test=where]')).toContainText('within 7 m', { timeout: 15000 });
    await page.getByRole('button', { name: 'Save location' }).click();
    await expect(page.getByRole('heading', { name: 'Saved location', exact: true })).toBeVisible();
    const zoomIn = page.locator('.maplibregl-ctrl-zoom-in');
    await expect(zoomIn).toBeVisible();
    // From 18, one step per press (each press animates: the next waits for it), until the closest zoom stops the button.
    // A press can find the button already off: the last animation reached the closest zoom between the look and the press.
    for (let i = 0; i < 10 && !(await zoomIn.isDisabled()); i++) {
      await zoomIn.click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(450);
    }
    await expect(zoomIn).toBeDisabled();
    await expect(page.locator('.maplibregl-ctrl-scale')).toHaveText(/^\d+\s(cm|m)$/); // MapLibre writes a no-break space
    const metres = await page.locator('.maplibregl-ctrl-scale').evaluate((el) => {
      const t = el.textContent ?? ''; const n = parseFloat(t); return t.endsWith('cm') ? n / 100 : n;
    });
    expect(metres).toBeLessThanOrEqual(1); // the scale bar (at most 100 points wide) stands for a metre or less
  });

  test('backup and restore: one file brings a deleted location back with its photo; a damaged file changes nothing', async ({ page }, info) => {
    await page.addInitScript(() => { Object.defineProperty(navigator, 'canShare', { value: undefined }); }); // the download route
    await page.goto(`${site.url}#/finds/new`);
    await expect(page.locator('[data-test=where]')).toContainText('within 7 m', { timeout: 15000 });
    await page.getByLabel('Photo').setInputFiles(PHOTO);
    await expect(page.locator('.thumbs img')).toHaveCount(1);
    await page.getByLabel('Description').fill('Chanterelles by the stream');
    await page.getByRole('button', { name: 'Save location' }).click();
    await expect(page.getByRole('heading', { name: 'Chanterelles by the stream', exact: true })).toBeVisible();
    await page.goto(`${site.url}#/map`);
    await expect(page.locator('[data-test=backup-reminder]')).toContainText('1 location is not in a backup yet');
    await page.goto(`${site.url}#/finds`);
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Back up 1 location' }).click()]);
    expect(download.suggestedFilename()).toMatch(/^mycelium-backup-\d{4}-\d{2}-\d{2}\.zip$/);
    const file = info.outputPath('backup.zip');
    await download.saveAs(file);
    await expect(page.locator('[data-test=backup]')).toContainText('Last backup:');
    await page.goto(`${site.url}#/map`);
    await expect(page.locator('[data-test=backup-reminder]')).toHaveCount(0);
    // The location is deleted …
    await page.goto(`${site.url}#/finds`);
    await page.locator('[data-test=find-row] .loc-main').first().click();
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Delete this location' }).click();
    await expect(page.getByRole('heading', { name: 'View map' })).toBeVisible();
    await expect(page.locator('[data-test=find-row]')).toHaveCount(0);
    // … and the file brings it back, photo and all.
    await page.getByLabel('Backup file to restore').setInputFiles(file);
    await expect(page.locator('[data-test=backup-said]')).toHaveText('Restored 1 location.');
    await expect(page.locator('[data-test=find-row]')).toHaveCount(1);
    await page.locator('[data-test=find-row] .loc-main').first().click();
    await expect(page.getByRole('heading', { name: 'Chanterelles by the stream', exact: true })).toBeVisible();
    await expect(page.locator('.photos img')).toHaveCount(1);
    // Restoring again adds nothing twice; a damaged file changes nothing.
    await page.goto(`${site.url}#/finds`);
    await page.getByLabel('Backup file to restore').setInputFiles(file);
    await expect(page.locator('[data-test=backup-said]')).toHaveText('Restored 0 locations; 1 location was already on this phone and left as it was.');
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
    const which = page.getByLabel('Which locations to show');
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

  test('growth: a location saved at G1 shows "G1 · 3 days" three days later, and a revisit logs G2', async ({ page }) => {
    // Stefan 10/10/2026: mark one just coming up, see the stage and how many days have passed, go back when it is time.
    await page.goto(`${site.url}#/finds/new`);
    await expect(page.locator('[data-test=where]')).toContainText('within 7 m', { timeout: 15000 });
    await page.getByLabel('Description').fill('Looks like porcini');
    const pick = page.locator('[data-test=growth-pick]');
    await expect(pick.getByRole('button')).toHaveCount(5);
    await pick.getByRole('button', { name: /G1\s*Button/ }).click();
    await expect(pick.getByRole('button', { name: /G1\s*Button/ })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Save location' }).click();
    await expect(page.locator('[data-test=growth-now]')).toContainText('G1 Button · today');
    // The list shows it on the location's own line; the pin says it too.
    await page.goto(`${site.url}#/finds`);
    await expect(page.locator('[data-test=find-row] [data-test=growth-chip]')).toHaveText('G1 · today');
    await page.locator('[data-test=map-pin]').click();
    await expect(page.locator('.pin-pop-growth')).toHaveText('G1 Button · today');
    // Three days later.
    await page.clock.setSystemTime(new Date(Date.now() + 3 * 86_400_000 + 60_000));
    await page.reload();
    await expect(page.locator('[data-test=find-row] [data-test=growth-chip]')).toHaveText('G1 · 3 days');
    await page.locator('[data-test=find-row] .loc-main').click();
    await expect(page.locator('[data-test=growth-now]')).toContainText('G1 Button · 3 days ago');
    // He goes back: it has grown.
    await page.locator('[data-test=log-growth]').click();
    await page.locator('[data-test=growth-pick]').getByRole('button', { name: /G2\s*Young/ }).click();
    await expect(page.locator('[data-test=growth-now]')).toContainText('G2 Young · today');
    await expect(page.locator('[data-test=growth-history] li')).toHaveCount(2);
    await page.goto(`${site.url}#/finds`);
    await expect(page.locator('[data-test=find-row] [data-test=growth-chip]')).toHaveText('G2 · today');
  });

  test('a saved location can be described and identified afterwards, and deleted', async ({ page }) => {
    await page.goto(`${site.url}#/finds/new`);
    await expect(page.locator('[data-test=where]')).toContainText('within 7 m', { timeout: 15000 });
    await page.getByRole('button', { name: 'Save location' }).click();
    await expect(page.getByRole('heading', { name: 'Saved location', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Edit the description or what it is' }).click();
    await page.getByLabel('What it is').selectOption('Macrolepiota procera');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('heading', { name: 'Parasol', exact: true })).toBeVisible(); // no description: the species
    await page.getByRole('button', { name: 'Edit the description or what it is' }).click();
    await page.getByLabel('Description').fill('Three parasols by the gate');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('heading', { name: 'Three parasols by the gate', exact: true })).toBeVisible();
    await expect(page.getByText('What it is: Parasol')).toBeVisible();
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Delete this location' }).click();
    await expect(page.getByRole('heading', { name: 'View map' })).toBeVisible();
    await expect(page.locator('[data-test=find-row]')).toHaveCount(0);
  });
});

test.describe('Map with no map service', () => {
  test.use({ serviceWorkers: 'block', geolocation: { latitude: 51.6588, longitude: 0.0466, accuracy: 7 }, permissions: ['geolocation'] });
  test('with no stored map and no signal, the locations and the position still show on a plain grid, with a scale', async ({ page }) => {
    await page.route('https://tiles.openfreemap.org/**', (r) => r.abort());
    await page.route('https://tile.openstreetmap.org/**', (r) => r.abort());
    await page.goto(`${site.url}#/finds/new`);
    await expect(page.locator('[data-test=where]')).toContainText('within 7 m', { timeout: 15000 });
    await page.getByRole('button', { name: 'Save location' }).click();
    await expect(page.getByRole('heading', { name: 'Saved location', exact: true })).toBeVisible();
    await page.goto(`${site.url}#/finds`);
    const wrap = page.locator('.map-wrap');
    await expect(wrap).toHaveAttribute('data-map-mode', 'fallback', { timeout: 15000 });
    await expect(wrap).toHaveAttribute('data-grid', 'on');
    await expect(page.locator('[data-test=map-pin]')).toHaveCount(1);
    await expect(page.locator('.map-problem')).toContainText('plain grid');
    await expect(page.locator('.maplibregl-ctrl-scale')).toBeVisible();
  });
});

test.describe('Map without location', () => {
  test.use({ serviceWorkers: 'block', permissions: [] });
  test('with location refused, the pin is placed by hand on the map', async ({ page }) => {
    await page.route('https://tiles.openfreemap.org/**', (r) => (r.request().url().includes('/styles/') ? r.fulfill({ json: PLAIN_MAP }) : r.fulfill({ status: 404 })));
    await page.goto(`${site.url}#/finds/new`);
    await expect(page.locator('[data-test=where]')).toContainText(/Location is off|No GPS fix/, { timeout: 35000 });
    await page.locator('[data-test=map] canvas').click({ position: { x: 120, y: 90 } });
    await expect(page.locator('[data-test=where]')).toHaveText('Placed by hand on the map');
    await page.getByRole('button', { name: 'Save location' }).click();
    await expect(page.getByText('placed by hand')).toBeVisible();
  });
});

test('the scan runs the model on the phone: the Deathcap\'s photo puts the Deathcap on the shortlist under the red banner', async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto(`${site.url}#/scan`);
  await expect(page.getByRole('heading', { name: 'Scan: its test first' })).toBeVisible();
  await expect(page.getByText(/Tested on [\d,]+ UK finds it had never seen/)).toBeVisible();
  await page.getByRole('button', { name: /switch the scan on/ }).click();
  await addScanPhoto(page, 'Top of the cap', 'deathcap/1.webp');
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

test('Identify, then photos: his answers\' species in the order the photos put them; a dangerous species is never hidden', async ({ page }) => {
  test.setTimeout(150_000);
  const results = (q: string) => page.goto(`${site.url}#/identify?${q}&cap=unsure&spore=unsure`);
  // Until the scan has been switched on (after reading its test), the step says where to do that.
  await results('underside=gills&growsOn=ground&ring=yes&bag=yes');
  const step = page.locator('[data-test=identify-photos]');
  await expect(step.locator('[data-test=scan-off]')).toBeVisible();
  await step.getByRole('link', { name: 'open Scan' }).click();
  await page.getByRole('button', { name: /switch the scan on/ }).click();
  // A Deathcap with a ring and a bag, on the ground: the Deathcap's own photo puts it first.
  await results('underside=gills&growsOn=ground&ring=yes&bag=yes');
  await addScanPhoto(page, 'Top of the cap', 'deathcap/1.webp');
  await step.getByRole('button', { name: 'Narrow it down' }).click();
  const ranked = step.locator('[data-test=photo-ranked]');
  await expect(ranked).toBeVisible({ timeout: 120_000 });
  await expect(ranked.getByText('A dangerous species is on this list')).toBeVisible();
  await expect(ranked.locator('[data-test=photo-top-title]')).toHaveText('Most like your photos');
  await expect(ranked.locator('[data-test=identify-row]').first()).toContainText('Deathcap');
  await expect(ranked.locator('[data-test=photo-dangerous]')).toContainText('False Death-cap'); // a lookalike, in sight
  expect(await page.locator('main').innerText()).not.toMatch(EDIBILITY_WORDS);
  // He changes an answer (pores): the same photos re-order the new list at once, and the Deathcap the photo could be is
  // shown although the answer rules it out.
  await results('underside=pores&growsOn=ground&ring=unsure&bag=unsure');
  await expect(ranked.locator('[data-test=photo-warnings]')).toContainText('Deathcap');
  await expect(ranked.locator('[data-test=photo-top-title]')).toContainText('do not point clearly');
  await expect(ranked.locator('[data-test=identify-row]').filter({ hasText: 'Deathcap' })).toHaveCount(0);
  // A species the scan cannot recognise is listed apart, never ranked low.
  await results('underside=gills&growsOn=wood&ring=unsure&bag=unsure');
  await expect(ranked.locator('[data-test=photo-unknown]')).toContainText('Blueleg Brownie');
  await expect(ranked.locator('[data-test=identify-row]').filter({ hasText: 'Blueleg Brownie' })).toHaveCount(0);
});

test('the scan names the group, and gives English names to species the guide does not cover', async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto(`${site.url}#/scan`);
  await page.getByRole('button', { name: /switch the scan on/ }).click();
  await addScanPhoto(page, 'Top of the cap', 'sickener/1.webp');
  await page.getByRole('button', { name: 'Scan', exact: true }).click();
  const result = page.locator('[data-test=scan-result]');
  await expect(result).toBeVisible({ timeout: 120_000 });
  const group = result.locator('[data-test=scan-group]');
  await expect(group).toContainText('Most likely one of the brittlegills (Russula)');
  await expect(group.getByRole('link', { name: 'Sickener' })).toBeVisible(); // the guide's brittlegills, linked
  await expect(result.locator('[data-test=scan-row]').filter({ hasText: 'Crab Brittlegill' })).toContainText('Not in the guide');
  expect(await page.locator('main').innerText()).not.toMatch(/Edible, cooked|Edible, but some people react|Not edible|\bsafe\b/i);
});

test('what to check next: the guide\'s brittlegills compared in their own words when no question tells them apart', async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto(`${site.url}#/scan`);
  await page.getByRole('button', { name: /switch the scan on/ }).click();
  await addScanPhoto(page, 'Top of the cap', 'sickener/1.webp');
  await page.getByRole('button', { name: 'Scan', exact: true }).click();
  const card = page.locator('[data-test=next-checks]');
  await expect(card).toBeVisible({ timeout: 120_000 });
  await expect(card).toContainText("the guide's other brittlegills (the group the scan named)");
  await expect(card).toContainText('Not in these checks, as the guide has no page for them: Crab Brittlegill');
  await expect(card.locator('[data-test=still]')).toContainText('Possible: Sickener');
  await expect(card.locator('[data-test=next-check]')).toHaveCount(0);
  await expect(card).toContainText('The questions cannot tell these apart');
  const facts = card.locator('[data-test=next-facts]');
  await expect(facts).toHaveAttribute('open', ''); // three species: open at once
  const grows = facts.locator('[data-test=next-fact]').filter({ hasText: 'Where it grows' });
  for (const name of ['Sickener', 'Charcoal Burner', 'Ochre Brittlegill']) await expect(grows).toContainText(name);
  expect(await page.locator('main').innerText()).not.toMatch(EDIBILITY_WORDS);
});

test('what to check next narrows the list as he answers, and never drops a dangerous species', async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto(`${site.url}#/scan`);
  await page.getByRole('button', { name: /switch the scan on/ }).click();
  await addScanPhoto(page, 'Top of the cap', 'deathcap/1.webp');
  await page.getByRole('button', { name: 'Scan', exact: true }).click();
  const card = page.locator('[data-test=next-checks]');
  await expect(card).toBeVisible({ timeout: 120_000 });
  const checks = card.locator('[data-test=next-check]');
  await expect(checks.first()).toBeVisible();
  // Each answer says which species have it: the bag at the base, Deathcap first among those with one.
  const bag = checks.filter({ hasText: 'Is there a bag at the base of the stem?' });
  await expect(bag.getByRole('button', { name: /^Yes, a bag or cup/ })).toContainText('Deathcap (Deadly)');
  await bag.getByRole('button', { name: /^No bag: I dug out the whole base/ }).click();
  await expect(bag.getByRole('button', { name: /^No bag/ })).toHaveAttribute('aria-pressed', 'true');
  const still = card.locator('[data-test=still]');
  await expect(still.locator('[data-test=still-fit]')).toContainText('Blusher');
  await expect(still.locator('[data-test=still-kept]').filter({ hasText: 'Deathcap' }))
    .toContainText('Kept on the list, though they do not fit what you said about the bag at the base');
  await expect(still.locator('[data-test=ruled-out]')).toContainText('Ruled out by what you said about the bag at the base:');
  await expect(still.locator('[data-test=ruled-out]')).toContainText('Orange Grisette');
  await expect(still.locator('[data-test=ruled-out]')).not.toContainText('Deathcap');
  await expect(still.getByRole('link', { name: 'Check Blusher against its lookalikes' })).toBeVisible();
  // The same answer again takes it back; "Clear my answers" takes them all back.
  await bag.getByRole('button', { name: /^No bag/ }).click();
  await expect(still).toContainText('Possible: Deathcap');
  await checks.filter({ hasText: 'Is there a ring on the stem?' }).getByRole('button', { name: /^No ring/ }).click();
  await bag.getByRole('button', { name: /^No bag/ }).click();
  await expect(still.locator('[data-test=none-fit]')).toContainText('None of the other species here fits your answers');
  await expect(still.locator('[data-test=still-kept]').filter({ hasText: 'Deathcap' })).toContainText('the ring and the bag at the base');
  await still.getByRole('button', { name: 'Clear my answers' }).click();
  await expect(still).toContainText('Possible: Deathcap');
  await expect(card.locator('[data-test=next-facts]')).not.toHaveAttribute('open', ''); // ten species: folded
  expect(await page.locator('main').innerText()).not.toMatch(EDIBILITY_WORDS);
});

test('scan: five photo slots in Stefan\'s order; a chosen photo opens the crop screen, and zooming in crops it', async ({ page }) => {
  await page.goto(`${site.url}#/scan`);
  await page.getByRole('button', { name: /switch the scan on/ }).click();
  await expect(page.locator('[data-test=slot] figcaption')).toHaveText(['Top of the cap', 'Underneath', 'Stem', 'Base of the stem', 'Cross-section']);
  await page.getByLabel('Top of the cap photo').setInputFiles(fileURLToPath(new URL('../public/photos/deathcap/1.webp', import.meta.url)));
  const crop = page.locator('[data-test=cropper]');
  await expect(crop.getByRole('heading', { name: 'Crop: Top of the cap' })).toBeVisible();
  const photo = crop.locator('.crop-frame img');
  await expect(photo).toBeVisible();
  const original = await photo.evaluate((i: HTMLImageElement) => Math.min(i.naturalWidth, i.naturalHeight));
  // Zoom in three times with the slider, then drag the photo: it moves under the square.
  await crop.getByLabel('Zoom').evaluate((el: HTMLInputElement) => { el.value = '3'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  const before = await photo.evaluate((i) => (i as HTMLElement).style.transform);
  const box = (await crop.locator('.crop-frame').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 30, { steps: 5 });
  await page.mouse.up();
  await expect.poll(() => photo.evaluate((i) => (i as HTMLElement).style.transform)).not.toBe(before);
  await crop.getByRole('button', { name: 'Use this' }).click();
  await expect(crop).toHaveCount(0);
  // The slot holds the crop: a square, a third of the photo's shorter side.
  const slotPhoto = page.locator('[data-test=slot] .slot-photo img').first();
  await expect(slotPhoto).toBeVisible();
  const [w, h] = await slotPhoto.evaluate((i: HTMLImageElement) => [i.naturalWidth, i.naturalHeight]);
  expect(w).toBe(h);
  expect(Math.abs(w - Math.max(256, Math.round(original / 3)))).toBeLessThanOrEqual(1);
  // A tap on the photo crops it again, from the whole photo; Cancel keeps the crop.
  await page.getByRole('button', { name: 'Crop the top of the cap photo again' }).click();
  await expect(crop).toBeVisible();
  await expect.poll(() => crop.locator('.crop-frame img').evaluate((i: HTMLImageElement) => Math.min(i.naturalWidth, i.naturalHeight))).toBe(original);
  await crop.getByRole('button', { name: 'Cancel' }).click();
  await expect(crop).toHaveCount(0);
  await expect(slotPhoto).toBeVisible();
});

test('scan: with more than three photos it says so; the shortlist shows each species large, and a tap opens its page', async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto(`${site.url}#/scan`);
  await page.getByRole('button', { name: /switch the scan on/ }).click();
  await addScanPhoto(page, 'Top of the cap', 'deathcap/1.webp');
  await addScanPhoto(page, 'Underneath', 'deathcap/2.webp');
  await addScanPhoto(page, 'Stem', 'deathcap/3.webp');
  await addScanPhoto(page, 'Cross-section', 'deathcap/4.webp');
  await page.getByRole('button', { name: 'Scan', exact: true }).click();
  const result = page.locator('[data-test=scan-result]');
  await expect(result).toBeVisible({ timeout: 120_000 });
  await expect(result.locator('[data-test=many-photos]')).toContainText('Scanned with 4 photos');
  await expect(result.getByText('A dangerous species is on this list')).toBeVisible();
  const deathcap = result.locator('a[data-test=scan-row]').filter({ hasText: 'Deathcap' });
  await expect(deathcap.locator('img.result-photo')).toBeVisible();
  await deathcap.click();
  await expect(page.getByRole('heading', { name: 'Deathcap', exact: true })).toBeVisible();
});

test('when the scan is not certain it says how often the right species is still on the list', async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto(`${site.url}#/scan`);
  await page.getByRole('button', { name: /switch the scan on/ }).click();
  await addScanPhoto(page, 'Top of the cap', 'charcoal-burner/1.webp');
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
