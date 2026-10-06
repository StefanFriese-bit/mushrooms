# Stage 2a — TEST Version on Stefan's Phone — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Default for this project:** inline with superpowers:executing-plans (Stefan's rule: helper agents only with his OK).

**Goal:** An installable web app at `https://stefanfriese-bit.github.io/mushrooms/` that works offline. It has:
- the shell with its five tabs;
- a banner on every screen: "Test version — not for identifying mushrooms";
- the Guide with ten sample species written to the full rules;
- Learn and About pages;
- placeholders for Scan, Identify and Finds, which come in stages 2b–2d.

It is published by GitHub Actions only when every check passes.

**Architecture:** A static single-page app: Vite 8, Preact 11, TypeScript, and a hash router, so GitHub Pages needs no server
rules. Species pages are JSON records in `content/species/`, bundled at build time. Photos are WebP files in
`public/photos/`. A service worker made by vite-plugin-pwa (Workbox) stores everything for offline use. Pure logic (the
router, search, record checks, photo choice) is tested with Vitest. The app as a whole is tested with Playwright in
Safari's engine at iPhone size and in Chromium, against a small static server that the tests can switch off to prove
the offline mode.

**Tech stack (checked 06/10/2026):** vite 8.3.3, preact 11.0.0, @preact/preset-vite 2.10.6, vite-plugin-pwa 2.0.0
(Vite ≤ 8), workbox-window 7.4.1, @vite-pwa/assets-generator 2.0.0, sharp (photo resizing, content tool only),
@playwright/test 1.63.0. GitHub Actions: checkout v7, setup-node v7, configure-pages v6, upload-pages-artifact v5,
deploy-pages v5.

**Spec:** `docs/superpowers/specs/2026-10-06-mushroom-app-design.md`, sections 4, 5, 8, 9 and 12, and section 13, stage 2.
Scan, Check, Identify, Finds and the map are NOT in this plan; they come in their own plans (2b finds and map,
2c Identify, 2d the photo scan and Check).

**Facts this plan stands on:**
- Preact 11 is a light upgrade from 10. It needs TypeScript ≥ 5.1 (we have 7.0.2), drops `defaultProps` and the
  automatic `px` on numbers (use explicit units), and ships ESM as `.mjs`.
- vite-plugin-pwa 2.0.0 (03/10/2026) only widened its assets-generator peer dependency to ^2. Its API is as in 1.x:
  `VitePWA({ registerType, manifest, workbox })`, with the client from `virtual:pwa-register`.
- Playwright and WebKit: after a service worker controls the page, `context.setOffline(true)` makes navigations fail
  ("WebKit encountered an internal error"; microsoft/playwright#42775). The offline test therefore stops the test
  server instead. That works in both engines.
- GitHub Pages on the free plan serves public repositories. The source must be set to "GitHub Actions" in the
  repository's Settings → Pages, which only the owner can do (Stefan, Task 10).
- iNaturalist's API serves observation photos with `license_code` and `attribution`. Only cc0, cc-by and cc-by-nc are
  used (spec 5.3).

All commands run from the project folder:

```bash
cd "/Users/Stefan/Local Desktop/Claude Projects/mushroom-app"
```

Work on a branch: `git checkout -b stage2a-test-version`.

---

## File structure

| File | Responsibility |
|---|---|
| `src/types.ts` | The species record (spec 5.1), shared by the app and the content tools |
| `src/router.ts` | The hash ↔ screen mapping (pure) |
| `src/species.ts` | Loading, sorting, searching and looking up records; the edibility words (pure) |
| `src/content.ts` | Bundles `content/species/*.json` with `import.meta.glob` |
| `src/app.tsx` | The shell: TEST banner, tabs, which screen shows |
| `src/screens/guide.tsx`, `species-page.tsx`, `learn.tsx`, `about.tsx`, `coming-soon.tsx` | The screens |
| `src/main.tsx`, `src/styles.css`, `index.html` | Entry, styles, page |
| `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts` | Build, unit tests, browser tests |
| `public/icon.svg` (+ generated PNG icons), `public/photos/<slug>/<n>.webp` | Icons and photos |
| `tools/lib/species-record.ts` | Every content rule for a species page (spec 5.3/5.4), pure |
| `tools/check-content.ts` | Runs those rules on `content/species/`, checks photo files exist |
| `tools/lib/photo-picker.ts` | Chooses open-licence photos from iNaturalist results (pure) |
| `tools/fetch-photos.ts` | Downloads, resizes and credits the photos for each record |
| `content/species/<slug>.json` | The ten sample species |
| `content/learn.json` | The Learn page's sections, each with its sources |
| `e2e/server.ts`, `e2e/app.spec.ts` | Static test server that can be switched off; the browser tests |
| `.github/workflows/publish.yml` | Test, build, browser-test, publish to GitHub Pages |

---

### Task 1: The app skeleton

**Files:** create `index.html`, `vite.config.ts`, `vitest.config.ts`, `src/main.tsx`, `src/app.tsx`, `src/styles.css`, `public/icon.svg`. Modify `package.json`, `tsconfig.json`.

- [ ] **Step 1: Install**

Run:
```bash
npm install preact
npm install --save-dev vite @preact/preset-vite vite-plugin-pwa workbox-window @vite-pwa/assets-generator @playwright/test sharp
```
Expected: `added … packages`, 0 vulnerabilities reported as high/critical. Check that the versions match the Tech
stack line with `npm ls vite preact vite-plugin-pwa @playwright/test`.

- [ ] **Step 2: Scripts in `package.json`**

Add to `"scripts"` (keep the existing ones):
```json
"dev": "vite",
"build": "vite build",
"preview": "vite preview",
"e2e": "playwright test",
"check-content": "tsx tools/check-content.ts",
"fetch-photos": "tsx tools/fetch-photos.ts",
"icons": "pwa-assets-generator --preset minimal-2023 public/icon.svg"
```

- [ ] **Step 3: `tsconfig.json` (replace whole file)**

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "noEmit": true,
    "strict": true,
    "skipLibCheck": true,
    "jsx": "react-jsx",
    "jsxImportSource": "preact",
    "types": ["node", "vite/client", "vite-plugin-pwa/client"]
  },
  "include": ["tools", "tests", "src", "e2e", "vite.config.ts", "vitest.config.ts", "playwright.config.ts"]
}
```

- [ ] **Step 4: `vitest.config.ts` (unit tests only; Playwright owns `e2e/`)**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['tests/**/*.test.ts', 'src/**/*.test.ts'] },
});
```

- [ ] **Step 5: `vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/mushrooms/',
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Mushroom Guide (test version)',
        short_name: 'Mushrooms',
        description: 'A UK mushroom guide. Test version: not for identifying mushrooms.',
        theme_color: '#2f3a2f',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/mushrooms/',
        scope: '/mushrooms/',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,webp,png,svg,ico,webmanifest}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
});
```

- [ ] **Step 6: `index.html`**

```html
<!doctype html>
<html lang="en-GB">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#2f3a2f" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="Mushrooms" />
    <link rel="icon" href="favicon.ico" sizes="48x48" />
    <link rel="apple-touch-icon" href="apple-touch-icon-180x180.png" />
    <title>Mushroom Guide (test)</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: `public/icon.svg` and the icons**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#2f3a2f"/>
  <path d="M96 268c0-92 72-164 160-164s160 72 160 164c0 14-11 24-25 24H121c-14 0-25-10-25-24z" fill="#e9d8b4"/>
  <circle cx="200" cy="200" r="18" fill="#c9b48a"/><circle cx="296" cy="176" r="14" fill="#c9b48a"/><circle cx="338" cy="236" r="12" fill="#c9b48a"/>
  <path d="M216 292h80l-10 116c-1 14-13 24-27 24h-6c-14 0-26-10-27-24z" fill="#f6f1e6"/>
</svg>
```
Run: `npm run icons`
Expected: `public/` gains `favicon.ico`, `pwa-64x64.png`, `pwa-192x192.png`, `pwa-512x512.png`,
`maskable-icon-512x512.png` and `apple-touch-icon-180x180.png`.

- [ ] **Step 8: `src/main.tsx`, a first `src/app.tsx` and `src/styles.css`**

`src/main.tsx`:
```tsx
import { render } from 'preact';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app';
import './styles.css';

render(<App />, document.getElementById('app')!);
registerSW({ immediate: true });
```

`src/app.tsx` (replaced in Task 5):
```tsx
export function App() {
  return (
    <div class="shell">
      <div class="test-banner" role="note">Test version — not for identifying mushrooms</div>
      <main><h1>Mushroom Guide</h1></main>
    </div>
  );
}
```

`src/styles.css`:
```css
:root { --bg:#fff; --fg:#1d1d1f; --muted:#6e6e73; --line:#e5e5ea; --card:#f6f6f4; --accent:#2f3a2f;
  --deadly:#b3261e; --poison:#b25c00; --edible:#1b7f3b; --plain:#4a4a4f; --banner:#fff4cc; --banner-fg:#5c4400; }
@media (prefers-color-scheme: dark) { :root { --bg:#161617; --fg:#f5f5f7; --muted:#a1a1a6; --line:#2c2c2e; --card:#1f1f21;
  --accent:#a8c3a0; --deadly:#ff6b60; --poison:#ffb04d; --edible:#5fd383; --plain:#c7c7cc; --banner:#3a3000; --banner-fg:#ffe08a; } }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--fg); font: 16px/1.5 -apple-system, system-ui, sans-serif; }
.shell { min-height: 100vh; padding-bottom: calc(64px + env(safe-area-inset-bottom)); }
.test-banner { position: sticky; top: 0; z-index: 2; background: var(--banner); color: var(--banner-fg); font-size: 14px;
  text-align: center; padding: calc(6px + env(safe-area-inset-top)) 12px 6px; }
main { padding: 12px 16px 24px; max-width: 720px; margin: 0 auto; }
h1 { font-size: 22px; margin: 8px 0 12px; } h2 { font-size: 18px; margin: 20px 0 8px; } h3 { font-size: 16px; margin: 14px 0 6px; }
.muted { color: var(--muted); } .sci { font-style: italic; color: var(--muted); }
.tag { display: inline-block; font-size: 13px; padding: 1px 8px; border-radius: 6px; border: 1px solid currentColor; }
.tag.deadly { color: var(--deadly); } .tag.poisonous { color: var(--poison); } .tag.edible { color: var(--edible); } .tag.plain { color: var(--plain); }
.tabs { position: fixed; bottom: 0; left: 0; right: 0; display: grid; grid-template-columns: repeat(5, 1fr);
  background: var(--bg); border-top: 1px solid var(--line); padding-bottom: env(safe-area-inset-bottom); }
.tabs a { text-align: center; padding: 10px 0 8px; font-size: 12px; color: var(--muted); text-decoration: none; }
.tabs a[aria-current="page"] { color: var(--accent); font-weight: 600; }
.row { display: flex; gap: 12px; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--line); color: inherit; text-decoration: none; }
.row img { width: 56px; height: 56px; object-fit: cover; border-radius: 8px; flex: none; background: var(--card); }
.search { width: 100%; font-size: 16px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--bg); color: var(--fg); }
.photos { display: flex; gap: 8px; overflow-x: auto; scroll-snap-type: x mandatory; margin: 0 -16px; padding: 0 16px; }
.photos figure { margin: 0; flex: none; width: 82%; scroll-snap-align: start; }
.photos img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 10px; background: var(--card); }
.photos figcaption { font-size: 12px; color: var(--muted); }
.card { background: var(--card); border-radius: 12px; padding: 12px; margin: 10px 0; }
table.apart { width: 100%; border-collapse: collapse; font-size: 14px; }
table.apart th, table.apart td { text-align: left; vertical-align: top; padding: 6px 4px; border-top: 1px solid var(--line); }
ol.sources { font-size: 13px; color: var(--muted); padding-left: 20px; } a { color: var(--accent); }
```

- [ ] **Step 9: Build and type-check**

Run: `npm run build && npm run typecheck && npm test`
Expected: `dist/` holds `index.html`, `sw.js`, `manifest.webmanifest` and the icons. Type check exit 0. The existing
49 tests still pass.

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts vite.config.ts index.html src public
git commit -m "feat(app): Vite + Preact skeleton with the TEST banner, offline service worker and icons"
```

---

### Task 2: The species record and its rules

**Files:** create `src/types.ts`, `tools/lib/species-record.ts`, `tests/species-record.test.ts`.

- [ ] **Step 1: `src/types.ts`**

```ts
export type Edibility = 'edible-cooked' | 'edible-some-react' | 'not-edible' | 'poisonous' | 'deadly';
export type LookalikeKind = 'deadly' | 'poisonous' | 'edible' | 'not-edible';

/** A source, declared once per record and referred to by its id in each fact. */
export type SourceRef = { id: string; title: string; url: string };
/** Every safety fact names the sources (by id) that state it. */
export type Sourced<T> = { value: T; sources: string[] };

export type Photo = {
  file: string; // relative to the site root, e.g. "photos/field-mushroom/1.webp"
  view: 'top' | 'underneath' | 'base' | 'whole' | 'young' | 'old';
  credit: string; // the photographer, as iNaturalist gives it
  licence: 'cc0' | 'cc-by' | 'cc-by-nc';
  link: string; // the observation on iNaturalist
};

export type Lookalike = {
  scientific: string;
  english: string;
  slug: string | null; // the lookalike's own page, when the guide has one
  kind: LookalikeKind;
  /** One row per feature that tells the two apart. */
  tellApart: Array<{ feature: string; thisOne: string; thatOne: string; sources: string[] }>;
};

export type Features = {
  underside: Sourced<'gills' | 'pores' | 'teeth' | 'ridges' | 'smooth' | 'other'>;
  ring: Sourced<'yes' | 'no' | 'sometimes'>;
  bagAtBase: Sourced<'yes' | 'no'>;
  growsOn: Sourced<'ground' | 'wood' | 'other-fungi' | 'dung'>;
  capCm: Sourced<[number, number]>;
  fleshChange: Sourced<string>;
  smell: Sourced<string>;
};

export type SpeciesRecord = {
  slug: string;
  inatId: number;
  scientific: string;
  english: string;
  olderNames: string[];
  edibility: Sourced<Edibility>;
  edibilityNote: Sourced<string> | null;
  protectedInUk: Sourced<boolean>;
  topPoints: Sourced<string>[];
  habitat: Sourced<string>;
  seasonMonths: Sourced<number[]>;
  sporePrint: Sourced<string>;
  features: Features;
  lookalikes: Lookalike[];
  noDangerousLookalike: { sources: string[] } | null;
  photos: Photo[];
  sources: SourceRef[];
  checked: string; // ISO date the facts were last checked
};
```

- [ ] **Step 2: Write the failing tests — `tests/species-record.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { checkRecord, checkRecords } from '../tools/lib/species-record.ts';
import type { SpeciesRecord } from '../src/types.ts';

const HOSTS = ['first-nature.com', 'wildfooduk.com', 'en.wikipedia.org', 'woodlandtrust.org.uk'];
const two = ['fn', 'wf'];

function rec(over: Partial<SpeciesRecord> = {}): SpeciesRecord {
  return {
    slug: 'field-mushroom',
    inatId: 1,
    scientific: 'Agaricus campestris',
    english: 'Field Mushroom',
    olderNames: [],
    edibility: { value: 'edible-cooked', sources: two },
    edibilityNote: null,
    protectedInUk: { value: false, sources: two },
    topPoints: [
      { value: 'Pink gills turning chocolate brown.', sources: two },
      { value: 'No bag at the base of the stem.', sources: two },
      { value: 'Grows in open grassland.', sources: two },
    ],
    habitat: { value: 'Pasture and lawns.', sources: two },
    seasonMonths: { value: [7, 8, 9, 10], sources: two },
    sporePrint: { value: 'Dark brown', sources: two },
    features: {
      underside: { value: 'gills', sources: two },
      ring: { value: 'yes', sources: two },
      bagAtBase: { value: 'no', sources: two },
      growsOn: { value: 'ground', sources: two },
      capCm: { value: [3, 10], sources: two },
      fleshChange: { value: 'Slightly pinkish; never chrome yellow', sources: two },
      smell: { value: 'Pleasant, mushroomy', sources: two },
    },
    lookalikes: [
      {
        scientific: 'Agaricus xanthodermus',
        english: 'Yellow Stainer',
        slug: 'yellow-stainer',
        kind: 'poisonous',
        tellApart: [{ feature: 'Stem base when cut', thisOne: 'No colour change', thatOne: 'Chrome yellow', sources: two }],
      },
    ],
    noDangerousLookalike: null,
    photos: [{ file: 'photos/field-mushroom/1.webp', view: 'top', credit: 'A. Person', licence: 'cc-by', link: 'https://www.inaturalist.org/observations/1' }],
    sources: [
      { id: 'fn', title: 'First Nature', url: 'https://www.first-nature.com/fungi/agaricus-campestris.php' },
      { id: 'wf', title: 'Wild Food UK', url: 'https://www.wildfooduk.com/mushroom-guide/field-mushroom/' },
    ],
    checked: '2026-10-06',
    ...over,
  };
}

describe('checkRecord', () => {
  it('accepts a complete, sourced record', () => {
    expect(checkRecord(rec(), HOSTS)).toEqual([]);
  });
  it('needs two different websites behind every safety fact', () => {
    const r = rec({ edibility: { value: 'edible-cooked', sources: ['fn'] } });
    expect(checkRecord(r, HOSTS)).toContain('field-mushroom: edibility needs sources from two different websites (has 1)');
  });
  it('refuses a source id the record does not declare', () => {
    const r = rec({ sporePrint: { value: 'Dark brown', sources: ['fn', 'zz'] } });
    expect(checkRecord(r, HOSTS)).toContain('field-mushroom: sporePrint names an undeclared source "zz"');
  });
  it('refuses a source website that is not allowed', () => {
    const r = rec();
    r.sources.push({ id: 'ex', title: 'Example', url: 'https://example.com/x' });
    expect(checkRecord(r, HOSTS)).toContain('field-mushroom: source "ex" is on example.com, which is not on the allowed list');
  });
  it('needs 3 to 6 top points', () => {
    expect(checkRecord(rec({ topPoints: [] }), HOSTS)).toContain('field-mushroom: needs 3 to 6 top points (has 0)');
  });
  it('needs dangerous lookalikes or a sourced "no dangerous lookalike" for an edible species', () => {
    const r = rec({ lookalikes: [] });
    expect(checkRecord(r, HOSTS)).toContain('field-mushroom: an edible species must name its dangerous lookalikes or carry "no dangerous lookalike"');
  });
  it('needs a sourced row for every lookalike', () => {
    const r = rec();
    r.lookalikes[0].tellApart = [];
    expect(checkRecord(r, HOSTS)).toContain('field-mushroom: lookalike Yellow Stainer needs at least one "tell them apart" row');
  });
  it('allows only open-licence photos with a credit and a link', () => {
    const r = rec();
    (r.photos[0] as { licence: string }).licence = 'all-rights-reserved';
    expect(checkRecord(r, HOSTS)).toContain('field-mushroom: photo 1 has a licence that is not allowed (all-rights-reserved)');
  });
  it('never says "safe"', () => {
    const r = rec({ topPoints: [...rec().topPoints, { value: 'Safe to eat when cooked.', sources: two }] });
    expect(checkRecord(r, HOSTS)).toContain('field-mushroom: uses the word "safe"');
  });
});

describe('checkRecords', () => {
  it('needs lookalike links both ways when both pages exist', () => {
    const a = rec();
    const b = rec({ slug: 'yellow-stainer', scientific: 'Agaricus xanthodermus', english: 'Yellow Stainer',
      edibility: { value: 'poisonous', sources: two }, lookalikes: [], noDangerousLookalike: null });
    expect(checkRecords([a, b], HOSTS)).toContain('yellow-stainer: does not link back to its lookalike field-mushroom');
  });
  it('refuses two records with the same slug', () => {
    expect(checkRecords([rec(), rec()], HOSTS)).toContain('field-mushroom: slug used twice');
  });
});
```

- [ ] **Step 3: Run them to see them fail**

Run: `npx vitest run tests/species-record.test.ts`
Expected: FAIL — cannot find module `../tools/lib/species-record.ts`.

- [ ] **Step 4: `tools/lib/species-record.ts`**

```ts
import type { SpeciesRecord } from '../../src/types.ts';
import { hostOf } from './core-lists.ts';

const EDIBILITY = ['edible-cooked', 'edible-some-react', 'not-edible', 'poisonous', 'deadly'];
const KINDS = ['deadly', 'poisonous', 'edible', 'not-edible'];
const LICENCES = ['cc0', 'cc-by', 'cc-by-nc'];

/** Every problem with one record, in words. */
export function checkRecord(r: SpeciesRecord, allowedHosts: string[]): string[] {
  const out: string[] = [];
  const say = (m: string) => out.push(`${r.slug}: ${m}`);
  const allowed = new Set(allowedHosts.map((h) => h.replace(/^www\./, '')));
  const hostById = new Map<string, string>();
  for (const s of r.sources) {
    const h = hostOf(s.url);
    if (!h || !allowed.has(h)) say(`source "${s.id}" is on ${h ?? 'an invalid address'}, which is not on the allowed list`);
    else hostById.set(s.id, h);
  }

  const sourced = (what: string, sources: string[]) => {
    const hosts = new Set<string>();
    for (const id of sources) {
      const h = hostById.get(id);
      if (!h) {
        if (!r.sources.some((s) => s.id === id)) say(`${what} names an undeclared source "${id}"`);
      } else hosts.add(h);
    }
    if (hosts.size < 2) say(`${what} needs sources from two different websites (has ${hosts.size})`);
  };

  if (!/^[a-z0-9-]+$/.test(r.slug)) say('slug must be lower-case letters, digits and hyphens');
  if (!EDIBILITY.includes(r.edibility.value)) say(`edibility "${r.edibility.value}" is not one of ${EDIBILITY.join(', ')}`);
  sourced('edibility', r.edibility.sources);
  if (r.edibilityNote) sourced('edibilityNote', r.edibilityNote.sources);
  sourced('protectedInUk', r.protectedInUk.sources);
  if (r.topPoints.length < 3 || r.topPoints.length > 6) say(`needs 3 to 6 top points (has ${r.topPoints.length})`);
  r.topPoints.forEach((t, i) => sourced(`top point ${i + 1}`, t.sources));
  sourced('habitat', r.habitat.sources);
  sourced('seasonMonths', r.seasonMonths.sources);
  sourced('sporePrint', r.sporePrint.sources);
  for (const [k, v] of Object.entries(r.features)) sourced(`feature ${k}`, v.sources);

  for (const l of r.lookalikes) {
    if (!KINDS.includes(l.kind)) say(`lookalike ${l.english} has an unknown kind "${l.kind}"`);
    if (l.tellApart.length === 0) say(`lookalike ${l.english} needs at least one "tell them apart" row`);
    l.tellApart.forEach((row, i) => sourced(`lookalike ${l.english} row ${i + 1}`, row.sources));
  }
  const edible = r.edibility.value === 'edible-cooked' || r.edibility.value === 'edible-some-react';
  const dangerousLookalikes = r.lookalikes.filter((l) => l.kind === 'deadly' || l.kind === 'poisonous');
  if (edible && dangerousLookalikes.length === 0 && !r.noDangerousLookalike) {
    say('an edible species must name its dangerous lookalikes or carry "no dangerous lookalike"');
  }
  if (r.noDangerousLookalike) {
    if (dangerousLookalikes.length > 0) say('names dangerous lookalikes AND says it has none');
    sourced('noDangerousLookalike', r.noDangerousLookalike.sources);
  }

  if (r.photos.length === 0) say('needs at least one photo');
  r.photos.forEach((p, i) => {
    if (!LICENCES.includes(p.licence)) say(`photo ${i + 1} has a licence that is not allowed (${p.licence})`);
    if (!p.credit.trim()) say(`photo ${i + 1} has no credit`);
    if (!/^https:\/\/www\.inaturalist\.org\/observations\/\d+$/.test(p.link)) say(`photo ${i + 1} needs its iNaturalist observation link`);
  });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.checked)) say('checked must be a date like 2026-10-06');
  if (/\bsafe\b/i.test(JSON.stringify({ ...r, sources: [], photos: [] }))) say('uses the word "safe"');
  return out;
}

/** Rules across all records, plus each record's own rules. */
export function checkRecords(records: SpeciesRecord[], allowedHosts: string[]): string[] {
  const out = records.flatMap((r) => checkRecord(r, allowedHosts));
  const seen = new Set<string>();
  for (const r of records) {
    if (seen.has(r.slug)) out.push(`${r.slug}: slug used twice`);
    seen.add(r.slug);
  }
  const bySlug = new Map(records.map((r) => [r.slug, r]));
  for (const r of records) {
    for (const l of r.lookalikes) {
      const other = l.slug ? bySlug.get(l.slug) : undefined;
      if (other && !other.lookalikes.some((x) => x.slug === r.slug)) out.push(`${other.slug}: does not link back to its lookalike ${r.slug}`);
    }
  }
  return out;
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `npx vitest run tests/species-record.test.ts && npm run typecheck`
Expected: `11 passed`; type check exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/types.ts tools/lib/species-record.ts tests/species-record.test.ts
git commit -m "feat(content): the species record and every page rule (two sources, lookalikes, licences, no 'safe')"
```

---

### Task 3: Router and species logic (pure)

**Files:** create `src/router.ts`, `src/router.test.ts`, `src/species.ts`, `src/species.test.ts`.

- [ ] **Step 1: Write the failing tests**

`src/router.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { hrefFor, parseHash } from './router.ts';

describe('parseHash', () => {
  it('opens the guide by default', () => {
    expect(parseHash('')).toEqual({ name: 'guide', query: '' });
    expect(parseHash('#/')).toEqual({ name: 'guide', query: '' });
  });
  it('reads the guide search', () => {
    expect(parseHash('#/guide?q=cap')).toEqual({ name: 'guide', query: 'cap' });
  });
  it('reads a species page', () => {
    expect(parseHash('#/species/field-mushroom')).toEqual({ name: 'species', slug: 'field-mushroom' });
  });
  it('reads the other tabs', () => {
    for (const n of ['scan', 'identify', 'finds', 'learn', 'about'] as const) expect(parseHash(`#/${n}`)).toEqual({ name: n });
  });
  it('reports an unknown address', () => {
    expect(parseHash('#/nowhere')).toEqual({ name: 'not-found', path: '/nowhere' });
  });
});

describe('hrefFor', () => {
  it('round-trips', () => {
    expect(hrefFor({ name: 'species', slug: 'deathcap' })).toBe('#/species/deathcap');
    expect(hrefFor({ name: 'guide', query: 'yellow stainer' })).toBe('#/guide?q=yellow+stainer');
    expect(parseHash(hrefFor({ name: 'guide', query: 'yellow stainer' }))).toEqual({ name: 'guide', query: 'yellow stainer' });
  });
});
```

`src/species.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { EDIBILITY_WORDS, bySlug, loadAll, searchSpecies } from './species.ts';
import type { SpeciesRecord } from './types.ts';

const r = (slug: string, english: string, scientific: string, olderNames: string[] = []) =>
  ({ slug, english, scientific, olderNames }) as unknown as SpeciesRecord;

describe('species logic', () => {
  const all = loadAll({
    'a.json': { default: r('yellow-stainer', 'Yellow Stainer', 'Agaricus xanthodermus') },
    'b.json': { default: r('field-mushroom', 'Field Mushroom', 'Agaricus campestris') },
    'c.json': { default: r('wood-blewit', 'Wood Blewit', 'Collybia nuda', ['Lepista nuda']) },
  });
  it('sorts by English name', () => {
    expect(all.map((s) => s.slug)).toEqual(['field-mushroom', 'wood-blewit', 'yellow-stainer']);
  });
  it('searches English, scientific and older names, ignoring case', () => {
    expect(searchSpecies(all, 'AGARICUS').map((s) => s.slug)).toEqual(['field-mushroom', 'yellow-stainer']);
    expect(searchSpecies(all, 'lepista').map((s) => s.slug)).toEqual(['wood-blewit']);
    expect(searchSpecies(all, '  ')).toHaveLength(3);
  });
  it('finds a page by slug', () => {
    expect(bySlug(all, 'wood-blewit')?.english).toBe('Wood Blewit');
    expect(bySlug(all, 'nope')).toBeUndefined();
  });
  it('words edibility plainly and never "safe"', () => {
    expect(EDIBILITY_WORDS.deadly).toBe('Deadly');
    expect(Object.values(EDIBILITY_WORDS).join(' ')).not.toMatch(/safe/i);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/router.test.ts src/species.test.ts`
Expected: FAIL — cannot find the modules.

- [ ] **Step 3: `src/router.ts`**

```ts
export type Route =
  | { name: 'guide'; query: string }
  | { name: 'species'; slug: string }
  | { name: 'scan' }
  | { name: 'identify' }
  | { name: 'finds' }
  | { name: 'learn' }
  | { name: 'about' }
  | { name: 'not-found'; path: string };

const SIMPLE = ['scan', 'identify', 'finds', 'learn', 'about'] as const;

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, '') || '/';
  const [path, qs = ''] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0 || parts[0] === 'guide') return { name: 'guide', query: new URLSearchParams(qs).get('q') ?? '' };
  if (parts[0] === 'species' && parts[1]) return { name: 'species', slug: decodeURIComponent(parts[1]) };
  const simple = SIMPLE.find((n) => n === parts[0]);
  if (simple && parts.length === 1) return { name: simple };
  return { name: 'not-found', path };
}

export function hrefFor(route: Route): string {
  switch (route.name) {
    case 'guide':
      return route.query ? `#/guide?${new URLSearchParams({ q: route.query })}` : '#/guide';
    case 'species':
      return `#/species/${encodeURIComponent(route.slug)}`;
    case 'not-found':
      return '#/guide';
    default:
      return `#/${route.name}`;
  }
}
```

- [ ] **Step 4: `src/species.ts`**

```ts
import type { Edibility, LookalikeKind, SpeciesRecord } from './types.ts';

export const EDIBILITY_WORDS: Record<Edibility, string> = {
  'edible-cooked': 'Edible, cooked',
  'edible-some-react': 'Edible, but some people react',
  'not-edible': 'Not edible',
  poisonous: 'Poisonous',
  deadly: 'Deadly',
};

export const KIND_WORDS: Record<LookalikeKind, string> = {
  deadly: 'Deadly',
  poisonous: 'Poisonous',
  edible: 'Edible',
  'not-edible': 'Not edible',
};

/** CSS class for a tag: deadly / poisonous / edible / plain. */
export function tagClass(v: Edibility | LookalikeKind): string {
  if (v === 'deadly') return 'deadly';
  if (v === 'poisonous') return 'poisonous';
  if (v === 'edible' || v === 'edible-cooked' || v === 'edible-some-react') return 'edible';
  return 'plain';
}

export function loadAll(modules: Record<string, { default: SpeciesRecord }>): SpeciesRecord[] {
  return Object.values(modules)
    .map((m) => m.default)
    .sort((a, b) => a.english.localeCompare(b.english, 'en-GB'));
}

export function searchSpecies(all: SpeciesRecord[], query: string): SpeciesRecord[] {
  const q = query.trim().toLowerCase();
  if (!q) return all;
  return all.filter((s) => [s.english, s.scientific, ...s.olderNames].some((n) => n.toLowerCase().includes(q)));
}

export function bySlug(all: SpeciesRecord[], slug: string): SpeciesRecord | undefined {
  return all.find((s) => s.slug === slug);
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `npx vitest run src/router.test.ts src/species.test.ts && npm run typecheck`
Expected: `10 passed`; type check exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/router.ts src/router.test.ts src/species.ts src/species.test.ts
git commit -m "feat(app): hash router and species search/lookup, with plain edibility words"
```

---

### Task 4: Photos — choose, download, credit

**Files:** create `tools/lib/photo-picker.ts`, `tests/photo-picker.test.ts`, `tools/fetch-photos.ts`.

- [ ] **Step 1: Write the failing test — `tests/photo-picker.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { pickPhotos } from '../tools/lib/photo-picker.ts';

const obs = (id: number, licence: string | null, faves = 0) => ({
  id,
  faves_count: faves,
  photos: [{ id: id * 10, license_code: licence, attribution: `(c) person ${id}, some rights reserved (CC BY)`, url: `https://inaturalist-open-data.s3.amazonaws.com/photos/${id * 10}/square.jpg` }],
});

describe('pickPhotos', () => {
  it('keeps open licences only, most-faved first, one photo per observation, up to the limit', () => {
    const picked = pickPhotos([obs(1, 'cc-by', 2), obs(2, null, 9), obs(3, 'cc-by-nc', 5), obs(4, 'cc-by-sa', 7), obs(5, 'cc0', 1)], 3);
    expect(picked.map((p) => p.observationId)).toEqual([3, 1, 5]);
    expect(picked[0]).toMatchObject({ licence: 'cc-by-nc', link: 'https://www.inaturalist.org/observations/3' });
    expect(picked[0].largeUrl).toBe('https://inaturalist-open-data.s3.amazonaws.com/photos/30/large.jpg');
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/photo-picker.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: `tools/lib/photo-picker.ts`**

```ts
export type InatObservation = {
  id: number;
  faves_count?: number;
  photos: Array<{ id: number; license_code: string | null; attribution: string; url: string }>;
};

export type PickedPhoto = {
  observationId: number;
  photoId: number;
  licence: 'cc0' | 'cc-by' | 'cc-by-nc';
  credit: string;
  largeUrl: string;
  link: string;
};

const OPEN = new Set(['cc0', 'cc-by', 'cc-by-nc']);

/** Open-licence photos only (spec 5.3), the observation's first such photo, most-faved observations first. */
export function pickPhotos(observations: InatObservation[], limit: number): PickedPhoto[] {
  return [...observations]
    .sort((a, b) => (b.faves_count ?? 0) - (a.faves_count ?? 0))
    .flatMap((o) => {
      const p = o.photos.find((x) => x.license_code && OPEN.has(x.license_code));
      if (!p) return [];
      return [{
        observationId: o.id,
        photoId: p.id,
        licence: p.license_code as PickedPhoto['licence'],
        credit: p.attribution,
        largeUrl: p.url.replace('/square.', '/large.'),
        link: `https://www.inaturalist.org/observations/${o.id}`,
      }];
    })
    .slice(0, limit);
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run tests/photo-picker.test.ts && npm run typecheck`
Expected: `1 passed`; type check exit 0.

- [ ] **Step 5: `tools/fetch-photos.ts`**

It fetches photos for every record that has fewer than four, saves 800-px WebP files and writes the credits into the
record.

```ts
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { createInatClient } from './lib/inat.ts';
import { pickPhotos, type InatObservation } from './lib/photo-picker.ts';
import type { SpeciesRecord } from '../src/types.ts';

const ROOT = new URL('../', import.meta.url);
const WANT = 4;
const inat = createInatClient();

for (const file of readdirSync(new URL('content/species/', ROOT)).filter((f) => f.endsWith('.json'))) {
  const url = new URL(`content/species/${file}`, ROOT);
  const rec = JSON.parse(readFileSync(url, 'utf8')) as SpeciesRecord;
  if (rec.photos.length >= WANT) continue;
  const q = new URLSearchParams({
    taxon_id: String(rec.inatId), place_id: '6857', quality_grade: 'research', photos: 'true',
    photo_license: 'cc0,cc-by,cc-by-nc', order_by: 'votes', per_page: '30',
  });
  const body = await inat.getJson(`/observations?${q}`);
  const picked = pickPhotos(body.results as InatObservation[], WANT);
  mkdirSync(new URL(`public/photos/${rec.slug}/`, ROOT), { recursive: true });
  rec.photos = [];
  for (const [i, p] of picked.entries()) {
    const res = await fetch(p.largeUrl);
    if (!res.ok) throw new Error(`Photo ${p.largeUrl} answered HTTP ${res.status}`);
    const out = `photos/${rec.slug}/${i + 1}.webp`;
    await sharp(Buffer.from(await res.arrayBuffer())).resize({ width: 800, withoutEnlargement: true }).webp({ quality: 72 }).toFile(fileURLToPath(new URL(`public/${out}`, ROOT)));
    rec.photos.push({ file: out, view: 'whole', credit: p.credit, licence: p.licence, link: p.link });
  }
  writeFileSync(url, JSON.stringify(rec, null, 2) + '\n');
  console.log(`${rec.slug}: ${rec.photos.length} photos`);
}
```
Note: sharp's `toFile` gets `fileURLToPath(...)`, never `URL.pathname`, which keeps `%20` for the spaces in "Local
Desktop".

- [ ] **Step 6: Commit**

```bash
git add tools/lib/photo-picker.ts tests/photo-picker.test.ts tools/fetch-photos.ts
git commit -m "feat(content): choose open-licence iNaturalist photos and save credited 800px WebP copies"
```

---

### Task 5: The screens

**Files:** create `src/content.ts`, `src/screens/guide.tsx`, `src/screens/species-page.tsx`, `src/screens/learn.tsx`, `src/screens/about.tsx`, `src/screens/coming-soon.tsx`, `content/learn.json` (placeholder until Task 7). Replace `src/app.tsx`.

- [ ] **Step 1: `src/content.ts`**

```ts
import type { SpeciesRecord } from './types';
import { loadAll } from './species';

const modules = import.meta.glob<{ default: SpeciesRecord }>('../content/species/*.json', { eager: true });
export const ALL_SPECIES = loadAll(modules);
export const photoUrl = (file: string) => `${import.meta.env.BASE_URL}${file}`;
```

- [ ] **Step 2: `src/screens/guide.tsx`**

```tsx
import { ALL_SPECIES, photoUrl } from '../content';
import { hrefFor } from '../router';
import { EDIBILITY_WORDS, searchSpecies, tagClass } from '../species';

export function Guide({ query }: { query: string }) {
  const shown = searchSpecies(ALL_SPECIES, query);
  return (
    <>
      <h1>Guide</h1>
      <input class="search" type="search" placeholder="Search by name" value={query} aria-label="Search the guide"
        onInput={(e) => { location.hash = hrefFor({ name: 'guide', query: (e.target as HTMLInputElement).value }); }} />
      <p class="muted">{shown.length} of {ALL_SPECIES.length} species</p>
      {shown.map((s) => (
        <a class="row" data-test="species-row" href={hrefFor({ name: 'species', slug: s.slug })} key={s.slug}>
          <img src={s.photos[0] ? photoUrl(s.photos[0].file) : ''} alt="" loading="lazy" />
          <div>
            <div>{s.english}</div>
            <div class="sci">{s.scientific}</div>
            <span class={`tag ${tagClass(s.edibility.value)}`}>{EDIBILITY_WORDS[s.edibility.value]}</span>
          </div>
        </a>
      ))}
    </>
  );
}
```

- [ ] **Step 3: `src/screens/species-page.tsx`**

```tsx
import type { Sourced, SpeciesRecord } from '../types';
import { ALL_SPECIES, photoUrl } from '../content';
import { hrefFor } from '../router';
import { EDIBILITY_WORDS, KIND_WORDS, bySlug, tagClass } from '../species';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function Refs({ rec, fact }: { rec: SpeciesRecord; fact: { sources: string[] } }) {
  const n = fact.sources.map((id) => rec.sources.findIndex((s) => s.id === id) + 1).filter((i) => i > 0);
  return <sup class="muted"> [{n.join(', ')}]</sup>;
}

export function SpeciesPage({ slug }: { slug: string }) {
  const s = bySlug(ALL_SPECIES, slug);
  if (!s) return <><h1>Not in the guide</h1><p><a href={hrefFor({ name: 'guide', query: '' })}>Back to the guide</a></p></>;
  const line = (label: string, f: Sourced<string>) => <p><strong>{label}:</strong> {f.value}<Refs rec={s} fact={f} /></p>;
  return (
    <>
      <div class="photos">
        {s.photos.map((p, i) => (
          <figure key={p.file}>
            <img src={photoUrl(p.file)} alt={`${s.english}, photo ${i + 1}`} />
            <figcaption>{p.credit} · <a href={p.link}>iNaturalist</a></figcaption>
          </figure>
        ))}
      </div>
      <h1>{s.english}</h1>
      <p class="sci">{s.scientific}{s.olderNames.length ? ` (formerly ${s.olderNames.join(', ')})` : ''}</p>
      <p>
        <span class={`tag ${tagClass(s.edibility.value)}`}>{EDIBILITY_WORDS[s.edibility.value]}</span>
        <Refs rec={s} fact={s.edibility} />
        {s.protectedInUk.value && <> <span class="tag plain">Protected in the UK — do not pick</span></>}
      </p>
      {s.edibilityNote && <p class="card">{s.edibilityNote.value}<Refs rec={s} fact={s.edibilityNote} /></p>}

      <h2>Top points</h2>
      <ul>{s.topPoints.map((t) => <li key={t.value}>{t.value}<Refs rec={s} fact={t} /></li>)}</ul>

      <h2>Dangerous lookalikes</h2>
      {s.noDangerousLookalike && <p>No dangerous lookalike in the UK<Refs rec={s} fact={s.noDangerousLookalike} /></p>}
      {s.lookalikes.map((l) => (
        <div class="card" key={l.scientific}>
          <h3>
            {l.slug && bySlug(ALL_SPECIES, l.slug) ? <a href={hrefFor({ name: 'species', slug: l.slug })}>{l.english}</a> : l.english}{' '}
            <span class={`tag ${tagClass(l.kind)}`}>{KIND_WORDS[l.kind]}</span>
          </h3>
          <p class="sci">{l.scientific}</p>
          <table class="apart">
            <thead><tr><th></th><th>{s.english}</th><th>{l.english}</th></tr></thead>
            <tbody>
              {l.tellApart.map((r) => (
                <tr key={r.feature}><th>{r.feature}</th><td>{r.thisOne}</td><td>{r.thatOne}<Refs rec={s} fact={r} /></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <h2>Where and when</h2>
      {line('Habitat', s.habitat)}
      <p><strong>Season:</strong> {s.seasonMonths.value.map((m) => MONTHS[m - 1]).join(', ')}<Refs rec={s} fact={s.seasonMonths} /></p>
      {line('Spore print', s.sporePrint)}

      <h2>Sources</h2>
      <ol class="sources">{s.sources.map((src) => <li key={src.id}><a href={src.url}>{src.title}</a></li>)}</ol>
      <p class="muted">Facts checked {s.checked}. Photos: iNaturalist, each credited above.</p>
    </>
  );
}
```

- [ ] **Step 4: `src/screens/coming-soon.tsx`, `src/screens/about.tsx`, `src/screens/learn.tsx`**

```tsx
// coming-soon.tsx
export function ComingSoon({ title, what }: { title: string; what: string }) {
  return <><h1>{title}</h1><p class="card">{what} comes in a later step of the build.</p></>;
}
```

```tsx
// about.tsx
import { useEffect, useState } from 'preact/hooks';
import { ALL_SPECIES } from '../content';

export function About() {
  const [kept, setKept] = useState<string>('checking…');
  useEffect(() => {
    if (!navigator.storage?.persisted) { setKept('not supported in this browser'); return; }
    navigator.storage.persisted().then((p) => setKept(p ? 'yes' : 'not yet'));
  }, []);
  return (
    <>
      <h1>About</h1>
      <p class="card">Test version — not for identifying mushrooms. Never eat a mushroom on this app's word.</p>
      <p>{ALL_SPECIES.length} sample species. Built {__BUILD_DATE__}.</p>
      <p>Storage kept by the phone: {kept}</p>
      <h2>Credits</h2>
      <p>Photos from iNaturalist observers, each credited on its species page (CC0, CC BY or CC BY-NC). Facts from First
        Nature, Wild Food UK, Wikipedia and the Woodland Trust, listed on each page.</p>
    </>
  );
}
```
Add `define: { __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)) }` to `vite.config.ts`, and
`declare const __BUILD_DATE__: string;` in a new `src/env.d.ts`.

```tsx
// learn.tsx
import learn from '../../content/learn.json';

type Section = { title: string; points: string[]; sources: Array<{ title: string; url: string }> };

export function Learn() {
  return (
    <>
      <h1>Learn</h1>
      {(learn as Section[]).map((sec) => (
        <div class="card" key={sec.title}>
          <h2>{sec.title}</h2>
          <ul>{sec.points.map((p) => <li key={p}>{p}</li>)}</ul>
          <p class="muted">Sources: {sec.sources.map((s, i) => <span key={s.url}>{i ? ', ' : ''}<a href={s.url}>{s.title}</a></span>)}</p>
        </div>
      ))}
    </>
  );
}
```
Placeholder `content/learn.json` (filled in Task 7): `[]`.

- [ ] **Step 5: Replace `src/app.tsx`**

```tsx
import { useEffect, useState } from 'preact/hooks';
import { parseHash, hrefFor, type Route } from './router';
import { Guide } from './screens/guide';
import { SpeciesPage } from './screens/species-page';
import { Learn } from './screens/learn';
import { About } from './screens/about';
import { ComingSoon } from './screens/coming-soon';

const TABS = [
  { name: 'scan', label: 'Scan' },
  { name: 'guide', label: 'Guide' },
  { name: 'identify', label: 'Identify' },
  { name: 'finds', label: 'Finds' },
  { name: 'learn', label: 'Learn' },
] as const;

function screen(route: Route) {
  switch (route.name) {
    case 'guide': return <Guide query={route.query} />;
    case 'species': return <SpeciesPage slug={route.slug} />;
    case 'learn': return <Learn />;
    case 'about': return <About />;
    case 'scan': return <ComingSoon title="Scan" what="The photo scan" />;
    case 'identify': return <ComingSoon title="Identify" what="Identifying by questions" />;
    case 'finds': return <ComingSoon title="Finds" what="Your map of finds" />;
    default: return <><h1>Not found</h1><p><a href="#/guide">Open the guide</a></p></>;
  }
}

export function App() {
  const [route, setRoute] = useState<Route>(() => parseHash(location.hash));
  useEffect(() => {
    const onHash = () => { setRoute(parseHash(location.hash)); window.scrollTo(0, 0); };
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);
  const active = route.name === 'species' ? 'guide' : route.name;
  return (
    <div class="shell">
      <div class="test-banner" role="note">Test version — not for identifying mushrooms</div>
      <main>{screen(route)}</main>
      <nav class="tabs" aria-label="Sections">
        {TABS.map((t) => (
          <a key={t.name} href={hrefFor(t.name === 'guide' ? { name: 'guide', query: '' } : { name: t.name })}
            aria-current={active === t.name ? 'page' : undefined}>{t.label}</a>
        ))}
      </nav>
      <p class="muted" style="text-align:center;font-size:12px"><a href="#/about">About</a></p>
    </div>
  );
}
```

- [ ] **Step 6: Build and type-check**

Run: `npm run typecheck && npm run build`
Expected: exit 0. With no species records yet the guide shows "0 of 0 species", which is fine until Task 6.

- [ ] **Step 7: Commit**

```bash
git add src content/learn.json vite.config.ts
git commit -m "feat(app): guide, species page (sources on every fact), learn, about and coming-soon screens"
```

---

### Task 6: The ten sample species (content work)

**Files:** create `content/species/<slug>.json` ×10, `tools/check-content.ts`, `reports/sample-pages-cross-check.md`.

The ten are chosen so that the lookalike links show off the Check idea:

| Slug | Species | Kind |
|---|---|---|
| `field-mushroom` | Agaricus campestris | edible |
| `horse-mushroom` | Agaricus arvensis | edible |
| `yellow-stainer` | Agaricus xanthodermus | poisonous |
| `destroying-angel` | Amanita virosa | deadly |
| `deathcap` | Amanita phalloides | deadly |
| `chanterelle` | Cantharellus cibarius | edible |
| `false-chanterelle` | Hygrophoropsis aurantiaca | poisonous |
| `deadly-webcap` | Cortinarius rubellus | deadly |
| `parasol` | Macrolepiota procera | edible |
| `deadly-dapperling` | Lepiota brunneoincarnata | deadly |

- [ ] **Step 1: `tools/check-content.ts`**

```ts
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { checkRecords } from './lib/species-record.ts';
import type { SpeciesRecord } from '../src/types.ts';

const ROOT = new URL('../', import.meta.url);
const hosts = (JSON.parse(readFileSync(new URL('tools/config/core-lists.json', ROOT), 'utf8')) as { allowedSourceHosts: string[] }).allowedSourceHosts;
const approved = new Set((JSON.parse(readFileSync(new URL('content/species-list.json', ROOT), 'utf8')) as { species: Array<{ name: string }> }).species.map((s) => s.name));
const files = readdirSync(new URL('content/species/', ROOT)).filter((f) => f.endsWith('.json'));
const records = files.map((f) => JSON.parse(readFileSync(new URL(`content/species/${f}`, ROOT), 'utf8')) as SpeciesRecord);
const problems = checkRecords(records, hosts);
for (const r of records) {
  if (!approved.has(r.scientific)) problems.push(`${r.slug}: ${r.scientific} is not on the approved species list`);
  for (const p of r.photos) if (!existsSync(new URL(`public/${p.file}`, ROOT))) problems.push(`${r.slug}: photo file ${p.file} is missing`);
}
console.log(`${records.length} species pages`);
if (problems.length) { for (const p of problems) console.log(`  - ${p}`); process.exit(1); }
console.log('0 problems');
```

- [ ] **Step 2: Gather the facts for each species**

For each of the ten, read the full species pages: First Nature (the Cap, Gills, Stem, Habitat, Season, Spore print,
Odour/taste and Similar species sections), Wild Food UK (Cap, Gills, Stem, Skirt, Flesh, Habitat, Possible Confusion,
Spore Print, Taste/Smell), Wikipedia (Description, Similar species, Toxicity/Edibility) and the Woodland Trust where it
has a page. Use the scratchpad readers from stage 1 (`extract2.py`, `sentences.py`), which check certificates against
`/etc/ssl/cert.pem`. Count only article text, never reader comments.

- [ ] **Step 3: Write each record**

Write each record in our own words, following `src/types.ts` exactly, with every fact listing the source ids that
state it:
- **Edibility:** one of the five values. `edible-cooked` unless two sources say "some people react", then
  `edible-some-react`.
- **Top points:** 3 to 6 short lines, each one a feature a forager can check (colour, gills, ring, base, smell,
  bruising).
- **Lookalikes:** every pair from `tools/config/core-lists.json` for this species, both ways. Each gets 2 to 4
  "tell them apart" rows built from the features the sources compare (gill colour, base, smell, staining, habitat,
  spore print). `slug` is set when the lookalike is one of the ten.
- **Features:** read from the descriptions.
- **Season:** the months the sources give.
- **`checked`:** today's date.
- **`photos`:** `[]`. Task 6 step 5 fills them.

- [ ] **Step 4: Cross-check (Stefan's rule, spec 5.3)**

For every safety fact (edibility, every top point, every "tell them apart" row), check the other large sources:
Wikipedia, the Woodland Trust where it has a page, and the third main site where only two were used. Majority decides;
a tie takes the cautious answer. Write `reports/sample-pages-cross-check.md` with one line per disagreement and what was
decided ("none" when all agree).

- [ ] **Step 5: Photos, then the checks**

Run: `npm run fetch-photos`
Expected: `<slug>: 4 photos` for each of the ten (fewer is acceptable if iNaturalist has fewer open-licence UK
photos; the checker needs at least one).

Run: `npm run check-content`
Expected: `10 species pages` then `0 problems`. Fix what it names and run it again until it is clean.

- [ ] **Step 6: Commit**

```bash
git add content/species tools/check-content.ts reports/sample-pages-cross-check.md public/photos
git commit -m "content: ten sample species pages (two sources per fact, cross-checked, credited photos)"
```

---

### Task 7: The Learn page

**Files:** modify `content/learn.json`.

- [ ] **Step 1: Write four sections, each with its sources (two websites at least)**

1. **Before you pick anything:** a few rules everyone should follow:
   - be completely sure of what it is;
   - check every feature, never the photo alone;
   - dig up the base of the stem rather than cutting it;
   - keep each species in its own bag;
   - never eat a mushroom on an app's word.
2. **How to take a spore print:** the steps, and why the colour matters.
3. **The deadly families to know in the UK:** Amanitas (bag at the base, white gills), small Lepiota dapperlings,
   webcaps, fibrecaps, small white funnels, and the Funeral Bell.
4. **The rules in the UK:**
   - get the landowner's permission;
   - some species are protected under Schedule 8 of the Wildlife and Countryside Act;
   - check for local byelaws (for example in the New Forest);
   - take only a little, for your own use.

Format: `[{ "title": "...", "points": ["..."], "sources": [{ "title": "...", "url": "..." }] }]`, using the sites on
the allowed list.

- [ ] **Step 2: Build and look**

Run: `npm run build && npm run preview`, then open the Browser pane at `http://localhost:4173/mushrooms/#/learn`.
Expected: four cards with their sources. Stop the preview afterwards.

- [ ] **Step 3: Commit**

```bash
git add content/learn.json
git commit -m "content: the Learn page (before you pick, spore prints, deadly families, UK rules)"
```

---

### Task 8: Browser tests (Safari's engine at iPhone size, and Chromium)

**Files:** create `e2e/server.ts`, `e2e/app.spec.ts`, `playwright.config.ts`.

- [ ] **Step 1: Install the browsers**

Run: `npx playwright install chromium webkit`
Then check that the device exists:
`node -e "const {devices}=require('@playwright/test');console.log(Object.keys(devices).filter(d=>/^iPhone 1[45]/.test(d)))"`.
Expected: the list contains `iPhone 15`. If it does not, use the newest iPhone the list contains, in Step 2.

- [ ] **Step 2: `playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  reporter: 'list',
  projects: [
    { name: 'iphone-safari-engine', use: { ...devices['iPhone 15'] } },
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
```

- [ ] **Step 3: `e2e/server.ts` — a static server the tests can switch off**

```ts
import { createServer, type Server } from 'node:http';
import type { Socket } from 'node:net';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon',
};

export async function startServer(root: string, base = '/mushrooms/') {
  const sockets = new Set<Socket>();
  const server: Server = createServer(async (req, res) => {
    const path = decodeURIComponent((req.url ?? '/').split('?')[0]);
    if (!path.startsWith(base)) { res.writeHead(404).end(); return; }
    let rel = normalize(path.slice(base.length)).replace(/^(\.\.[/\\])+/, '');
    if (rel === '' || rel === '.' || rel.endsWith('/')) rel = join(rel, 'index.html');
    try {
      const body = await readFile(join(root, rel));
      res.writeHead(200, { 'Content-Type': TYPES[extname(rel)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' }).end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  server.on('connection', (s) => { sockets.add(s); s.on('close', () => sockets.delete(s)); });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const { port } = server.address() as { port: number };
  let stopped = false;
  return {
    url: `http://127.0.0.1:${port}${base}`,
    stop: () => new Promise<void>((resolve) => {
      if (stopped) return resolve();
      stopped = true;
      for (const s of sockets) s.destroy();
      server.close(() => resolve());
    }),
  };
}
```

- [ ] **Step 4: `e2e/app.spec.ts`**

```ts
import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { startServer } from './server';

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
  await page.getByRole('link', { name: 'Yellow Stainer' }).click();
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
```

- [ ] **Step 5: Run them**

Run: `npm run build && npm run e2e`
Expected: `10 passed` (5 tests × 2 browsers). If the offline test fails in the Safari engine only, read the error
before changing anything. microsoft/playwright#42775 covers `setOffline` only, and this test does not use it.

- [ ] **Step 6: Commit**

```bash
git add playwright.config.ts e2e
git commit -m "test(e2e): guide, species page, no-'safe' rule and offline, in Safari's engine at iPhone size and Chromium"
```

---

### Task 9: Publish with GitHub Actions

**Files:** create `.github/workflows/publish.yml`.

- [ ] **Step 1: `.github/workflows/publish.yml`**

```yaml
name: Test and publish
on:
  push:
    branches: [main]
  workflow_dispatch: {}
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: false
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      - run: npm run check-content
      - run: npm run build
      - run: npx playwright install --with-deps chromium webkit
      - run: npm run e2e
      - uses: actions/configure-pages@v6
      - uses: actions/upload-pages-artifact@v5
        with:
          path: dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v5
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/publish.yml
git commit -m "ci: test, build, browser-test and publish to GitHub Pages"
```

---

### Task 10: Switch on GitHub Pages (Stefan), merge, and the first install

- [ ] **Step 1: Stefan switches Pages on**

He does this as the owner, guided step by step in chat: **github.com/StefanFriese-bit/mushrooms → Settings → Pages →
Build and deployment → Source: GitHub Actions**. Nothing else changes.

- [ ] **Step 2: Merge and push**

```bash
git checkout main && git merge --ff-only stage2a-test-version && npm test && git push origin main
```
Then watch the run: `gh run list --repo StefanFriese-bit/mushrooms --limit 1` and
`gh run watch <id> --repo StefanFriese-bit/mushrooms`.
Expected: both jobs pass, and `https://stefanfriese-bit.github.io/mushrooms/` answers 200 (`curl -sI`).

- [ ] **Step 3: Install on Stefan's iPhone**

Send him three steps:
1. Open the address in Safari.
2. Tap Share, then **Add to Home Screen**.
3. Open it from the icon once while on Wi-Fi.

Then ask him to switch on Airplane Mode and open it again. That proves the offline mode on the real phone. Record the
stage-2 proofs that apply (spec §14): persistent storage on About, offline after the first load, and what deleting the
icon does (only once he has nothing to lose).

---

## Self-review

- **Spec coverage:** the TEST banner (§8, §9), the Guide with search (§8), species pages with sources on every fact
  (§5.1, §5.3), the Learn page (§8), About with storage state (§7, §8), offline use (§4.3), publishing only after every
  check (§11, §12), the cross-check of the sample pages (§5.3, Stefan's rule), and stage-2 proofs (§14, partly; the
  scan's speed comes with plan 2d).
- **Left for later plans:** Scan and Check (2d), Identify (2c), Finds, the map and backups (2b).
- **Names used across tasks:** `Route`, `parseHash`, `hrefFor`, `EDIBILITY_WORDS`, `KIND_WORDS`, `tagClass`, `loadAll`,
  `searchSpecies`, `bySlug`, `ALL_SPECIES`, `photoUrl`, `checkRecord`, `checkRecords`, `pickPhotos`, `startServer`.
  Each is defined once, in the task named, and used with the same signature.
- **One known trap, handled where it occurs:** `URL.pathname` keeps `%20` (Task 4 step 5), so the code uses
  `fileURLToPath`.
