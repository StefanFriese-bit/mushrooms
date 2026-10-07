import { expect, test } from '@playwright/test';
import { mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './server';

// How a new version reaches the phone (src/update.ts, src/sw/sw.ts). The automatic update of 06/10/2026 never finished
// on his iPhone: the worker of that time downloaded a new version and then waited until every window of the app was
// closed — and nothing told it to go on. Here: a first visit fills the phone and says so; a publish downloads in the
// background, waits for his Restart (a reload does NOT switch), is never offered on "Add a find", and Restart switches.
const DIST = fileURLToPath(new URL('../dist', import.meta.url));

/** The next version: the same build with a marked index.html and that file's new revision in the worker's list, the way
 * a publish changes both. Everything else is linked, not copied (the build is 270 MB). */
function nextBuild(): string {
  const dir = mkdtempSync(join(tmpdir(), 'mushrooms-next-'));
  for (const name of readdirSync(DIST)) if (name !== 'index.html' && name !== 'sw.js') symlinkSync(join(DIST, name), join(dir, name));
  const html = readFileSync(join(DIST, 'index.html'), 'utf8');
  writeFileSync(join(dir, 'index.html'), html.replace('<head>', '<head><meta name="build" content="next">'));
  const sw = readFileSync(join(DIST, 'sw.js'), 'utf8');
  const entry = /\{"revision":"([0-9a-f]+)","url":"index\.html"\}/.exec(sw);
  if (!entry) throw new Error('index.html is not in the worker list in the expected form');
  writeFileSync(join(dir, 'sw.js'), sw.replace(entry[0], '{"revision":"0000000000000000000000000000beef","url":"index.html"}'));
  return dir;
}

/** Whether the open page is the next version; false while the page is in the middle of reloading. */
const isNext = (page: import('@playwright/test').Page) =>
  page.evaluate(() => document.querySelector('meta[name=build]')?.getAttribute('content') === 'next').catch(() => false);

test('a first visit fills the phone and says so; a new version waits for Restart, never on "Add a find"', async ({ page }) => {
  test.setTimeout(240_000);
  let root = DIST;
  const next = nextBuild();
  const site = await startServer(() => root);
  try {
    await page.addInitScript(() => {
      const seen: unknown[] = [];
      (window as unknown as { swSeen: unknown[] }).swSeen = seen;
      navigator.serviceWorker?.addEventListener('message', (e) => seen.push(e.data));
    });
    await page.goto(`${site.url}#/guide`);
    const bar = page.locator('[data-test=update-bar]');
    await expect(bar).toContainText('Saved on this phone', { timeout: 180_000 });
    // The last messages can arrive a moment after the browser says the install is complete (the app ignores late ones).
    const progress = () => page.evaluate(() => (window as unknown as { swSeen: Array<{ type: string; done: number; total: number }> })
      .swSeen.filter((m) => m.type === 'PRECACHE_PROGRESS'));
    await expect.poll(async () => { const p = await progress(); return p.length > 0 && p.at(-1)!.done === p.at(-1)!.total; }).toBe(true);
    const all = await progress();
    expect(all.length).toBeGreaterThan(10); // one per whole per cent, not one per file
    expect(all.length).toBeLessThanOrEqual(101);
    expect(all.at(-1)!.total).toBeGreaterThan(1000);
    await bar.getByRole('button', { name: 'OK' }).click();
    await expect(bar).toHaveCount(0);

    root = next; // publish
    await page.reload(); // he opens the app again
    await expect(bar).toContainText('A new version is ready', { timeout: 60_000 });
    expect(await isNext(page)).toBe(false);
    await page.reload(); // a reload alone does not switch, and the bar is still there
    await expect(bar).toContainText('A new version is ready', { timeout: 30_000 });
    expect(await isNext(page)).toBe(false);

    await page.goto(`${site.url}#/finds/new`);
    await expect(page.getByRole('heading', { name: 'Add a find' })).toBeVisible();
    await expect(bar).toHaveCount(0); // never offered while a find is being added
    await page.goto(`${site.url}#/guide`);
    await expect(bar).toContainText('A new version is ready');

    await bar.getByRole('button', { name: 'Restart' }).click();
    await expect.poll(() => isNext(page), { timeout: 30_000 }).toBe(true);
    await expect(bar).toHaveCount(0);
  } finally {
    await site.stop();
    rmSync(next, { recursive: true, force: true });
  }
});
