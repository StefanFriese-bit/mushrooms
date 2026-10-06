# Species List (Stage 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Default for this project:** inline, with superpowers:executing-plans. Stefan's standing rule: helper agents only
> with his OK (they are heavy on his weekly allowance). Task 5 is the one that could be split; ask him first.

**Goal:** Produce the list of about 300 UK species the guide will cover, for Stefan's approval. It is built from UK
iNaturalist records of larger fungi, plus every commonly picked UK edible, each one's dangerous lookalikes, and every
deadly UK species, each confirmed by two independent sources. It carries the British Mycological Society's English
names where they match, and it is delivered to Stefan as a review page.

**Architecture:** TypeScript scripts under `tools/`, run with `tsx` on the Mac, tested with Vitest. Network access
lives in one place (`tools/lib/inat.ts`, a polite iNaturalist client). Every rule (group filter, list validation,
selection, name parsing, page rendering) is a pure function in its own file with its own tests. Outputs are committed:
`content/species-list.json`, `reports/species-list-report.md` and `review/species-list.html`. Downloads go to
`cache/`, which git ignores.

**Tech Stack:** Node 24 (on the Mac: v24.14.0), TypeScript 5, tsx, Vitest, Poppler's `pdftotext`
(`/opt/homebrew/bin/pdftotext`, v26.07.0). No runtime dependencies: Node's built-in `fetch` does the HTTP.

**Spec:** `docs/superpowers/specs/2026-10-06-mushroom-app-design.md`, sections 5.2 and 14 (stage 1).

**Facts this plan stands on (checked 06/10/2026):**
- iNaturalist ids: United Kingdom place `6857`. Classes: Agaricomycetes `50814`, Pezizomycetes `152032`,
  Tremellomycetes `83737`, Dacrymycetes `53277`, Leotiomycetes `55523`. Orders: Xylariales `48805`,
  Hypocreales `48248`, Rhytismatales `125771`. Families: Erysiphaceae `55525` (powdery mildews; there is **no**
  order "Erysiphales" on iNaturalist, because the family sits under Helotiales `49073`), Nectriaceae `118017`,
  Clavicipitaceae `123254`. The scripts resolve these by name at run time and fail if a name stops matching exactly
  one active taxon.
- `GET /v1/observations/species_counts?place_id=6857&taxon_id=…&quality_grade=research&hrank=species&lrank=species&per_page=500&page=N`
  returns `{ total_results, results: [{ count, taxon }] }`. Each `taxon` carries `id`, `name`, `rank`,
  `ancestor_ids`, `preferred_common_name`, `default_photo` (`square_url`, `attribution`, `license_code`) and
  `is_active`. Agaricomycetes alone has 1,482 UK species with research-grade records. Leotiomycetes includes tar spot
  (3,914 records) and powdery mildews; Sordariomycetes includes coral spot and ergot, hence the exclusions.
- iNaturalist's limits: ≤ 60 requests a minute and < 10,000 a day. The client keeps 1.1 s between requests.
- The BMS English names list (2005, 22 pages) is downloadable from
  `https://www.davidmoore.org.uk/assets/fungi4schools/Reprints/ENGLISH_NAMES.pdf`. `pdftotext -raw` turns it into
  lines of `Genus species English Name` between `Current Scientific Latin name Recommended English` and
  `English to Latin names`. Measured on the real file: 1,045 lines in that section — 975 complete pairs, 6 Latin
  names whose English name is on the next line, 64 headers, footnotes and page numbers, and no line with two pairs.
  Ten English names end in a footnote star. Some names differ from iNaturalist's (e.g. `Hericium erinaceum` vs
  `erinaceus`); those fall back to iNaturalist's English name. The BMS's own website answers 403 to scripts.
- First Nature (`https://www.first-nature.com/fungi/<genus>-<species>.php`) and Wild Food UK
  (`https://www.wildfooduk.com/mushroom-guide/<english-name-slug>/`) both load and state edibility and confusions.
  Checked on Agaricus xanthodermus / Yellow Stainer.

All commands run from the project folder:

```bash
cd "/Users/Stefan/Local Desktop/Claude Projects/mushroom-app"
```

---

## File structure

| File | Responsibility |
|---|---|
| `package.json`, `tsconfig.json`, `.gitignore` | Project set-up, scripts, ignore `node_modules/` and `cache/` |
| `tools/lib/inat.ts` | Polite iNaturalist client: spacing, retries, species counts, exact name lookup |
| `tools/lib/groups.ts` | Resolve the include/exclude groups; decide "is this a larger fungus we want" from a taxon's ancestry |
| `tools/config/groups.json` | The groups to include and exclude, by name and rank |
| `tools/lib/core-lists.ts` | The rules a core list must meet (two sources from different allowed websites, every pair consistent) |
| `tools/config/core-lists.json` | Edibles, dangerous species, edible→dangerous pairs, "no dangerous lookalike" entries, each with sources |
| `tools/check-core-lists.ts` | Prints every problem in the core lists; exit 1 if any |
| `tools/check-core-names.ts` | Checks every core name is iNaturalist's current name; suggests the current one when not |
| `tools/lib/select.ts` | Picks the ~300: core species first, Stefan's additions, then the most-recorded; protects dangerous species from removal |
| `tools/lib/bms-names.ts` | Parses the BMS list; picks the English name (BMS, else iNaturalist) |
| `tools/lib/review-page.ts` | Renders the review page Stefan reads |
| `tools/config/list-overrides.json` | Stefan's additions and removals |
| `tools/build-species-list.ts` | Runs it all against the real services and writes the outputs |
| `tools/approve-species-list.ts` | Stamps the list as approved by Stefan |
| `tests/*.test.ts` | One test file per `tools/lib` file |
| `reports/core-lists-research.md` | What the source check changed in the seed lists, and why (our words, no quotes) |

---

### Task 1: Project skeleton and test runner

**Files:**
- Create: `package.json`, `tsconfig.json`, `.gitignore`, `tests/smoke.test.ts`

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "mushrooms",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "check-core-lists": "tsx tools/check-core-lists.ts",
    "check-core-names": "tsx tools/check-core-names.ts",
    "species-list": "tsx tools/build-species-list.ts",
    "approve-species-list": "tsx tools/approve-species-list.ts"
  }
}
```

- [ ] **Step 2: Install the tools**

Run: `npm install --save-dev typescript tsx vitest @types/node`
Expected: `added N packages`, a `package-lock.json`, and `devDependencies` in `package.json`.

- [ ] **Step 3: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "strict": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["tools", "tests"]
}
```

- [ ] **Step 4: Write `.gitignore`**

```
node_modules/
cache/
.DS_Store
```

- [ ] **Step 5: Write a smoke test**

`tests/smoke.test.ts`:

```ts
import { expect, it } from 'vitest';

it('runs tests', () => {
  expect(1 + 1).toBe(2);
});
```

- [ ] **Step 6: Run the tests and the type check**

Run: `npm test && npm run typecheck`
Expected: `1 passed`, then no output from `tsc` (exit 0).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json .gitignore tests/smoke.test.ts
git commit -m "chore: project skeleton with TypeScript, tsx and Vitest"
```

---

### Task 2: The iNaturalist client

**Files:**
- Create: `tools/lib/inat.ts`
- Test: `tests/inat.test.ts`

- [ ] **Step 1: Write the failing tests**

`tests/inat.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createInatClient, type HttpResponse } from '../tools/lib/inat.ts';

function fakeHttp(responses: Array<{ status: number; body?: unknown }>) {
  const calls: string[] = [];
  const fetch = async (url: string): Promise<HttpResponse> => {
    calls.push(url);
    const next = responses.shift();
    if (!next) throw new Error('no more fake responses');
    return { ok: next.status >= 200 && next.status < 300, status: next.status, json: async () => next.body };
  };
  return { fetch, calls };
}

function fakeClock() {
  let t = 0;
  const sleeps: number[] = [];
  return {
    now: () => t,
    sleep: async (ms: number) => {
      sleeps.push(ms);
      t += ms;
    },
    sleeps,
  };
}

const ok = (body: unknown) => ({ status: 200, body });

describe('inat client', () => {
  it('keeps requests at least minGapMs apart', async () => {
    const http = fakeHttp([ok({}), ok({})]);
    const clock = fakeClock();
    const client = createInatClient({ fetch: http.fetch, now: clock.now, sleep: clock.sleep, minGapMs: 1100 });
    await client.getJson('/a');
    await client.getJson('/b');
    expect(clock.sleeps).toEqual([1100]);
  });

  it('retries a 429 after a back-off, then succeeds', async () => {
    const http = fakeHttp([{ status: 429 }, ok({ fine: true })]);
    const clock = fakeClock();
    const client = createInatClient({ fetch: http.fetch, now: clock.now, sleep: clock.sleep, minGapMs: 1100 });
    await expect(client.getJson('/a')).resolves.toEqual({ fine: true });
    expect(http.calls).toHaveLength(2);
    expect(clock.sleeps).toEqual([4400]);
  });

  it('does not retry a 404', async () => {
    const http = fakeHttp([{ status: 404 }]);
    const clock = fakeClock();
    const client = createInatClient({ fetch: http.fetch, now: clock.now, sleep: clock.sleep });
    await expect(client.getJson('/a')).rejects.toThrow(/HTTP 404/);
    expect(http.calls).toHaveLength(1);
  });

  it('gives up after maxTries server errors', async () => {
    const http = fakeHttp([{ status: 500 }, { status: 502 }, { status: 503 }, { status: 500 }]);
    const clock = fakeClock();
    const client = createInatClient({ fetch: http.fetch, now: clock.now, sleep: clock.sleep, minGapMs: 1100, maxTries: 4 });
    await expect(client.getJson('/a')).rejects.toThrow(/attempt 4 of 4/);
    expect(clock.sleeps).toEqual([4400, 8800, 17600]);
  });

  it('pages through species counts until total_results is reached', async () => {
    const t = (id: number) => ({ id, name: `Genus s${id}`, rank: 'species', ancestor_ids: [1, id] });
    const http = fakeHttp([
      ok({ total_results: 3, results: [{ count: 9, taxon: t(1) }, { count: 8, taxon: t(2) }] }),
      ok({ total_results: 3, results: [{ count: 7, taxon: t(3) }] }),
    ]);
    const clock = fakeClock();
    const client = createInatClient({ fetch: http.fetch, now: clock.now, sleep: clock.sleep });
    const counts = await client.speciesCounts(6857, 50814);
    expect(counts.map((c) => c.taxon.id)).toEqual([1, 2, 3]);
    expect(http.calls[0]).toContain('place_id=6857');
    expect(http.calls[0]).toContain('taxon_id=50814');
    expect(http.calls[0]).toContain('quality_grade=research');
    expect(http.calls[0]).toContain('hrank=species');
    expect(http.calls[0]).toContain('page=1');
    expect(http.calls[1]).toContain('page=2');
  });

  it('resolves a name to exactly one active taxon of that rank', async () => {
    const http = fakeHttp([
      ok({
        results: [
          { id: 1, name: 'Xylariales', rank: 'order', ancestor_ids: [], is_active: true },
          { id: 2, name: 'Xylariales', rank: 'order', ancestor_ids: [], is_active: false },
          { id: 3, name: 'Xylariaceae', rank: 'family', ancestor_ids: [], is_active: true },
        ],
      }),
    ]);
    const clock = fakeClock();
    const client = createInatClient({ fetch: http.fetch, now: clock.now, sleep: clock.sleep });
    await expect(client.resolveTaxon('Xylariales', 'order')).resolves.toMatchObject({ id: 1 });
  });

  it('refuses a name that matches no taxon, or two', async () => {
    const two = { id: 1, name: 'A b', rank: 'species', ancestor_ids: [], is_active: true };
    const http = fakeHttp([ok({ results: [] }), ok({ results: [two, { ...two, id: 2 }] })]);
    const clock = fakeClock();
    const client = createInatClient({ fetch: http.fetch, now: clock.now, sleep: clock.sleep });
    await expect(client.resolveTaxon('A b', 'species')).rejects.toThrow(/found 0/);
    await expect(client.resolveTaxon('A b', 'species')).rejects.toThrow(/found 2/);
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run tests/inat.test.ts`
Expected: FAIL — cannot find module `../tools/lib/inat.ts`.

- [ ] **Step 3: Write `tools/lib/inat.ts`**

```ts
// A polite client for iNaturalist's public API: one request at a time, at least minGapMs apart, retries only
// on 429 and 5xx. iNaturalist asks for <= 60 requests a minute and < 10,000 a day.
export const API = 'https://api.inaturalist.org/v1';
export const USER_AGENT =
  'mushrooms content builder (personal, non-commercial; https://github.com/StefanFriese-bit/mushrooms)';

export type InatTaxon = {
  id: number;
  name: string;
  rank: string;
  ancestor_ids: number[];
  is_active?: boolean;
  preferred_common_name?: string | null;
  default_photo?: { square_url?: string | null; attribution?: string | null; license_code?: string | null } | null;
};

export type SpeciesCount = { count: number; taxon: InatTaxon };

export type HttpResponse = { ok: boolean; status: number; json(): Promise<unknown> };
export type FetchLike = (url: string, init: { headers: Record<string, string> }) => Promise<HttpResponse>;

export type InatClientOptions = {
  fetch?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  minGapMs?: number;
  maxTries?: number;
};

export type InatClient = ReturnType<typeof createInatClient>;

export function createInatClient(opts: InatClientOptions = {}) {
  const doFetch: FetchLike = opts.fetch ?? ((url, init) => fetch(url, init));
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const now = opts.now ?? (() => Date.now());
  const minGapMs = opts.minGapMs ?? 1100;
  const maxTries = opts.maxTries ?? 4;
  let lastStart = Number.NEGATIVE_INFINITY;

  async function getJson(path: string): Promise<any> {
    const url = `${API}${path}`;
    for (let attempt = 1; ; attempt++) {
      const wait = lastStart + minGapMs - now();
      if (wait > 0) await sleep(wait);
      lastStart = now();
      const res = await doFetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
      if (res.ok) return res.json();
      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable || attempt >= maxTries) {
        throw new Error(`iNaturalist answered HTTP ${res.status} for ${url} (attempt ${attempt} of ${maxTries})`);
      }
      await sleep(minGapMs * 4 * 2 ** (attempt - 1));
    }
  }

  async function speciesCounts(placeId: number, taxonId: number): Promise<SpeciesCount[]> {
    const all: SpeciesCount[] = [];
    for (let page = 1; page <= 20; page++) {
      const q = new URLSearchParams({
        place_id: String(placeId),
        taxon_id: String(taxonId),
        quality_grade: 'research',
        hrank: 'species',
        lrank: 'species',
        per_page: '500',
        page: String(page),
      });
      const body = await getJson(`/observations/species_counts?${q}`);
      const results: SpeciesCount[] = body.results ?? [];
      all.push(...results);
      if (results.length === 0 || all.length >= (body.total_results ?? 0)) return all;
    }
    throw new Error(`More than 20 pages of species for taxon ${taxonId}; check the query`);
  }

  async function resolveTaxon(name: string, rank: string): Promise<InatTaxon> {
    const q = new URLSearchParams({ q: name, rank, per_page: '30' });
    const body = await getJson(`/taxa?${q}`);
    const exact = (body.results ?? []).filter(
      (t: InatTaxon) => t.name === name && t.rank === rank && t.is_active !== false,
    );
    if (exact.length !== 1) {
      throw new Error(`Expected one active ${rank} called "${name}" on iNaturalist, found ${exact.length}`);
    }
    return exact[0];
  }

  return { getJson, speciesCounts, resolveTaxon };
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run tests/inat.test.ts && npm run typecheck`
Expected: `7 passed`; `tsc` exit 0.

- [ ] **Step 5: Commit**

```bash
git add tools/lib/inat.ts tests/inat.test.ts
git commit -m "feat: polite iNaturalist client (spacing, retries, species counts, exact name lookup)"
```

---

### Task 3: Which fungi count as "larger fungi"

**Files:**
- Create: `tools/lib/groups.ts`, `tools/config/groups.json`
- Test: `tests/groups.test.ts`

- [ ] **Step 1: Write the failing tests**

`tests/groups.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { makeGroupFilter, resolveGroups } from '../tools/lib/groups.ts';

const groups = {
  include: [{ name: 'Classy', rank: 'class', id: 10 }],
  exclude: [{ name: 'Mildewy', rank: 'family', id: 20, why: 'powdery mildews' }],
};

describe('group filter', () => {
  const keep = makeGroupFilter(groups);
  it('keeps a species under an included group', () => {
    expect(keep({ id: 99, ancestor_ids: [1, 10, 25, 99] })).toBe(true);
  });
  it('drops a species under an excluded group, even inside an included one', () => {
    expect(keep({ id: 98, ancestor_ids: [1, 10, 20, 98] })).toBe(false);
  });
  it('drops a species under no included group', () => {
    expect(keep({ id: 97, ancestor_ids: [1, 11, 97] })).toBe(false);
  });
  it('counts the taxon itself as part of its lineage', () => {
    expect(keep({ id: 10, ancestor_ids: [1] })).toBe(true);
  });
});

describe('resolveGroups', () => {
  it('looks every group up by name and rank, in order', async () => {
    const asked: string[] = [];
    const resolved = await resolveGroups(
      { placeId: 6857, include: [{ name: 'A', rank: 'class' }], exclude: [{ name: 'B', rank: 'order', why: 'x' }] },
      async (name, rank) => {
        asked.push(`${rank}:${name}`);
        return { id: name === 'A' ? 1 : 2, name, rank, ancestor_ids: [] };
      },
    );
    expect(asked).toEqual(['class:A', 'order:B']);
    expect(resolved.include[0]).toMatchObject({ name: 'A', id: 1 });
    expect(resolved.exclude[0]).toMatchObject({ name: 'B', id: 2, why: 'x' });
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run tests/groups.test.ts`
Expected: FAIL — cannot find module `../tools/lib/groups.ts`.

- [ ] **Step 3: Write `tools/lib/groups.ts`**

```ts
import type { InatTaxon } from './inat.ts';

export type GroupRef = { name: string; rank: string; why?: string };
export type GroupsConfig = { placeId: number; include: GroupRef[]; exclude: GroupRef[] };
export type ResolvedGroup = GroupRef & { id: number };
export type ResolvedGroups = { include: ResolvedGroup[]; exclude: ResolvedGroup[] };

export async function resolveGroups(
  cfg: GroupsConfig,
  resolveTaxon: (name: string, rank: string) => Promise<InatTaxon>,
): Promise<ResolvedGroups> {
  const include: ResolvedGroup[] = [];
  for (const g of cfg.include) include.push({ ...g, id: (await resolveTaxon(g.name, g.rank)).id });
  const exclude: ResolvedGroup[] = [];
  for (const g of cfg.exclude) exclude.push({ ...g, id: (await resolveTaxon(g.name, g.rank)).id });
  return { include, exclude };
}

/** True when the taxon sits under an included group and under no excluded group. */
export function makeGroupFilter(groups: ResolvedGroups) {
  const inc = new Set(groups.include.map((g) => g.id));
  const exc = new Set(groups.exclude.map((g) => g.id));
  return (taxon: Pick<InatTaxon, 'id' | 'ancestor_ids'>): boolean => {
    const lineage = [...taxon.ancestor_ids, taxon.id];
    if (lineage.some((id) => exc.has(id))) return false;
    return lineage.some((id) => inc.has(id));
  };
}
```

- [ ] **Step 4: Write `tools/config/groups.json`**

```json
{
  "placeId": 6857,
  "include": [
    { "name": "Agaricomycetes", "rank": "class" },
    { "name": "Pezizomycetes", "rank": "class" },
    { "name": "Tremellomycetes", "rank": "class" },
    { "name": "Dacrymycetes", "rank": "class" },
    { "name": "Leotiomycetes", "rank": "class" },
    { "name": "Xylariales", "rank": "order" },
    { "name": "Hypocreales", "rank": "order" }
  ],
  "exclude": [
    { "name": "Erysiphaceae", "rank": "family", "why": "powdery mildews" },
    { "name": "Rhytismatales", "rank": "order", "why": "tar spots" },
    { "name": "Nectriaceae", "rank": "family", "why": "coral spot and other small pustules on plants" },
    { "name": "Clavicipitaceae", "rank": "family", "why": "ergot" }
  ]
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `npx vitest run tests/groups.test.ts && npm run typecheck`
Expected: `5 passed`; `tsc` exit 0.

- [ ] **Step 6: Commit**

```bash
git add tools/lib/groups.ts tools/config/groups.json tests/groups.test.ts
git commit -m "feat: larger-fungi group filter (include classes/orders, exclude mildews, tar spot, coral spot, ergot)"
```

---

### Task 4: The core lists — rules, seed and check commands

**Files:**
- Create: `tools/lib/core-lists.ts`, `tools/config/core-lists.json`, `tools/check-core-lists.ts`, `tools/check-core-names.ts`
- Test: `tests/core-lists.test.ts`

- [ ] **Step 1: Write the failing tests**

`tests/core-lists.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { hostOf, validateCoreLists, type CoreLists } from '../tools/lib/core-lists.ts';

const FN = 'https://www.first-nature.com/fungi/x.php';
const WF = 'https://www.wildfooduk.com/mushroom-guide/x/';
const two = [FN, WF];

function valid(): CoreLists {
  return {
    allowedSourceHosts: ['first-nature.com', 'wildfooduk.com', 'en.wikipedia.org'],
    edibles: [
      { name: 'Agaricus campestris', sources: two },
      { name: 'Hydnum repandum', sources: two },
    ],
    dangerous: [
      { name: 'Agaricus xanthodermus', level: 'poisonous', sources: two },
      { name: 'Cortinarius rubellus', level: 'deadly', sources: two },
    ],
    pairs: [{ edible: 'Agaricus campestris', dangerous: 'Agaricus xanthodermus', sources: two }],
    noDangerousLookalike: [{ edible: 'Hydnum repandum', sources: two }],
  };
}

describe('validateCoreLists', () => {
  it('accepts a consistent, sourced list', () => {
    expect(validateCoreLists(valid())).toEqual([]);
  });

  it('needs two sources from two different allowed websites', () => {
    const c = valid();
    c.edibles[0].sources = [FN, 'https://first-nature.com/fungi/y.php'];
    expect(validateCoreLists(c)).toContain('edible "Agaricus campestris": needs two sources from different websites (has 1)');
  });

  it('refuses a source website that is not on the allowed list', () => {
    const c = valid();
    c.dangerous[0].sources = [FN, 'https://example.com/a'];
    const problems = validateCoreLists(c);
    expect(problems).toContain('dangerous "Agaricus xanthodermus": example.com is not on the allowed source list');
  });

  it('refuses a name that is not "Genus species"', () => {
    const c = valid();
    c.edibles[1].name = 'hydnum';
    expect(validateCoreLists(c).some((p) => p.includes('not a "Genus species" name'))).toBe(true);
  });

  it('refuses a pair whose species are not in the lists', () => {
    const c = valid();
    c.pairs.push({ edible: 'Boletus edulis', dangerous: 'Rubroboletus satanas', sources: two });
    const problems = validateCoreLists(c);
    expect(problems).toContain('pair "Boletus edulis" / "Rubroboletus satanas": "Boletus edulis" is not in the edible list');
    expect(problems).toContain('pair "Boletus edulis" / "Rubroboletus satanas": "Rubroboletus satanas" is not in the dangerous list');
  });

  it('requires every edible to name its lookalikes or be marked as having none', () => {
    const c = valid();
    c.noDangerousLookalike = [];
    expect(validateCoreLists(c)).toContain(
      'edible "Hydnum repandum": name its dangerous lookalikes, or mark it as having none (with two sources)',
    );
  });

  it('refuses an edible that has lookalikes and is also marked as having none', () => {
    const c = valid();
    c.noDangerousLookalike.push({ edible: 'Agaricus campestris', sources: two });
    expect(validateCoreLists(c)).toContain('edible "Agaricus campestris": has lookalikes AND is marked as having none');
  });

  it('allows a poisonous species only as somebody\'s lookalike; a deadly one always', () => {
    const c = valid();
    c.pairs = [];
    c.noDangerousLookalike.push({ edible: 'Agaricus campestris', sources: two });
    const problems = validateCoreLists(c);
    expect(problems).toContain(
      'dangerous "Agaricus xanthodermus": a poisonous species belongs here only as a lookalike of an edible one',
    );
    expect(problems.some((p) => p.includes('Cortinarius rubellus'))).toBe(false);
  });

  it('refuses a species in both the edible and the dangerous list', () => {
    const c = valid();
    c.dangerous.push({ name: 'Agaricus campestris', level: 'poisonous', sources: two });
    expect(validateCoreLists(c)).toContain('"Agaricus campestris" is in both the edible and the dangerous list');
  });

  it('reads hosts without www', () => {
    expect(hostOf('https://www.wildfooduk.com/a/')).toBe('wildfooduk.com');
    expect(hostOf('not a url')).toBe(null);
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run tests/core-lists.test.ts`
Expected: FAIL — cannot find module `../tools/lib/core-lists.ts`.

- [ ] **Step 3: Write `tools/lib/core-lists.ts`**

```ts
export type DangerLevel = 'deadly' | 'poisonous';
type Sourced = { sources: string[] };

export type CoreLists = {
  allowedSourceHosts: string[];
  edibles: Array<{ name: string } & Sourced>;
  dangerous: Array<{ name: string; level: DangerLevel } & Sourced>;
  pairs: Array<{ edible: string; dangerous: string } & Sourced>;
  noDangerousLookalike: Array<{ edible: string } & Sourced>;
};

const BINOMIAL = /^[A-Z][a-z]+ [a-z][a-z-]+$/;

export function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/** Every problem, in words. An empty list means the lists may be used. */
export function validateCoreLists(c: CoreLists): string[] {
  const problems: string[] = [];
  const allowed = new Set(c.allowedSourceHosts.map((h) => h.replace(/^www\./, '')));

  const checkSources = (what: string, sources: string[]) => {
    const hosts = new Set<string>();
    for (const s of sources) {
      const h = hostOf(s);
      if (!h) problems.push(`${what}: "${s}" is not a web address`);
      else if (!allowed.has(h)) problems.push(`${what}: ${h} is not on the allowed source list`);
      else hosts.add(h);
    }
    if (hosts.size < 2) problems.push(`${what}: needs two sources from different websites (has ${hosts.size})`);
  };

  const namesOf = (list: Array<{ name: string }>, label: string) => {
    const seen = new Set<string>();
    for (const e of list) {
      if (!BINOMIAL.test(e.name)) problems.push(`${label} "${e.name}": not a "Genus species" name`);
      if (seen.has(e.name)) problems.push(`${label} "${e.name}": listed twice`);
      seen.add(e.name);
    }
    return seen;
  };

  const edibles = namesOf(c.edibles, 'edible');
  const dangerous = namesOf(c.dangerous, 'dangerous');
  for (const n of edibles) if (dangerous.has(n)) problems.push(`"${n}" is in both the edible and the dangerous list`);

  for (const e of c.edibles) checkSources(`edible "${e.name}"`, e.sources);
  for (const d of c.dangerous) {
    if (d.level !== 'deadly' && d.level !== 'poisonous') {
      problems.push(`dangerous "${d.name}": level must be deadly or poisonous`);
    }
    checkSources(`dangerous "${d.name}"`, d.sources);
  }

  const pairKeys = new Set<string>();
  for (const p of c.pairs) {
    const what = `pair "${p.edible}" / "${p.dangerous}"`;
    if (!edibles.has(p.edible)) problems.push(`${what}: "${p.edible}" is not in the edible list`);
    if (!dangerous.has(p.dangerous)) problems.push(`${what}: "${p.dangerous}" is not in the dangerous list`);
    const key = `${p.edible}|${p.dangerous}`;
    if (pairKeys.has(key)) problems.push(`${what}: listed twice`);
    pairKeys.add(key);
    checkSources(what, p.sources);
  }

  const noLookalike = new Set<string>();
  for (const n of c.noDangerousLookalike) {
    const what = `no-dangerous-lookalike "${n.edible}"`;
    if (!edibles.has(n.edible)) problems.push(`${what}: not in the edible list`);
    noLookalike.add(n.edible);
    checkSources(what, n.sources);
  }

  const edibleInAPair = new Set(c.pairs.map((p) => p.edible));
  const dangerousInAPair = new Set(c.pairs.map((p) => p.dangerous));
  for (const e of c.edibles) {
    if (edibleInAPair.has(e.name) && noLookalike.has(e.name)) {
      problems.push(`edible "${e.name}": has lookalikes AND is marked as having none`);
    }
    if (!edibleInAPair.has(e.name) && !noLookalike.has(e.name)) {
      problems.push(`edible "${e.name}": name its dangerous lookalikes, or mark it as having none (with two sources)`);
    }
  }
  for (const d of c.dangerous) {
    if (d.level === 'poisonous' && !dangerousInAPair.has(d.name)) {
      problems.push(`dangerous "${d.name}": a poisonous species belongs here only as a lookalike of an edible one`);
    }
  }
  return problems;
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run tests/core-lists.test.ts && npm run typecheck`
Expected: `10 passed`; `tsc` exit 0.

- [ ] **Step 5: Write `tools/check-core-lists.ts`**

```ts
import { readFileSync } from 'node:fs';
import { validateCoreLists, type CoreLists } from './lib/core-lists.ts';

const lists = JSON.parse(readFileSync(new URL('./config/core-lists.json', import.meta.url), 'utf8')) as CoreLists;
const problems = validateCoreLists(lists);
console.log(
  `${lists.edibles.length} edible, ${lists.dangerous.length} dangerous, ${lists.pairs.length} pairs, ` +
    `${lists.noDangerousLookalike.length} with no dangerous lookalike`,
);
if (problems.length > 0) {
  console.log(`${problems.length} problem(s):`);
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
console.log('0 problems');
```

- [ ] **Step 6: Write `tools/check-core-names.ts`**

```ts
import { readFileSync } from 'node:fs';
import { createInatClient } from './lib/inat.ts';
import type { CoreLists } from './lib/core-lists.ts';

const lists = JSON.parse(readFileSync(new URL('./config/core-lists.json', import.meta.url), 'utf8')) as CoreLists;
const names = [...new Set([...lists.edibles.map((e) => e.name), ...lists.dangerous.map((d) => d.name)])];
const inat = createInatClient();
let notCurrent = 0;
for (const name of names) {
  try {
    await inat.resolveTaxon(name, 'species');
  } catch {
    notCurrent++;
    const q = new URLSearchParams({ q: name, per_page: '3' });
    const body = await inat.getJson(`/taxa?${q}`);
    const top = (body.results ?? [])[0];
    console.log(
      `NOT CURRENT: ${name} -> iNaturalist suggests "${top?.name ?? '(nothing)'}" ` +
        `(${top?.rank ?? '-'}, matched "${top?.matched_term ?? '-'}")`,
    );
  }
}
console.log(`${names.length - notCurrent} of ${names.length} names are iNaturalist's current names`);
process.exit(notCurrent > 0 ? 1 : 0);
```

- [ ] **Step 7: Write the seed `tools/config/core-lists.json`**

This seed is a starting point from general knowledge. **Nothing in it is a fact until Task 5 gives it two sources.**
Every `sources` list starts empty, so `npm run check-core-lists` fails until Task 5 is done.

```json
{
  "allowedSourceHosts": [
    "first-nature.com",
    "wildfooduk.com",
    "en.wikipedia.org",
    "kew.org",
    "woodlandtrust.org.uk",
    "nhm.ac.uk",
    "plantlife.org.uk"
  ],
  "edibles": [
    { "name": "Agaricus campestris", "sources": [] },
    { "name": "Agaricus arvensis", "sources": [] },
    { "name": "Agaricus silvicola", "sources": [] },
    { "name": "Agaricus augustus", "sources": [] },
    { "name": "Macrolepiota procera", "sources": [] },
    { "name": "Chlorophyllum rhacodes", "sources": [] },
    { "name": "Coprinus comatus", "sources": [] },
    { "name": "Calvatia gigantea", "sources": [] },
    { "name": "Lycoperdon perlatum", "sources": [] },
    { "name": "Cantharellus cibarius", "sources": [] },
    { "name": "Craterellus cornucopioides", "sources": [] },
    { "name": "Craterellus tubaeformis", "sources": [] },
    { "name": "Hydnum repandum", "sources": [] },
    { "name": "Hydnum rufescens", "sources": [] },
    { "name": "Boletus edulis", "sources": [] },
    { "name": "Imleria badia", "sources": [] },
    { "name": "Leccinum scabrum", "sources": [] },
    { "name": "Leccinum versipelle", "sources": [] },
    { "name": "Suillus luteus", "sources": [] },
    { "name": "Suillus grevillei", "sources": [] },
    { "name": "Laetiporus sulphureus", "sources": [] },
    { "name": "Fistulina hepatica", "sources": [] },
    { "name": "Grifola frondosa", "sources": [] },
    { "name": "Sparassis crispa", "sources": [] },
    { "name": "Pleurotus ostreatus", "sources": [] },
    { "name": "Pleurotus pulmonarius", "sources": [] },
    { "name": "Flammulina velutipes", "sources": [] },
    { "name": "Lepista nuda", "sources": [] },
    { "name": "Lepista personata", "sources": [] },
    { "name": "Calocybe gambosa", "sources": [] },
    { "name": "Marasmius oreades", "sources": [] },
    { "name": "Laccaria amethystina", "sources": [] },
    { "name": "Laccaria laccata", "sources": [] },
    { "name": "Auricularia auricula-judae", "sources": [] },
    { "name": "Morchella esculenta", "sources": [] },
    { "name": "Russula cyanoxantha", "sources": [] },
    { "name": "Lactarius deliciosus", "sources": [] },
    { "name": "Cortinarius caperatus", "sources": [] },
    { "name": "Amanita rubescens", "sources": [] },
    { "name": "Polyporus squamosus", "sources": [] },
    { "name": "Armillaria mellea", "sources": [] },
    { "name": "Kuehneromyces mutabilis", "sources": [] },
    { "name": "Clitopilus prunulus", "sources": [] },
    { "name": "Hericium erinaceus", "sources": [] }
  ],
  "dangerous": [
    { "name": "Amanita phalloides", "level": "deadly", "sources": [] },
    { "name": "Amanita virosa", "level": "deadly", "sources": [] },
    { "name": "Amanita pantherina", "level": "poisonous", "sources": [] },
    { "name": "Galerina marginata", "level": "deadly", "sources": [] },
    { "name": "Lepiota brunneoincarnata", "level": "deadly", "sources": [] },
    { "name": "Lepiota subincarnata", "level": "deadly", "sources": [] },
    { "name": "Cortinarius rubellus", "level": "deadly", "sources": [] },
    { "name": "Cortinarius orellanus", "level": "deadly", "sources": [] },
    { "name": "Inocybe erubescens", "level": "deadly", "sources": [] },
    { "name": "Clitocybe rivulosa", "level": "deadly", "sources": [] },
    { "name": "Clitocybe dealbata", "level": "poisonous", "sources": [] },
    { "name": "Gyromitra esculenta", "level": "deadly", "sources": [] },
    { "name": "Paxillus involutus", "level": "deadly", "sources": [] },
    { "name": "Pholiotina rugosa", "level": "deadly", "sources": [] },
    { "name": "Agaricus xanthodermus", "level": "poisonous", "sources": [] },
    { "name": "Entoloma sinuatum", "level": "poisonous", "sources": [] },
    { "name": "Hypholoma fasciculare", "level": "poisonous", "sources": [] },
    { "name": "Omphalotus illudens", "level": "poisonous", "sources": [] },
    { "name": "Hygrophoropsis aurantiaca", "level": "poisonous", "sources": [] },
    { "name": "Rubroboletus satanas", "level": "poisonous", "sources": [] },
    { "name": "Scleroderma citrinum", "level": "poisonous", "sources": [] },
    { "name": "Coprinopsis atramentaria", "level": "poisonous", "sources": [] },
    { "name": "Russula emetica", "level": "poisonous", "sources": [] },
    { "name": "Lactarius torminosus", "level": "poisonous", "sources": [] },
    { "name": "Mycena pura", "level": "poisonous", "sources": [] },
    { "name": "Inocybe geophylla", "level": "poisonous", "sources": [] }
  ],
  "pairs": [
    { "edible": "Agaricus campestris", "dangerous": "Agaricus xanthodermus", "sources": [] },
    { "edible": "Agaricus campestris", "dangerous": "Amanita virosa", "sources": [] },
    { "edible": "Agaricus campestris", "dangerous": "Amanita phalloides", "sources": [] },
    { "edible": "Agaricus arvensis", "dangerous": "Agaricus xanthodermus", "sources": [] },
    { "edible": "Agaricus arvensis", "dangerous": "Amanita virosa", "sources": [] },
    { "edible": "Agaricus silvicola", "dangerous": "Agaricus xanthodermus", "sources": [] },
    { "edible": "Agaricus silvicola", "dangerous": "Amanita virosa", "sources": [] },
    { "edible": "Agaricus silvicola", "dangerous": "Amanita phalloides", "sources": [] },
    { "edible": "Agaricus augustus", "dangerous": "Agaricus xanthodermus", "sources": [] },
    { "edible": "Macrolepiota procera", "dangerous": "Lepiota brunneoincarnata", "sources": [] },
    { "edible": "Macrolepiota procera", "dangerous": "Lepiota subincarnata", "sources": [] },
    { "edible": "Chlorophyllum rhacodes", "dangerous": "Lepiota brunneoincarnata", "sources": [] },
    { "edible": "Coprinus comatus", "dangerous": "Coprinopsis atramentaria", "sources": [] },
    { "edible": "Calvatia gigantea", "dangerous": "Scleroderma citrinum", "sources": [] },
    { "edible": "Lycoperdon perlatum", "dangerous": "Scleroderma citrinum", "sources": [] },
    { "edible": "Lycoperdon perlatum", "dangerous": "Amanita phalloides", "sources": [] },
    { "edible": "Cantharellus cibarius", "dangerous": "Hygrophoropsis aurantiaca", "sources": [] },
    { "edible": "Cantharellus cibarius", "dangerous": "Omphalotus illudens", "sources": [] },
    { "edible": "Boletus edulis", "dangerous": "Rubroboletus satanas", "sources": [] },
    { "edible": "Flammulina velutipes", "dangerous": "Galerina marginata", "sources": [] },
    { "edible": "Lepista nuda", "dangerous": "Inocybe geophylla", "sources": [] },
    { "edible": "Lepista nuda", "dangerous": "Mycena pura", "sources": [] },
    { "edible": "Calocybe gambosa", "dangerous": "Inocybe erubescens", "sources": [] },
    { "edible": "Calocybe gambosa", "dangerous": "Entoloma sinuatum", "sources": [] },
    { "edible": "Marasmius oreades", "dangerous": "Clitocybe rivulosa", "sources": [] },
    { "edible": "Marasmius oreades", "dangerous": "Clitocybe dealbata", "sources": [] },
    { "edible": "Laccaria amethystina", "dangerous": "Mycena pura", "sources": [] },
    { "edible": "Laccaria amethystina", "dangerous": "Inocybe geophylla", "sources": [] },
    { "edible": "Morchella esculenta", "dangerous": "Gyromitra esculenta", "sources": [] },
    { "edible": "Russula cyanoxantha", "dangerous": "Amanita phalloides", "sources": [] },
    { "edible": "Russula cyanoxantha", "dangerous": "Russula emetica", "sources": [] },
    { "edible": "Lactarius deliciosus", "dangerous": "Lactarius torminosus", "sources": [] },
    { "edible": "Amanita rubescens", "dangerous": "Amanita pantherina", "sources": [] },
    { "edible": "Armillaria mellea", "dangerous": "Galerina marginata", "sources": [] },
    { "edible": "Armillaria mellea", "dangerous": "Hypholoma fasciculare", "sources": [] },
    { "edible": "Kuehneromyces mutabilis", "dangerous": "Galerina marginata", "sources": [] },
    { "edible": "Clitopilus prunulus", "dangerous": "Clitocybe rivulosa", "sources": [] },
    { "edible": "Clitopilus prunulus", "dangerous": "Clitocybe dealbata", "sources": [] },
    { "edible": "Clitopilus prunulus", "dangerous": "Entoloma sinuatum", "sources": [] }
  ],
  "noDangerousLookalike": [
    { "edible": "Craterellus cornucopioides", "sources": [] },
    { "edible": "Craterellus tubaeformis", "sources": [] },
    { "edible": "Hydnum repandum", "sources": [] },
    { "edible": "Hydnum rufescens", "sources": [] },
    { "edible": "Imleria badia", "sources": [] },
    { "edible": "Leccinum scabrum", "sources": [] },
    { "edible": "Leccinum versipelle", "sources": [] },
    { "edible": "Suillus luteus", "sources": [] },
    { "edible": "Suillus grevillei", "sources": [] },
    { "edible": "Laetiporus sulphureus", "sources": [] },
    { "edible": "Fistulina hepatica", "sources": [] },
    { "edible": "Grifola frondosa", "sources": [] },
    { "edible": "Sparassis crispa", "sources": [] },
    { "edible": "Pleurotus ostreatus", "sources": [] },
    { "edible": "Pleurotus pulmonarius", "sources": [] },
    { "edible": "Lepista personata", "sources": [] },
    { "edible": "Laccaria laccata", "sources": [] },
    { "edible": "Auricularia auricula-judae", "sources": [] },
    { "edible": "Cortinarius caperatus", "sources": [] },
    { "edible": "Polyporus squamosus", "sources": [] },
    { "edible": "Hericium erinaceus", "sources": [] }
  ]
}
```

- [ ] **Step 8: Run both checks to see the expected failures**

Run: `npm run check-core-lists`
Expected: exit 1, with problems such as `edible "Agaricus campestris": needs two sources from different websites (has 0)`.

Run: `npm run check-core-names`
Expected: a `NOT CURRENT` line for every seed name iNaturalist files under another name. For example, it may
suggest `Cerioporus squamosus` for `Polyporus squamosus`, or `Collybia nuda` for `Lepista nuda`. Read the output and
do not guess. The last line reads `N of 70 names are iNaturalist's current names`.

- [ ] **Step 9: Commit (the failing checks are expected at this point)**

```bash
git add tools/lib/core-lists.ts tools/check-core-lists.ts tools/check-core-names.ts tools/config/core-lists.json tests/core-lists.test.ts
git commit -m "feat: core-list rules and the unsourced seed lists (sources come in the next task)"
```

---

### Task 5: Confirm the core lists against two sources

This task is research, not code. It is the step that makes the lists true. It could be split across helpers (about
75 species × 2 pages). Stefan's rule: ask him first. By default, do it inline.

**Files:**
- Modify: `tools/config/core-lists.json`
- Create: `reports/core-lists-research.md`

- [ ] **Step 1: Use iNaturalist's current names**

For every `NOT CURRENT` line from `npm run check-core-names`, replace the name **everywhere** in
`tools/config/core-lists.json`: in the edible or dangerous entry, and in every pair or no-lookalike entry that uses
it. Only use a suggestion whose `matched_term` is the old name (that shows iNaturalist treats it as a synonym). If
the suggestion is anything else, look the species up on First Nature first. Re-run until it prints
`70 of 70 names are iNaturalist's current names` (or the new total) and exits 0.

- [ ] **Step 2: Read the two main pages for every species**

For each species in `edibles` and `dangerous`, fetch both pages with WebFetch:
- First Nature: `https://www.first-nature.com/fungi/<genus>-<species>.php` (lowercase, a hyphen between the two
  words). First Nature may file a page under an older name; if the address answers 404, run WebSearch with
  `allowed_domains: ["first-nature.com"]` and the scientific name.
- Wild Food UK: `https://www.wildfooduk.com/mushroom-guide/<english-name-slug>/` (lowercase English name, spaces to
  hyphens, apostrophes removed). If it answers 404, run WebSearch with `allowed_domains: ["wildfooduk.com"]`.
- If either site has no page for the species, use `https://en.wikipedia.org/wiki/<Genus>_<species>` as the second
  source.

Use this WebFetch prompt for every page (fill in the name):

> From this page only, about <Genus species>: (1) does it say the species is edible, poisonous, or deadly / potentially
> fatal — answer in one line in your own words; (2) list every other species the page says it can be confused with,
> each with the page's stated danger; (3) does it say it must be cooked, or that some people react badly; (4) does it
> say the species is legally protected in the UK. If the page is about a different species, or did not load, say so.

- [ ] **Step 3: Fill in the sources, keeping only what two websites state**

- **Edible entry:** add both URLs if both pages say it is edible. If only one does, find a second allowed source
  (Wikipedia, Kew, Woodland Trust, NHM, Plantlife). If none is found, **remove the species from `edibles`**, together
  with its pairs and no-lookalike entry. Note it in the research report.
- **Dangerous entry:** add both URLs if both pages say it is poisonous. Set `level` to `deadly` only when **both**
  sources call it deadly or potentially fatal; otherwise set it to `poisonous`.
- **Pair:** add the URLs of two different websites that each name the dangerous species as a confusion risk for the
  edible one. The statement may be on either species' page. If fewer than two websites name a pair, remove it.
- **New pairs:** when two websites name a dangerous lookalike that the seed lacks, add a pair. Add the species to
  `dangerous` too, with its own two sources.
- **No-lookalike entry:** add two URLs whose pages say the species has no dangerous lookalike, or is unlikely to be
  confused with anything poisonous. If two websites do not say so, find its dangerous lookalikes instead (as pairs). If
  neither can be sourced, remove the species from `edibles` and note why.
- Do not invent a source and do not record a page that does not state the fact. A page that only *shows* a species
  without saying anything about its danger does not count.

- [ ] **Step 4: Check that no deadly UK species is missing**

Fetch `https://www.wildfooduk.com/mushroom-guide/` and list every species it marks as deadly. For each one not in
`dangerous`, open its First Nature page. If both sites call it deadly or potentially fatal, add it with `level`
`deadly` and both sources. Then do the reverse: WebSearch `allowed_domains: ["first-nature.com"]` with the query
`deadly poisonous` and check the species it names the same way.

- [ ] **Step 5: Run the checks until they are clean**

Run: `npm run check-core-lists`
Expected: `0 problems` and exit 0.

Run: `npm run check-core-names`
Expected: every name current, exit 0.

- [ ] **Step 6: Write `reports/core-lists-research.md`**

Write it in our own words, with no quotes from the sites. It has four sections:
- **Changed names:** old → new, and why.
- **Removed from the seed:** each species or pair, and the reason (for example, "only one website names it").
- **Added to the seed:** each species or pair, and its two sources.
- **Levels changed:** for example, Panthercap stays poisonous because only one source calls it potentially fatal.

Finish with a line of totals: edible N, dangerous N (deadly N), pairs N, no-dangerous-lookalike N.

- [ ] **Step 7: Commit**

```bash
git add tools/config/core-lists.json reports/core-lists-research.md
git commit -m "content: core lists confirmed against two sources each"
```

---

### Task 6: Picking the ~300

**Files:**
- Create: `tools/lib/select.ts`
- Test: `tests/select.test.ts`

- [ ] **Step 1: Write the failing tests**

`tests/select.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { selectSpecies, type Candidate, type SelectInput } from '../tools/lib/select.ts';

const cand = (name: string, ukRecords: number, inatId = name.length): Candidate => ({
  inatId,
  name,
  ukRecords,
  inatEnglish: null,
  photo: null,
});

function input(over: Partial<SelectInput> = {}): SelectInput {
  const core = new Map<string, Candidate>([
    ['Edibilis bonus', cand('Edibilis bonus', 50)],
    ['Mortalis rarus', cand('Mortalis rarus', 0)],
    ['Similis malus', cand('Similis malus', 40)],
  ]);
  return {
    ranked: [cand('Communis primus', 900), cand('Communis secundus', 800), cand('Similis malus', 40), cand('Edibilis bonus', 50)],
    core,
    edibles: ['Edibilis bonus'],
    dangerous: [
      { name: 'Mortalis rarus', level: 'deadly' },
      { name: 'Similis malus', level: 'poisonous' },
    ],
    lookalikeNames: new Set(['Similis malus']),
    add: new Map(),
    remove: [],
    target: 5,
    ...over,
  };
}

describe('selectSpecies', () => {
  it('takes every core species first, with its reasons, then the most recorded', () => {
    const { picked } = selectSpecies(input());
    expect(picked.map((p) => [p.name, p.reasons])).toEqual([
      ['Edibilis bonus', ['edible']],
      ['Mortalis rarus', ['deadly']],
      ['Similis malus', ['dangerous-lookalike']],
      ['Communis primus', ['most-recorded']],
      ['Communis secundus', ['most-recorded']],
    ]);
    expect(picked.find((p) => p.name === 'Mortalis rarus')?.dangerLevel).toBe('deadly');
    expect(picked.find((p) => p.name === 'Similis malus')?.dangerLevel).toBe('poisonous');
  });

  it('stops at the target', () => {
    expect(selectSpecies(input({ target: 4 })).picked).toHaveLength(4);
  });

  it('keeps a core species that has no UK records, and says so', () => {
    const { picked, notes } = selectSpecies(input());
    expect(picked.some((p) => p.name === 'Mortalis rarus')).toBe(true);
    expect(notes).toContain('Mortalis rarus has no UK research-grade records on iNaturalist; it is in for safety.');
  });

  it('honours a removal of an ordinary species and does not refill it', () => {
    const { picked } = selectSpecies(input({ remove: ['Communis primus'], target: 5 }));
    expect(picked.map((p) => p.name)).not.toContain('Communis primus');
  });

  it('refuses to remove a deadly species or a dangerous lookalike', () => {
    const { picked, notes } = selectSpecies(input({ remove: ['Mortalis rarus', 'Similis malus'] }));
    expect(picked.map((p) => p.name)).toEqual(expect.arrayContaining(['Mortalis rarus', 'Similis malus']));
    expect(notes).toContain('Kept Mortalis rarus: dangerous lookalikes and deadly species always stay in the guide.');
  });

  it("adds Stefan's additions with their own reason", () => {
    const add = new Map([['Addita nova', cand('Addita nova', 3)]]);
    const { picked } = selectSpecies(input({ add, target: 6 }));
    expect(picked.find((p) => p.name === 'Addita nova')?.reasons).toEqual(['added-by-stefan']);
  });

  it('says when there are not enough species for the target', () => {
    const { notes } = selectSpecies(input({ target: 50 }));
    expect(notes).toContain('Only 5 species available for a target of 50.');
  });

  it('fails loudly when a core species was not resolved', () => {
    expect(() => selectSpecies(input({ edibles: ['Ignotus nomen'] }))).toThrow(/Ignotus nomen/);
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run tests/select.test.ts`
Expected: FAIL — cannot find module `../tools/lib/select.ts`.

- [ ] **Step 3: Write `tools/lib/select.ts`**

```ts
export type Reason = 'edible' | 'dangerous-lookalike' | 'deadly' | 'most-recorded' | 'added-by-stefan';
export type Level = 'deadly' | 'poisonous';

export type Candidate = {
  inatId: number;
  name: string;
  ukRecords: number;
  inatEnglish: string | null;
  photo: { url: string; attribution: string } | null;
};

export type Picked = Candidate & { reasons: Reason[]; dangerLevel: Level | null };

export type SelectInput = {
  ranked: Candidate[];
  core: Map<string, Candidate>;
  edibles: string[];
  dangerous: Array<{ name: string; level: Level }>;
  lookalikeNames: Set<string>;
  add: Map<string, Candidate>;
  remove: string[];
  target: number;
};

export function selectSpecies(input: SelectInput): { picked: Picked[]; notes: string[] } {
  const notes: string[] = [];
  const picked = new Map<string, Picked>();
  const neverRemove = new Set<string>();

  const put = (c: Candidate, reason: Reason, level: Level | null = null) => {
    const p = picked.get(c.name) ?? { ...c, reasons: [], dangerLevel: null };
    if (!p.reasons.includes(reason)) p.reasons.push(reason);
    if (level) p.dangerLevel = level;
    picked.set(c.name, p);
  };
  const coreOf = (name: string): Candidate => {
    const c = input.core.get(name);
    if (!c) throw new Error(`Core species "${name}" was not resolved on iNaturalist`);
    return c;
  };

  for (const name of input.edibles) put(coreOf(name), 'edible');
  for (const d of input.dangerous) {
    const c = coreOf(d.name);
    if (input.lookalikeNames.has(d.name)) put(c, 'dangerous-lookalike', d.level);
    if (d.level === 'deadly') put(c, 'deadly', d.level);
    neverRemove.add(d.name);
  }
  for (const c of input.add.values()) put(c, 'added-by-stefan');

  const removing = new Set<string>();
  for (const name of input.remove) {
    if (neverRemove.has(name)) notes.push(`Kept ${name}: dangerous lookalikes and deadly species always stay in the guide.`);
    else removing.add(name);
  }
  for (const name of removing) picked.delete(name);

  const ranked = [...input.ranked].sort((a, b) => b.ukRecords - a.ukRecords || a.name.localeCompare(b.name));
  for (const c of ranked) {
    if (picked.size >= input.target) break;
    if (picked.has(c.name) || removing.has(c.name)) continue;
    put(c, 'most-recorded');
  }

  if (picked.size < input.target) notes.push(`Only ${picked.size} species available for a target of ${input.target}.`);
  for (const p of picked.values()) {
    if (p.ukRecords === 0) notes.push(`${p.name} has no UK research-grade records on iNaturalist; it is in for safety.`);
  }
  return { picked: [...picked.values()], notes };
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run tests/select.test.ts && npm run typecheck`
Expected: `8 passed`; `tsc` exit 0.

- [ ] **Step 5: Commit**

```bash
git add tools/lib/select.ts tests/select.test.ts
git commit -m "feat: species selection (core first, Stefan's changes, most recorded; dangerous species can't be removed)"
```

---

### Task 7: English names from the BMS list

**Files:**
- Create: `tools/lib/bms-names.ts`
- Test: `tests/bms-names.test.ts`

- [ ] **Step 1: Write the failing tests**

The sample lines are copied from the real `pdftotext -raw` output of the 2005 list.

`tests/bms-names.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { englishName, parseBmsLatinToEnglish } from '../tools/lib/bms-names.ts';

const SAMPLE = [
  'List of Recommended English',
  'Names For Fungi in the UK',
  'Latin to English names',
  'Current Scientific Latin name Recommended English',
  'Abortiporus biennis Blushing Rosette',
  'Agaricus arvensis Horse Mushroom',
  'Agaricus augustus The Prince',
  'Exidia glandulosa Witches\' Butter',
  'Auricularia auricula-judae Jelly Ear',
  'Hericium erinaceum Bearded Tooth *',
  'Astraeus hygrometricus',
  'Barometer Earthstar',
  '7',
  'English to Latin names',
  'Horse Mushroom Agaricus arvensis',
].join('\n');

describe('parseBmsLatinToEnglish', () => {
  const { names, unparsed } = parseBmsLatinToEnglish(SAMPLE);

  it('reads "Genus species English Name" lines', () => {
    expect(names.get('Agaricus arvensis')).toBe('Horse Mushroom');
    expect(names.get('Agaricus augustus')).toBe('The Prince');
    expect(names.get("Exidia glandulosa")).toBe("Witches' Butter");
    expect(names.get('Auricularia auricula-judae')).toBe('Jelly Ear');
  });

  it('drops the footnote star some names carry (10 in the 2005 list)', () => {
    expect(names.get('Hericium erinaceum')).toBe('Bearded Tooth');
  });

  it('joins a Latin name and its English name split over two lines', () => {
    expect(names.get('Astraeus hygrometricus')).toBe('Barometer Earthstar');
  });

  it('stops at the English-to-Latin section and reports what it did not understand', () => {
    expect(names.size).toBe(7);
    expect(unparsed).toEqual(['7']);
  });

  it('refuses a text without the Latin-to-English section', () => {
    expect(() => parseBmsLatinToEnglish('nothing here')).toThrow(/Latin-to-English section/);
  });
});

describe('englishName', () => {
  const bms = new Map([['Agaricus arvensis', 'Horse Mushroom']]);
  it('prefers the BMS name', () => {
    expect(englishName('Agaricus arvensis', bms, 'horse mushroom')).toEqual({ english: 'Horse Mushroom', source: 'bms-2005' });
  });
  it("falls back to iNaturalist's name, then to none", () => {
    expect(englishName('Boletus edulis', bms, 'Penny Bun')).toEqual({ english: 'Penny Bun', source: 'inaturalist' });
    expect(englishName('Boletus edulis', bms, null)).toEqual({ english: null, source: null });
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run tests/bms-names.test.ts`
Expected: FAIL — cannot find module `../tools/lib/bms-names.ts`.

- [ ] **Step 3: Write `tools/lib/bms-names.ts`**

```ts
// The British Mycological Society's "List of Recommended English Names for Fungi in the UK" (2005), as text from
// `pdftotext -raw`. The Latin-to-English section has one "Genus species English Name" per line; a few names are
// split over two lines (Latin first).
const LATIN_LINE = /^([A-Z][a-z]+ [a-z][a-z-]+(?: (?:var|f|subsp|ssp)\. [a-z][a-z-]+)?)(?: (.+))?$/;
// Ten names carry a footnote star ("has alternative English names"); the star is not part of the name.
const clean = (english: string) => english.replace(/\s*\*+$/, '').trim();

export function parseBmsLatinToEnglish(raw: string): { names: Map<string, string>; unparsed: string[] } {
  const lines = raw.split(/\r?\n/).map((l) => l.trim());
  const start = lines.findIndex((l) => /^Current Scientific Latin name/i.test(l));
  const end = lines.findIndex((l) => /^English to Latin names/i.test(l));
  if (start < 0 || end <= start) throw new Error('Could not find the Latin-to-English section in the BMS list');

  const names = new Map<string, string>();
  const unparsed: string[] = [];
  let pendingLatin: string | null = null;
  for (const line of lines.slice(start + 1, end)) {
    if (!line) continue;
    const m = LATIN_LINE.exec(line);
    if (m && m[2]) {
      if (pendingLatin) unparsed.push(pendingLatin);
      names.set(m[1], clean(m[2]));
      pendingLatin = null;
    } else if (m) {
      if (pendingLatin) unparsed.push(pendingLatin);
      pendingLatin = m[1];
    } else if (pendingLatin && /^[A-Z'"]/.test(line)) {
      names.set(pendingLatin, clean(line));
      pendingLatin = null;
    } else {
      unparsed.push(line);
    }
  }
  if (pendingLatin) unparsed.push(pendingLatin);
  return { names, unparsed };
}

export function englishName(
  name: string,
  bms: Map<string, string>,
  inatEnglish: string | null,
): { english: string | null; source: 'bms-2005' | 'inaturalist' | null } {
  const fromBms = bms.get(name);
  if (fromBms) return { english: fromBms, source: 'bms-2005' };
  if (inatEnglish) return { english: inatEnglish, source: 'inaturalist' };
  return { english: null, source: null };
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run tests/bms-names.test.ts && npm run typecheck`
Expected: `7 passed`; `tsc` exit 0.

- [ ] **Step 5: Commit**

```bash
git add tools/lib/bms-names.ts tests/bms-names.test.ts
git commit -m "feat: BMS English names (2005 list) with iNaturalist fallback"
```

---

### Task 8: The review page Stefan reads

**Files:**
- Create: `tools/lib/review-page.ts`
- Test: `tests/review-page.test.ts`

- [ ] **Step 1: Write the failing tests**

`tests/review-page.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { renderReviewPage, sectionOf, type ReviewRow } from '../tools/lib/review-page.ts';

const row = (name: string, reasons: ReviewRow['reasons'], extra: Partial<ReviewRow> = {}): ReviewRow => ({
  inatId: 1,
  name,
  ukRecords: 1234,
  inatEnglish: null,
  photo: null,
  reasons,
  dangerLevel: null,
  english: `${name} english`,
  englishSource: 'bms-2005',
  ...extra,
});

describe('sectionOf', () => {
  it('puts each species in the first section that fits', () => {
    expect(sectionOf(row('A a', ['dangerous-lookalike', 'deadly']))).toBe('Deadly species');
    expect(sectionOf(row('B b', ['dangerous-lookalike']))).toBe('Dangerous lookalikes of edible species');
    expect(sectionOf(row('C c', ['edible', 'added-by-stefan']))).toBe('Edible species');
    expect(sectionOf(row('D d', ['added-by-stefan']))).toBe('Added by you');
    expect(sectionOf(row('E e', ['most-recorded']))).toBe('Most recorded in the UK');
  });
});

describe('renderReviewPage', () => {
  const rows = [
    row('Amanita phalloides', ['deadly', 'dangerous-lookalike'], { dangerLevel: 'deadly' }),
    row('Agaricus campestris', ['edible']),
    row('Xylaria hypoxylon', ['most-recorded']),
  ];
  const html = renderReviewPage(rows, { generated: '2026-10-07', target: 300, notes: ['A note <b>'] });

  it('lists every species once, with its section counts', () => {
    expect(html.match(/<tr class="sp"/g)).toHaveLength(3);
    expect(html).toContain('Deadly species (1)');
    expect(html).toContain('Edible species (1)');
    expect(html).toContain('Most recorded in the UK (1)');
    expect(html).toContain('3 species');
  });

  it('links each species to iNaturalist and shows UK records', () => {
    expect(html).toContain('https://www.inaturalist.org/taxa/1');
    expect(html).toContain('1,234');
  });

  it('escapes text', () => {
    const evil = renderReviewPage([row('<script>x</script> y', ['most-recorded'])], { generated: 'd', target: 1, notes: [] });
    expect(evil).not.toContain('<script>x</script>');
    expect(evil).toContain('&lt;script&gt;');
  });

  it('shows the notes', () => {
    expect(html).toContain('A note &lt;b&gt;');
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run tests/review-page.test.ts`
Expected: FAIL — cannot find module `../tools/lib/review-page.ts`.

- [ ] **Step 3: Write `tools/lib/review-page.ts`**

```ts
import type { Picked, Reason } from './select.ts';

export type ReviewRow = Picked & { english: string | null; englishSource: string | null };

const SECTIONS: Array<{ title: string; reason: Reason }> = [
  { title: 'Deadly species', reason: 'deadly' },
  { title: 'Dangerous lookalikes of edible species', reason: 'dangerous-lookalike' },
  { title: 'Edible species', reason: 'edible' },
  { title: 'Added by you', reason: 'added-by-stefan' },
  { title: 'Most recorded in the UK', reason: 'most-recorded' },
];

const TAG: Record<Reason, string> = {
  deadly: 'Deadly',
  'dangerous-lookalike': 'Dangerous lookalike',
  edible: 'Edible',
  'added-by-stefan': 'Added by you',
  'most-recorded': 'Most recorded',
};

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);

export function sectionOf(r: ReviewRow): string {
  return SECTIONS.find((s) => r.reasons.includes(s.reason))!.title;
}

function rowHtml(r: ReviewRow): string {
  const img = r.photo
    ? `<img src="${esc(r.photo.url)}" alt="" loading="lazy" width="48" height="48" title="${esc(r.photo.attribution)}">`
    : '';
  const tags = r.reasons.map((x) => `<span class="tag ${x}">${TAG[x]}</span>`).join(' ');
  return (
    `<tr class="sp"><td class="ph">${img}</td>` +
    `<td><div class="en">${esc(r.english ?? '-')}</div><div class="sci">${esc(r.name)}</div></td>` +
    `<td class="num">${r.ukRecords.toLocaleString('en-GB')}</td>` +
    `<td>${tags}</td>` +
    `<td><a href="https://www.inaturalist.org/taxa/${r.inatId}">iNaturalist</a></td></tr>`
  );
}

export function renderReviewPage(
  rows: ReviewRow[],
  meta: { generated: string; target: number; notes: string[] },
): string {
  const groups = SECTIONS.map((s) => ({ title: s.title, rows: rows.filter((r) => sectionOf(r) === s.title) }));
  const body = groups
    .filter((g) => g.rows.length > 0)
    .map(
      (g) =>
        `<h2>${esc(g.title)} (${g.rows.length})</h2>` +
        `<table><thead><tr><th></th><th>Name</th><th>UK records</th><th>Why it is in</th><th></th></tr></thead>` +
        `<tbody>${g.rows.map(rowHtml).join('')}</tbody></table>`,
    )
    .join('\n');
  const notes = meta.notes.length
    ? `<h2>Notes</h2><ul>${meta.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>`
    : '';
  return `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mushroom guide: species list</title>
<style>
:root{--bg:#fff;--fg:#1d1d1f;--muted:#6e6e73;--line:#e5e5ea;--deadly:#b3261e;--danger:#b25c00;--edible:#1b7f3b;--plain:#4a4a4f}
@media (prefers-color-scheme: dark){:root{--bg:#161617;--fg:#f5f5f7;--muted:#a1a1a6;--line:#2c2c2e;--deadly:#ff6b60;--danger:#ffb04d;--edible:#5fd383;--plain:#c7c7cc}}
body{margin:0 auto;max-width:960px;padding:16px;background:var(--bg);color:var(--fg);font:15px/1.5 -apple-system,system-ui,sans-serif}
h1{font-size:22px;margin:8px 0}h2{font-size:17px;margin:28px 0 8px}
p.lead{color:var(--muted)}table{width:100%;border-collapse:collapse}
td,th{padding:6px 8px;border-bottom:1px solid var(--line);text-align:left;vertical-align:middle}
th{font-weight:500;color:var(--muted);font-size:13px}.num{text-align:right;white-space:nowrap}
.sci{font-style:italic;color:var(--muted);font-size:13px}.ph img{border-radius:6px;display:block}
.tag{font-size:12px;padding:1px 6px;border-radius:4px;border:1px solid currentColor;white-space:nowrap}
.deadly{color:var(--deadly)}.dangerous-lookalike{color:var(--danger)}.edible{color:var(--edible)}
.most-recorded,.added-by-stefan{color:var(--plain)}a{color:inherit}
@media (max-width:600px){td:nth-child(3),th:nth-child(3),td:nth-child(5),th:nth-child(5){display:none}}
</style></head><body>
<h1>Species list for your mushroom guide</h1>
<p class="lead">${rows.length} species (aim: about ${meta.target}). Made ${esc(meta.generated)}. Tell me any species to add or remove.
Deadly species and dangerous lookalikes always stay in.</p>
${notes}
${body}
</body></html>
`;
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run tests/review-page.test.ts && npm run typecheck`
Expected: `5 passed`; `tsc` exit 0.

- [ ] **Step 5: Commit**

```bash
git add tools/lib/review-page.ts tests/review-page.test.ts
git commit -m "feat: species-list review page (grouped, escaped, phone-friendly, dark mode)"
```

---

### Task 9: The build script, and the first real run

**Files:**
- Create: `tools/build-species-list.ts`, `tools/config/list-overrides.json`
- Output: `content/species-list.json`, `reports/species-list-report.md`, `review/species-list.html`

- [ ] **Step 1: Write `tools/config/list-overrides.json`**

```json
{ "add": [], "remove": [] }
```

- [ ] **Step 2: Write `tools/build-species-list.ts`**

```ts
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createInatClient, type InatTaxon } from './lib/inat.ts';
import { makeGroupFilter, resolveGroups, type GroupsConfig } from './lib/groups.ts';
import { validateCoreLists, type CoreLists } from './lib/core-lists.ts';
import { selectSpecies, type Candidate } from './lib/select.ts';
import { englishName, parseBmsLatinToEnglish } from './lib/bms-names.ts';
import { renderReviewPage, sectionOf, type ReviewRow } from './lib/review-page.ts';

const ROOT = new URL('../', import.meta.url);
const TARGET = 300;
const BMS_URL = 'https://www.davidmoore.org.uk/assets/fungi4schools/Reprints/ENGLISH_NAMES.pdf';

const readJson = <T>(rel: string): T => JSON.parse(readFileSync(new URL(rel, ROOT), 'utf8')) as T;
const writeText = (rel: string, text: string) => {
  const url = new URL(rel, ROOT);
  mkdirSync(new URL('./', url), { recursive: true });
  writeFileSync(url, text);
};

function toCandidate(t: InatTaxon, ukRecords: number): Candidate {
  const photo = t.default_photo?.square_url
    ? { url: t.default_photo.square_url, attribution: t.default_photo.attribution ?? '' }
    : null;
  return { inatId: t.id, name: t.name, ukRecords, inatEnglish: t.preferred_common_name ?? null, photo };
}

async function loadBmsNames(): Promise<{ names: Map<string, string>; unparsed: number }> {
  const pdf = new URL('cache/bms-english-names-2005.pdf', ROOT);
  const txt = new URL('cache/bms-english-names-2005.txt', ROOT);
  if (!existsSync(pdf)) {
    const res = await fetch(BMS_URL);
    if (!res.ok) throw new Error(`Could not download the BMS names list: HTTP ${res.status}`);
    mkdirSync(new URL('cache/', ROOT), { recursive: true });
    writeFileSync(pdf, Buffer.from(await res.arrayBuffer()));
  }
  execFileSync('pdftotext', ['-raw', fileURLToPath(pdf), fileURLToPath(txt)]);
  const parsed = parseBmsLatinToEnglish(readFileSync(txt, 'utf8'));
  return { names: parsed.names, unparsed: parsed.unparsed.length };
}

async function main() {
  const groupsCfg = readJson<GroupsConfig>('tools/config/groups.json');
  const core = readJson<CoreLists>('tools/config/core-lists.json');
  const overrides = readJson<{ add: string[]; remove: string[] }>('tools/config/list-overrides.json');

  const problems = validateCoreLists(core);
  if (problems.length > 0) {
    console.error(`The core lists have ${problems.length} problem(s). Run "npm run check-core-lists".`);
    process.exit(1);
  }

  const inat = createInatClient();
  const groups = await resolveGroups(groupsCfg, inat.resolveTaxon);
  const isLargerFungus = makeGroupFilter(groups);

  const byName = new Map<string, Candidate>();
  const groupLines: string[] = [];
  for (const g of groups.include) {
    const counts = await inat.speciesCounts(groupsCfg.placeId, g.id);
    let kept = 0;
    for (const { count, taxon } of counts) {
      if (!isLargerFungus(taxon)) continue;
      kept++;
      const prev = byName.get(taxon.name);
      if (!prev || prev.ukRecords < count) byName.set(taxon.name, toCandidate(taxon, count));
    }
    groupLines.push(`- ${g.name} (${g.rank}, iNaturalist ${g.id}): ${counts.length} UK species, ${kept} kept`);
    console.log(groupLines.at(-1));
  }
  for (const g of groups.exclude) groupLines.push(`- Left out: ${g.name} (${g.rank}, iNaturalist ${g.id}) — ${g.why}`);

  const resolve = async (name: string): Promise<Candidate> => {
    const known = byName.get(name);
    if (known) return known;
    const taxon = await inat.resolveTaxon(name, 'species');
    const own = await inat.speciesCounts(groupsCfg.placeId, taxon.id);
    const count = own.find((c) => c.taxon.id === taxon.id)?.count ?? 0;
    return toCandidate(taxon, count);
  };

  const coreMap = new Map<string, Candidate>();
  for (const name of [...core.edibles.map((e) => e.name), ...core.dangerous.map((d) => d.name)]) {
    coreMap.set(name, await resolve(name));
  }
  const addMap = new Map<string, Candidate>();
  for (const name of overrides.add) addMap.set(name, await resolve(name));

  const { picked, notes } = selectSpecies({
    ranked: [...byName.values()],
    core: coreMap,
    edibles: core.edibles.map((e) => e.name),
    dangerous: core.dangerous.map((d) => ({ name: d.name, level: d.level })),
    lookalikeNames: new Set(core.pairs.map((p) => p.dangerous)),
    add: addMap,
    remove: overrides.remove,
    target: TARGET,
  });

  const bms = await loadBmsNames();
  const rows: ReviewRow[] = picked.map((p) => {
    const n = englishName(p.name, bms.names, p.inatEnglish);
    return { ...p, english: n.english, englishSource: n.source };
  });

  const generated = new Date().toISOString();
  writeText(
    'content/species-list.json',
    JSON.stringify(
      {
        generated,
        placeId: groupsCfg.placeId,
        target: TARGET,
        species: rows.map((r) => ({
          inatId: r.inatId,
          name: r.name,
          english: r.english,
          englishSource: r.englishSource,
          ukRecords: r.ukRecords,
          reasons: r.reasons,
          dangerLevel: r.dangerLevel,
        })),
      },
      null,
      2,
    ) + '\n',
  );

  const count = (title: string) => rows.filter((r) => sectionOf(r) === title).length;
  const fromBms = rows.filter((r) => r.englishSource === 'bms-2005').length;
  const fromInat = rows.filter((r) => r.englishSource === 'inaturalist').length;
  writeText(
    'reports/species-list-report.md',
    [
      '# Species list: build report',
      '',
      `Generated: ${generated} · Target: ${TARGET} · Picked: ${rows.length}`,
      '',
      '## Where they come from',
      `- Deadly: ${count('Deadly species')}`,
      `- Dangerous lookalikes: ${count('Dangerous lookalikes of edible species')}`,
      `- Edible: ${count('Edible species')}`,
      `- Added by Stefan: ${count('Added by you')}`,
      `- Most recorded in the UK: ${count('Most recorded in the UK')}`,
      '',
      '## Groups',
      ...groupLines,
      '',
      '## English names',
      `- From the BMS list (2005): ${fromBms} of ${rows.length}`,
      `- From iNaturalist: ${fromInat}`,
      `- None: ${rows.length - fromBms - fromInat}`,
      `- BMS list lines not understood: ${bms.unparsed}`,
      '',
      '## Notes',
      ...(notes.length ? notes.map((n) => `- ${n}`) : ['- none']),
      '',
    ].join('\n'),
  );

  writeText('review/species-list.html', renderReviewPage(rows, { generated: generated.slice(0, 10), target: TARGET, notes }));
  console.log(`Picked ${rows.length} species; English names from BMS ${fromBms}, iNaturalist ${fromInat}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: Type-check**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 4: Run it for real**

Run: `npm run species-list`
Expected:
- seven lines like `- Agaricomycetes (class, iNaturalist 50814): 1482 UK species, 1482 kept`. Leotiomycetes should keep
  fewer than its total, because the mildews and tar spot are left out;
- then `Picked 300 species; English names from BMS …, iNaturalist …`;
- it takes a few minutes, because of the 1.1-second spacing.

- [ ] **Step 5: Read the outputs before going further**

- `reports/species-list-report.md`: a picked total of about 300, every core section non-empty, and the BMS match
  count. Write the BMS match count into the spec's stage-1 proof (Task 10, step 4).
- `review/species-list.html`: open it with the Read tool, or in the Browser pane with `file://` and the full path,
  and check:
  - no mildew, tar spot, coral spot or ergot appears;
  - every deadly species is in "Deadly species";
  - the names look right.
- Any species in "Most recorded" that is not a larger fungus (a microfungus that slipped through) means a missing
  exclusion. Add its family or order to `tools/config/groups.json` with a `why`, re-run, and note it in the commit.

- [ ] **Step 6: Commit**

```bash
git add tools/build-species-list.ts tools/config/list-overrides.json content/species-list.json reports/species-list-report.md review/species-list.html
git commit -m "content: first species list (core species + most recorded UK larger fungi), review page"
```

---

### Task 10: Stefan's review and the approval stamp

**Files:**
- Create: `tools/approve-species-list.ts`
- Modify: `tools/config/list-overrides.json`, `content/species-list.json`, `docs/superpowers/specs/2026-10-06-mushroom-app-design.md`

- [ ] **Step 1: Send Stefan the review page**

Use SendUserFile with `review/species-list.html` (display `render`, status `normal`). Then ask with AskUserQuestion:
"Does the species list look right?" Options: "Approved" and "Changes". If he chooses changes, he names the species to
add or remove.

- [ ] **Step 2: Apply his changes, then rebuild**

Put his additions (scientific names; look up an English name with
`GET https://api.inaturalist.org/v1/taxa?q=<english name>`) in `add`, and his removals in `remove`, in
`tools/config/list-overrides.json`. Run `npm run species-list`. Tell him plainly about any removal the script refused
(the report's notes say "Kept …: dangerous lookalikes and deadly species always stay in the guide"). Send the page
again. Repeat until he approves.

- [ ] **Step 3: Write `tools/approve-species-list.ts` and stamp the list**

```ts
import { readFileSync, writeFileSync } from 'node:fs';

const file = new URL('../content/species-list.json', import.meta.url);
const list = JSON.parse(readFileSync(file, 'utf8'));
const today = new Date().toISOString().slice(0, 10);
list.approved = { by: 'Stefan', on: today, count: list.species.length };
writeFileSync(file, JSON.stringify(list, null, 2) + '\n');
console.log(`Stamped ${list.species.length} species as approved by Stefan on ${today}`);
```

Run: `npm run approve-species-list`
Expected: `Stamped N species as approved by Stefan on 2026-…`.

- [ ] **Step 4: Record the stage-1 proofs in the spec**

Under section 14, "Stage 1", in `docs/superpowers/specs/2026-10-06-mushroom-app-design.md`, add one line:
`Proven <date>: <N> species after the exclusions; BMS English names matched <M> of <N> (the rest from iNaturalist).`

- [ ] **Step 5: Commit**

```bash
git add tools/approve-species-list.ts tools/config/list-overrides.json content/species-list.json reports/species-list-report.md review/species-list.html docs/superpowers/specs/2026-10-06-mushroom-app-design.md package.json
git commit -m "content: species list approved by Stefan"
```

---

### Task 11: First push to Stefan's GitHub

Only once his repository `StefanFriese-bit/mushrooms` exists **and** the Mac's deploy key is on it with write access.
Never switch the `gh` account on this Mac (it is signed in to another account for other work) — this repository
pushes with its own deploy key only.

- [ ] **Step 1: Check the repository exists**

Run: `gh api repos/StefanFriese-bit/mushrooms --jq '.full_name + " private=" + (.private|tostring)'`
Expected: `StefanFriese-bit/mushrooms private=false`. A 404 means it is not made yet. In that case, stop and ask him.

- [ ] **Step 2: Trust GitHub's published host keys (from GitHub's own API over HTTPS)**

```bash
curl -s https://api.github.com/meta | python3 -c "import sys,json; [print('github.com', k) for k in json.load(sys.stdin)['ssh_keys']]" > "$HOME/.ssh/mushrooms_known_hosts"
wc -l "$HOME/.ssh/mushrooms_known_hosts"
```

Expected: 3 lines (ed25519, ecdsa, rsa).

- [ ] **Step 3: Point this repository, and only this one, at the deploy key**

```bash
git remote add origin git@github.com:StefanFriese-bit/mushrooms.git
git config core.sshCommand "ssh -F /dev/null -i $HOME/.ssh/mushrooms_deploy -o IdentitiesOnly=yes -o UserKnownHostsFile=$HOME/.ssh/mushrooms_known_hosts -o StrictHostKeyChecking=yes"
git ls-remote origin
```

Expected: no output and exit 0 (the repository is empty). `Permission denied (publickey)` means the key is not on
the repository. Ask Stefan to add it, with "Allow write access" ticked.

- [ ] **Step 4: Push**

Run: `git push -u origin main`
Expected: `branch 'main' set up to track 'origin/main'`.

- [ ] **Step 5: Verify on GitHub**

Run: `gh api repos/StefanFriese-bit/mushrooms/commits/main --jq .sha` and compare with `git rev-parse HEAD`.
Expected: the same commit id.

---

## Self-review (done when the plan was written)

- **Spec coverage (5.2, 14 stage 1):**
  - UK records counted and limited to larger fungi: Tasks 2, 3 and 9.
  - Every commonly picked edible, their dangerous lookalikes and every deadly UK species, each with two sources:
    Tasks 4 and 5.
  - Filled to about 300 with the most recorded: Task 6.
  - Stefan approves before any page is written: Task 10, with the stamp that later stages check.
  - BMS name matching proven: Tasks 7, 9 and 10.
  - Stefan's personal GitHub: Task 11.
- **Out of scope here:** the app itself and the photo scan (stages 2 and 3, their own plans); writing any species
  page (stage 3).
- **Names used across tasks:** `createInatClient`, `resolveTaxon`, `speciesCounts`, `getJson`,
  `resolveGroups`, `makeGroupFilter`, `validateCoreLists`, `hostOf`, `selectSpecies`, `Candidate`, `Picked`,
  `Reason`, `parseBmsLatinToEnglish`, `englishName`, `renderReviewPage`, `sectionOf`, `ReviewRow`. Each is defined
  once, in the task named, and used with the same signature.
