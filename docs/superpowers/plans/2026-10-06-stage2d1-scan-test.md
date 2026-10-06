# Stage 2d-1: the scan test — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Measure the free Danish fungi models on UK photos of our 300 species, set the scan's two thresholds from
those measurements (spec 6.2), time the best models on Stefan's iPhone, and write `reports/scan-test.md` saying
whether any model passes the safety mark: dangerous species on the shortlist at least 98 times in 100 (spec 6.3).

**Architecture:** Python only turns photos into raw scores (`tools/scan-test/score.py`, PyTorch + timm on the Mac) and
exports the chosen models to ONNX. Every rule of spec 6.2 is TypeScript in `src/scan/rules.ts`, the same code the app
will run. The evaluation (`tools/evaluate-scan.ts`) applies those rules to the saved scores, so the test measures what
ships. The model's species list is matched to ours once and saved as `content/model/df20-classes.json`. The speed
test is a hidden page in the published app (`#/scan-speed`) that runs the exported model with onnxruntime-web.

**Tech:** Python 3.14 venv (torch 2.14.1, timm 1.0.30, onnx 1.23.2, onnxruntime 1.30.0, onnxscript 0.7.2), TypeScript
(tsx, Vitest), onnxruntime-web 1.30.0, Playwright.

**Facts checked while planning (06/10/2026):**
- BVRA publish 69 fungi models on Hugging Face, trained on Danish Fungi 2020 (DF20, 1,604 species), its mini set
  (182) or FungiTastic. Licence on the cards: CC BY-NC 4.0; the DF20 data's own terms: non-commercial research only.
  The models carry no species names: they are in `DF20-metadata.zip` (29 MB, the class number of every training
  photo) on the authors' server (`http://ptak.felk.cvut.cz/plants/DanishFungiDataset/`).
- 272 of our 300 are DF20 classes (248 by name, 24 by an older name): all 38 edibles, 23 of the 28 dangerous. Not
  known: Fool's Webcap, Deadly Fibrecap, Ivory Funnel, Wrinkled Conecap, Jack O'Lantern. 25 DF20 species names cover
  two or more classes (class 728 is *Inocybe lilacina*, filed under the species *Inocybe geophylla*) — a class is
  matched on its own scientific name first.
- The Mac has Python 3.14.3; every package above has a build for it (macOS arm64). 68 GB free.
- iNaturalist's monthly counts: `/observations/histogram?taxon_id=&place_id=6857&quality_grade=research&interval=
  month_of_year` → `{results:{month_of_year:{"1":n,…}}}` (Deathcap UK: July–December).

**Candidates (scored on every test photo):**

| Model | Weights | Input | Why |
|---|---|---|---|
| `BVRA/mobilenetv2_100.in1k_ft_df20_299` | 3.5 M | 299 | the smallest |
| `BVRA/tf_efficientnet_b0.in1k_ft_df20_299` | 6.1 M | 299 | small, usually strong |
| `BVRA/resnet18.in1k_ft_df20_299` | 11.7 M | 299 | a plain middle |
| `BVRA/tf_efficientnet_b3.in1k_ft_df20_299` | 12 M | 299 | the largest phone-sized one |
| `BVRA/vit_base_patch16_224.ft_df20_224` | 86 M | 224 | a ceiling only: what going small costs |

**Files:**

| File | What it does |
|---|---|
| `tools/scan-test/requirements.txt` | the Python packages, pinned |
| `tools/lib/csv.ts` (+ `tests/csv.test.ts`) | reads the DF20 metadata (quoted fields) |
| `tools/lib/df20-classes.ts` (+ `tests/df20-classes.test.ts`) | the model's classes; which of ours each one is |
| `tools/build-class-map.ts` | metadata, older names, UK records and months → `content/model/df20-classes.json` |
| `tools/lib/test-photo-picker.ts` (+ test) | which observations become test photos |
| `tools/fetch-test-photos.ts` | downloads them → `cache/test-photos/` (never published) |
| `src/scan/rules.ts` (+ `src/scan/rules.test.ts`) | spec 6.2, the rules the app will run |
| `tools/scan-test/score.py` | one model's scores for every test photo → `cache/scores/` |
| `tools/lib/scan-metrics.ts` (+ test) | the measures and the threshold choice |
| `tools/evaluate-scan.ts` | → `reports/scan-test.md`, `content/model/scan-settings.json` |
| `tools/scan-test/export_onnx.py` | the chosen models as ONNX (8-bit) → `public/models/` |
| `src/screens/scan-speed.tsx` | the hidden timing page |

---

### Task 1: The Python environment

**Files:** create `tools/scan-test/requirements.txt`; modify `.gitignore`.

- [ ] **Step 1: The requirements**

```
torch==2.14.1
timm==1.0.30
onnx==1.23.2
onnxruntime==1.30.0
onnxscript==0.7.2
huggingface_hub
pillow
numpy
```

Add `tools/scan-test/.venv/` to `.gitignore`.

- [ ] **Step 2: Install and check**

```bash
python3 -m venv tools/scan-test/.venv
tools/scan-test/.venv/bin/pip install -r tools/scan-test/requirements.txt
tools/scan-test/.venv/bin/python -c "import timm, torch; m = timm.create_model('hf-hub:BVRA/mobilenetv2_100.in1k_ft_df20_299', pretrained=True); print(m.num_classes, sum(p.numel() for p in m.parameters()), torch.backends.mps.is_available())"
```
Expected: `1604`, about 4.3 million, and whether the Mac's graphics chip can be used. Then pin the three unpinned
packages to the versions installed (`pip freeze`), so the test can be repeated exactly.

- [ ] **Step 3: Commit** — `chore(scan-test): the Python environment for scoring the models`.

---

### Task 2: The model's species list

**Files:** create `tools/lib/csv.ts`, `tests/csv.test.ts`, `tools/lib/df20-classes.ts`, `tests/df20-classes.test.ts`,
`tools/build-class-map.ts`; modify `tools/lib/inat.ts` + `tests/inat.test.ts` (a dropped connection is retried,
like a busy answer — it stopped a 68-name lookup on 06/10); create `content/model/df20-classes.json`.

- [ ] **Step 1: Failing tests for the CSV reader**

```ts
import { describe, expect, it } from 'vitest';
import { parseCsv } from '../tools/lib/csv.ts';

describe('parseCsv', () => {
  it('reads a header and rows into objects', () => {
    expect(parseCsv('a,b\n1,2\n3,4\n')).toEqual([{ a: '1', b: '2' }, { a: '3', b: '4' }]);
  });
  it('keeps commas, doubled quotes and line breaks inside quoted fields', () => {
    expect(parseCsv('name,place\n"Smith, J","He said ""hi""\nthen left"\n'))
      .toEqual([{ name: 'Smith, J', place: 'He said "hi"\nthen left' }]);
  });
  it('accepts Windows line endings and a missing last line break', () => {
    expect(parseCsv('a,b\r\n1,2')).toEqual([{ a: '1', b: '2' }]);
  });
});
```

- [ ] **Step 2: The reader**

```ts
/** An RFC 4180 reader: quoted fields may hold commas, doubled quotes and line breaks. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  const [head, ...body] = rows;
  if (!head) return [];
  return body.filter((r) => r.length > 1 || r[0] !== '').map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}
```

- [ ] **Step 3: Failing tests for the class list and the matching**

```ts
import { describe, expect, it } from 'vitest';
import { binomial, df20Classes, matchClasses } from '../tools/lib/df20-classes.ts';

const row = (class_id: string, species: string, scientificName: string) => ({ class_id, species, scientificName });

describe('binomial', () => {
  it('takes genus and species from a name with its author', () => {
    expect(binomial('Inocybe lilacina (Peck) Kauffman')).toBe('Inocybe lilacina');
    expect(binomial('Amanita muscaria var. formosa')).toBe('Amanita muscaria');
    expect(binomial('fungus')).toBeNull();
  });
});

describe('df20Classes', () => {
  it('gives one entry per class with its own name, the species it is filed under and its photo count', () => {
    const classes = df20Classes([row('1', 'Inocybe geophylla', 'Inocybe geophylla (Bull.) P.Kumm.'),
      row('0', 'Amanita muscaria', 'Amanita muscaria (L.) Lam.'), row('1', 'Inocybe geophylla', 'Inocybe geophylla (Bull.) P.Kumm.')]);
    expect(classes).toEqual([
      { id: 0, name: 'Amanita muscaria', filedAs: 'Amanita muscaria', photos: 1 },
      { id: 1, name: 'Inocybe geophylla', filedAs: 'Inocybe geophylla', photos: 2 },
    ]);
  });
});

describe('matchClasses', () => {
  const classes = [
    { id: 0, name: 'Inocybe geophylla', filedAs: 'Inocybe geophylla', photos: 9 },
    { id: 1, name: 'Inocybe lilacina', filedAs: 'Inocybe geophylla', photos: 9 },
    { id: 2, name: 'Lepista nuda', filedAs: 'Lepista nuda', photos: 9 },
    { id: 3, name: 'Cantharellus pallens', filedAs: 'Cantharellus cibarius', photos: 9 },
    { id: 4, name: 'Cantharellus cibarius', filedAs: 'Cantharellus cibarius', photos: 9 },
    { id: 5, name: 'Xerocomus oldname', filedAs: 'Boletus edulis', photos: 9 },
  ];
  const ours = [
    { name: 'Inocybe geophylla', olderNames: [] }, { name: 'Inocybe lilacina', olderNames: [] },
    { name: 'Collybia nuda', olderNames: ['Lepista nuda'] }, { name: 'Cantharellus cibarius', olderNames: [] },
    { name: 'Boletus edulis', olderNames: [] },
  ];
  const m = matchClasses(classes, ours);
  it("matches a class on its own name, never the name it is filed under when that name is another class's own", () => {
    expect(m.get(0)).toBe('Inocybe geophylla');
    expect(m.get(1)).toBe('Inocybe lilacina');
    expect(m.get(3)).toBeUndefined();
    expect(m.get(4)).toBe('Cantharellus cibarius');
  });
  it('matches through an older name, and falls back to the filed-under name only when no class owns it', () => {
    expect(m.get(2)).toBe('Collybia nuda');
    expect(m.get(5)).toBe('Boletus edulis');
  });
});
```

- [ ] **Step 4: The class list and matching**

```ts
export type Df20Row = { class_id: string; species: string; scientificName: string };
export type Df20Class = { id: number; name: string; filedAs: string; photos: number };
export type OurSpecies = { name: string; olderNames: string[] };

/** "Inocybe lilacina (Peck) Kauffman" → "Inocybe lilacina". */
export function binomial(scientificName: string): string | null {
  const m = /^([A-Z][a-z]+) ([a-z][a-z-]+)/.exec(scientificName.trim());
  return m ? `${m[1]} ${m[2]}` : null;
}

/** One entry per class number: its own scientific name, the species it is filed under, and its training photos. */
export function df20Classes(rows: Iterable<Df20Row>): Df20Class[] {
  const byId = new Map<number, Df20Class>();
  for (const r of rows) {
    const id = Number(r.class_id);
    const known = byId.get(id);
    if (known) { known.photos++; continue; }
    const filedAs = r.species.trim();
    byId.set(id, { id, name: binomial(r.scientificName) ?? filedAs, filedAs, photos: 1 });
  }
  return [...byId.values()].sort((a, b) => a.id - b.id);
}

/**
 * Which of our species each class is. A class's own name wins (current or older name of ours). The name it is filed
 * under counts only when its own name matches none of ours AND no class carries that name as its own — so a variety
 * filed under its parent species (class 728, Inocybe lilacina) is never taken for the parent.
 */
export function matchClasses(classes: Df20Class[], ours: OurSpecies[]): Map<number, string> {
  const ourByName = new Map<string, string>();
  for (const s of ours) ourByName.set(s.name, s.name);
  for (const s of ours) for (const o of s.olderNames) if (!ourByName.has(o)) ourByName.set(o, s.name);
  const ownNames = new Set(classes.map((c) => c.name));
  const out = new Map<number, string>();
  for (const c of classes) {
    const own = ourByName.get(c.name);
    if (own) out.set(c.id, own);
    else if (!ownNames.has(c.filedAs)) {
      const filed = ourByName.get(c.filedAs);
      if (filed) out.set(c.id, filed);
    }
  }
  return out;
}
```

- [ ] **Step 5: A dropped connection is retried** — in `tools/lib/inat.ts` `getJson`, wrap the `doFetch` call: a
  thrown error (no answer at all) is retried like a 429/5xx, up to `maxTries`, with the same back-off; the last one is
  re-thrown with the address. Test in `tests/inat.test.ts`: a fetch that throws twice then answers returns the answer
  after three tries; one that always throws gives up after `maxTries` with the address in the message.

- [ ] **Step 6: `tools/build-class-map.ts`** — in order, each step cached under `cache/df20/` so a re-run is quick:
  1. `DF20-metadata.zip` downloaded if missing and unzipped with the system `unzip`; `DF20-train_metadata_PROD-2.csv`
     read with `parseCsv` → `df20Classes`.
  2. Our 300 from `content/species-list.json`; their older names from iNaturalist (`olderNames`, cached in
     `cache/df20/older-names.json`) → `matchClasses`.
  3. UK species: `speciesCounts(6857, group)` for every included group of `tools/config/groups.json` (the stage-1
     filter) → name → `{ taxonId, records }`.
  4. Every class not matched to ours and whose own name is not a UK species name is looked up once
     (`/taxa?q=<name>&rank=species&per_page=10`, cached in `cache/df20/taxa-lookup.json`): a result whose `name` or
     `matched_term` equals the class name gives the current name; the class is UK when that name is a UK species.
  5. For each UK class, its UK records by month (`/observations/histogram…`, cached in `cache/df20/months.json`).
  6. Write `content/model/df20-classes.json`:
     `{ "source": …, "built": "YYYY-MM-DD", "classes": [{ "id", "name", "ours", "danger", "uk", "months" }] }` —
     `ours` = our scientific name or null; `danger` from our list's `dangerLevel`; `months` = 12 counts (January first;
     all 0 when not UK). Print: classes, UK classes, ours known (by name / by older name), the dangerous we do not
     know.
  Expected on the first run: 272 of 300 known; the five dangerous listed above unknown.

- [ ] **Step 7: Run the tests and the builder; commit** — `feat(scan-test): the model's species list matched to ours
  (older names included), with UK records and months`.

---

### Task 3: The test photos

**Files:** create `tools/lib/test-photo-picker.ts`, `tests/test-photo-picker.test.ts`, `tools/fetch-test-photos.ts`.

- [ ] **Step 1: Failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { pickTestObservations } from '../tools/lib/test-photo-picker.ts';

const obs = (id: number, login: string, licences: (string | null)[], observed_on: string | null = '2025-10-12') => ({
  id, user: { login }, observed_on,
  photos: licences.map((l, k) => ({ id: id * 10 + k, license_code: l, url: `https://x/photos/${id * 10 + k}/square.jpg` })),
});

describe('pickTestObservations', () => {
  it('skips the guide own observations, photos without an open licence, and observations without a date', () => {
    const picked = pickTestObservations([obs(1, 'a', ['cc-by']), obs(2, 'b', [null]), obs(3, 'c', ['cc-by-nd'], null), obs(4, 'd', ['cc-by-sa'])], new Set([1]), 10);
    expect(picked.map((p) => p.obsId)).toEqual([4]);
  });
  it('takes up to three photos per observation, at 500 px', () => {
    const [p] = pickTestObservations([obs(5, 'a', ['cc0', 'cc-by', 'cc-by-nc', 'cc-by'])], new Set(), 10);
    expect(p.urls).toEqual(['https://x/photos/50/medium.jpg', 'https://x/photos/51/medium.jpg', 'https://x/photos/52/medium.jpg']);
    expect(p.month).toBe(10);
  });
  it('spreads the picks over observers before taking a second from anyone', () => {
    const picked = pickTestObservations([obs(1, 'a', ['cc0']), obs(2, 'a', ['cc0']), obs(3, 'a', ['cc0']), obs(4, 'b', ['cc0'])], new Set(), 3);
    expect(picked.map((p) => p.obsId)).toEqual([1, 4, 2]);
  });
});
```

- [ ] **Step 2: The picker**

```ts
export type TestObservation = {
  id: number;
  user?: { login: string };
  observed_on?: string | null;
  photos: Array<{ id: number; license_code: string | null; url: string }>;
};
export type PickedTest = { obsId: number; month: number; urls: string[] };

const OPEN = new Set(['cc0', 'cc-by', 'cc-by-nc', 'cc-by-sa', 'cc-by-nd', 'cc-by-nc-sa', 'cc-by-nc-nd']);

/** Up to `limit` observations, one per observer before a second from anyone, never one the guide shows; up to three
 * openly licensed photos each, as 500 px addresses. Test photos are only ever kept on the Mac. */
export function pickTestObservations(observations: TestObservation[], exclude: Set<number>, limit: number): PickedTest[] {
  const byObserver = new Map<string, PickedTest[]>();
  for (const o of observations) {
    if (exclude.has(o.id) || !o.observed_on) continue;
    const urls = o.photos.filter((p) => p.license_code && OPEN.has(p.license_code)).slice(0, 3)
      .map((p) => p.url.replace('/square.', '/medium.'));
    if (urls.length === 0) continue;
    const key = o.user?.login ?? `observation ${o.id}`;
    const list = byObserver.get(key) ?? [];
    list.push({ obsId: o.id, month: Number(o.observed_on.slice(5, 7)), urls });
    byObserver.set(key, list);
  }
  const queues = [...byObserver.values()];
  const out: PickedTest[] = [];
  for (let round = 0; out.length < limit; round++) {
    let took = false;
    for (const q of queues) {
      if (round < q.length && out.length < limit) { out.push(q[round]); took = true; }
    }
    if (!took) break;
  }
  return out;
}
```

- [ ] **Step 3: `tools/fetch-test-photos.ts`** — for each of our 300: one page of 200 UK research-grade observations
  with openly licensed photos (`/observations?taxon_id=&place_id=6857&quality_grade=research&photos=true&photo_license
  =cc0,cc-by,cc-by-nc,cc-by-sa,cc-by-nd,cc-by-nc-sa,cc-by-nc-nd&order_by=id&order=desc&per_page=200`); pick 50 for a
  dangerous species, 20 for the rest; exclude every observation the guide's pages show (their photo links). Photos
  are downloaded four at a time to `cache/test-photos/<inatId>/<obsId>-<k>.jpg`, skipping files already there.
  Write `cache/test-photos/index.json`: `[{ species, inatId, obsId, month, files }]`. Print per-species counts and
  the total. Expected: about 6,000 observations and 12,000–15,000 photos (about 1 GB, in `cache/`, never committed).

- [ ] **Step 4: Run; commit the picker, its tests and the script** — `feat(scan-test): pick and download UK test
  photos (not the guide's own, spread over observers)`.

---

### Task 4: The scan rules (spec 6.2)

**Files:** create `src/scan/rules.ts`, `src/scan/rules.test.ts`.

- [ ] **Step 1: Failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { combine, outOfSeason, shortlist, type ClassInfo } from './rules';

const ALL_YEAR = Array(12).fill(5);
const JUL_DEC = [0, 0, 0, 0, 0, 0, 16, 71, 86, 207, 43, 4];
const cls = (id: number, ours: string | null, danger: ClassInfo['danger'] = null, uk = true, months = ALL_YEAR): ClassInfo =>
  ({ id, name: ours ?? `other ${id}`, ours, danger, uk, months });
const T = { safety: 0.05, notSure: 0.3, offSeason: 0.5 };

describe('combine', () => {
  it('averages the scores of up to three photos', () => {
    expect([...combine([[0.2, 0.8], [0.6, 0.4]])]).toEqual([0.4, 0.6000000000000001]);
  });
  it('refuses no photos, and photos scored by different models', () => {
    expect(() => combine([])).toThrow();
    expect(() => combine([[1], [0.5, 0.5]])).toThrow();
  });
});

describe('outOfSeason', () => {
  it('counts the months either side, across the new year', () => {
    expect(outOfSeason(JUL_DEC, 10)).toBe(false);
    expect(outOfSeason(JUL_DEC, 1)).toBe(false); // December has records
    expect(outOfSeason(JUL_DEC, 3)).toBe(true);
  });
});

describe('shortlist', () => {
  const classes = [cls(0, 'A'), cls(1, 'B'), cls(2, 'C'), cls(3, 'D'), cls(4, 'E'), cls(5, 'F'), cls(6, 'Deadly', 'deadly'),
    cls(7, null, null, false), cls(8, 'Seasonal', null, true, JUL_DEC)];
  it('removes species never recorded in the UK and keeps the top five', () => {
    const r = shortlist([0.1, 0.09, 0.08, 0.07, 0.06, 0.05, 0.01, 0.5, 0.02], classes, 10, T);
    expect(r.items.map((i) => i.ours)).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(r.items.some((i) => i.id === 7)).toBe(false);
  });
  it('marks a species down out of season, never out', () => {
    const r = shortlist([0, 0, 0, 0, 0, 0, 0, 0, 0.9], classes, 3, T);
    expect(r.items[0]).toMatchObject({ ours: 'Seasonal', score: 0.45 });
  });
  it('adds a dangerous species above the safety threshold however low it ranks, and says so', () => {
    const r = shortlist([0.2, 0.19, 0.18, 0.17, 0.16, 0.15, 0.06, 0, 0], classes, 10, T);
    expect(r.items.at(-1)).toMatchObject({ ours: 'Deadly', forSafety: true });
    expect(r.dangerous).toBe(true);
  });
  it('judges the safety threshold before the season mark-down', () => {
    const c = [...classes.slice(0, 6), cls(6, 'Deadly', 'deadly', true, JUL_DEC)];
    const r = shortlist([0.2, 0.19, 0.18, 0.17, 0.16, 0.15, 0.06], c, 3, T);
    expect(r.items.at(-1)).toMatchObject({ ours: 'Deadly', forSafety: true });
  });
  it('leaves a dangerous species below the threshold off, and is "not sure" below its threshold', () => {
    const r = shortlist([0.2, 0.19, 0.18, 0.17, 0.16, 0.15, 0.04, 0, 0], classes, 10, T);
    expect(r.items.some((i) => i.ours === 'Deadly')).toBe(false);
    expect(r.notSure).toBe(true);
    expect(r.dangerous).toBe(false);
  });
  it('adds up classes that are the same species of ours', () => {
    const c = [cls(0, 'A'), cls(1, 'A'), cls(2, 'B')];
    const r = shortlist([0.3, 0.3, 0.4], c, 10, T);
    expect(r.items[0]).toMatchObject({ ours: 'A', score: 0.6 });
  });
  it('refuses scores that do not fit the class list', () => {
    expect(() => shortlist([0.5], classes, 10, T)).toThrow();
  });
});
```

- [ ] **Step 2: The rules**

```ts
export type Danger = 'deadly' | 'poisonous' | null;
export type ClassInfo = { id: number; name: string; ours: string | null; danger: Danger; uk: boolean; months: number[] };
export type Thresholds = { safety: number; notSure: number; offSeason: number };
export type ShortlistItem = { id: number; name: string; ours: string | null; danger: Danger; score: number; forSafety: boolean };
export type ScanResult = { items: ShortlistItem[]; notSure: boolean; dangerous: boolean };

export const SHORTLIST = 5;

/** Rule 1: the scores of up to three photos are averaged. */
export function combine(photos: ArrayLike<number>[]): number[] {
  if (photos.length === 0) throw new Error('combine needs at least one photo');
  const n = photos[0].length;
  const out = new Array<number>(n).fill(0);
  for (const p of photos) {
    if (p.length !== n) throw new Error('the photos were scored by different models');
    for (let i = 0; i < n; i++) out[i] += p[i] / photos.length;
  }
  return out;
}

/** Out of season = no UK records in that month or in the months either side (January follows December). */
export function outOfSeason(months: number[], month: number): boolean {
  const at = (m: number) => months[(m - 1 + 12) % 12] ?? 0;
  return at(month - 1) + at(month) + at(month + 1) === 0;
}

/**
 * Rules 2–6 of spec 6.2. Species never recorded in the UK are removed; out of season, marked down; classes that are
 * the same species of ours are added up; the top five are the shortlist; a Poisonous or Deadly species whose score
 * BEFORE the season mark-down is at or above the safety threshold is added however low it ranks; below the "not sure"
 * threshold the scan says so. Both thresholds come from the test, never by hand.
 */
export function shortlist(scores: ArrayLike<number>, classes: ClassInfo[], month: number, t: Thresholds): ScanResult {
  if (scores.length !== classes.length) throw new Error(`scores for ${scores.length} classes, the class list has ${classes.length}`);
  type Entry = { first: ClassInfo; score: number; raw: number };
  const bySpecies = new Map<string, Entry>();
  classes.forEach((c, i) => {
    if (!c.uk) return;
    const raw = scores[i];
    const score = outOfSeason(c.months, month) ? raw * t.offSeason : raw;
    const key = c.ours ?? `class ${c.id}`;
    const e = bySpecies.get(key);
    if (e) { e.score += score; e.raw += raw; } else bySpecies.set(key, { first: c, score, raw });
  });
  const ranked = [...bySpecies.values()].filter((e) => e.score > 0).sort((a, b) => b.score - a.score);
  const item = (e: Entry, forSafety: boolean): ShortlistItem =>
    ({ id: e.first.id, name: e.first.name, ours: e.first.ours, danger: e.first.danger, score: e.score, forSafety });
  const items = ranked.slice(0, SHORTLIST).map((e) => item(e, false));
  for (const e of ranked.slice(SHORTLIST)) if (e.first.danger && e.raw >= t.safety) items.push(item(e, true));
  return { items, notSure: (items[0]?.score ?? 0) < t.notSure, dangerous: items.some((i) => i.danger !== null) };
}
```

- [ ] **Step 3: Run the tests; commit** — `feat(scan): the scan rules of spec 6.2, tested without a model`.

---

### Task 5: Scoring the test photos

**Files:** create `tools/scan-test/score.py`.

- [ ] **Step 1: The scorer**

```python
"""Score every test photo with one model and keep the raw class probabilities (float32, photos x classes).
Usage: score.py <hugging-face id> <input size> [--norm half|imagenet] [--limit N]"""
import argparse, json, pathlib
import numpy as np, timm, torch
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[2]
ap = argparse.ArgumentParser()
ap.add_argument('model'); ap.add_argument('size', type=int)
ap.add_argument('--norm', choices=['half', 'imagenet'], default='half')  # the model cards use 0.5/0.5
ap.add_argument('--limit', type=int, default=0)
a = ap.parse_args()

index = json.loads((ROOT / 'cache/test-photos/index.json').read_text())
files = [f for o in index for f in o['files']][: a.limit or None]
mean, std = ((0.5,) * 3, (0.5,) * 3) if a.norm == 'half' else ((0.485, 0.456, 0.406), (0.229, 0.224, 0.225))
dev = 'mps' if torch.backends.mps.is_available() else 'cpu'
model = timm.create_model(f'hf-hub:{a.model}', pretrained=True).eval().to(dev)
m = torch.tensor(mean, device=dev).view(1, 3, 1, 1)
s = torch.tensor(std, device=dev).view(1, 3, 1, 1)

def load(rel):
    im = Image.open(ROOT / 'cache/test-photos' / rel).convert('RGB').resize((a.size, a.size), Image.BILINEAR)
    return torch.from_numpy(np.asarray(im, dtype=np.float32) / 255.0).permute(2, 0, 1)

out = np.zeros((len(files), model.num_classes), dtype=np.float32)
with torch.no_grad():
    for i in range(0, len(files), 32):
        x = torch.stack([load(f) for f in files[i : i + 32]]).to(dev)
        out[i : i + len(x)] = torch.softmax(model((x - m) / s), dim=1).float().cpu().numpy()
        if i % 640 == 0:
            print(f'{i + len(x)}/{len(files)}', flush=True)

name = a.model.split('/')[-1] + ('' if a.norm == 'half' else '.imagenet') + (f'.first{a.limit}' if a.limit else '')
dst = ROOT / 'cache/scores'
dst.mkdir(parents=True, exist_ok=True)
out.tofile(dst / f'{name}.f32')
(dst / f'{name}.json').write_text(json.dumps({'model': a.model, 'size': a.size, 'norm': a.norm, 'classes': model.num_classes, 'files': files}))
print('wrote', dst / f'{name}.f32')
```

- [ ] **Step 2: The right colour normalisation per model** — score the first 600 photos with `--norm half` and
  `--norm imagenet` for each candidate; `npx tsx tools/evaluate-scan.ts --quick` (Task 6) prints "right first" for
  both; keep the clearly better (the cards say `half`; a model trained otherwise shows it at once).
- [ ] **Step 3: Score every photo with the five candidates** (each a few minutes on the Mac's graphics chip; in the
  background).
- [ ] **Step 4: Commit the scorer** — `feat(scan-test): score the test photos with a candidate model`.

---

### Task 6: The measures, the thresholds and the report

**Files:** create `tools/lib/scan-metrics.ts`, `tests/scan-metrics.test.ts`, `tools/evaluate-scan.ts`; write
`reports/scan-test.md` and `content/model/scan-settings.json`.

- [ ] **Step 1: Failing tests** (small made-up classes: three edibles, one dangerous, one not UK)
  - `measure()` counts *right first* and *on the shortlist* only over observations of species the model knows;
  - *dangerous on the shortlist* counts a dangerous species added for safety;
  - a dangerous species the model does not know counts as *caught by Check* when it is a lookalike of the top match;
  - a *false alarm* = a non-dangerous observation where a dangerous species was added for safety;
  - `chooseSafety()` picks the HIGHEST grid value that keeps dangerous species on the list ≥ 98 in 100, and says
    "none" when even 0 does not (an unknown species can never be on the list);
  - `chooseNotSure()` picks the LOWEST top score above which the first answer is right ≥ 90 in 100;
  - observations split into tuning and checking halves by observation number (even / odd).

- [ ] **Step 2: The measures** — `tools/lib/scan-metrics.ts`:

```ts
import { combine, shortlist, type ClassInfo, type Thresholds } from '../../src/scan/rules.ts';

export type Case = { obsId: number; species: string; month: number; photos: ArrayLike<number>[] };
export type Measures = {
  cases: number; known: number; rightFirst: number; onList: number;
  dangerKnown: number; dangerOnList: number; dangerUnknown: number; dangerCaughtByCheck: number;
  safeCases: number; falseAlarms: number; sure: number; rightWhenSure: number;
};
export const SAFETY_GRID = [0.5, 0.3, 0.2, 0.1, 0.05, 0.03, 0.02, 0.01, 0.005, 0.002, 0.001, 0.0005, 0.0002, 0.0001, 0];
export const NOT_SURE_GRID = [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
export const PASS_MARK = 0.98;
export const SURE_TARGET = 0.9;

export const tuningHalf = (cases: Case[]) => cases.filter((c) => c.obsId % 2 === 0);
export const checkingHalf = (cases: Case[]) => cases.filter((c) => c.obsId % 2 === 1);

/** Spec 6.3 measured on `cases` with up to `photos` photos each; `lookalikes` = our pairs, both ways. */
export function measure(cases: Case[], classes: ClassInfo[], danger: Map<string, 'deadly' | 'poisonous'>,
  lookalikes: Map<string, string[]>, t: Thresholds, photos: 1 | 3): Measures {
  const knownSpecies = new Set(classes.filter((c) => c.ours).map((c) => c.ours as string));
  const m: Measures = { cases: 0, known: 0, rightFirst: 0, onList: 0, dangerKnown: 0, dangerOnList: 0, dangerUnknown: 0,
    dangerCaughtByCheck: 0, safeCases: 0, falseAlarms: 0, sure: 0, rightWhenSure: 0 };
  for (const c of cases) {
    const r = shortlist(combine(c.photos.slice(0, photos)), classes, c.month, t);
    const top = r.items[0]?.ours ?? null;
    const onList = r.items.some((i) => i.ours === c.species);
    m.cases++;
    if (!r.notSure) { m.sure++; if (top === c.species) m.rightWhenSure++; }
    if (danger.has(c.species)) {
      if (knownSpecies.has(c.species)) { m.dangerKnown++; if (onList) m.dangerOnList++; }
      else { m.dangerUnknown++; if (top && (lookalikes.get(top) ?? []).includes(c.species)) m.dangerCaughtByCheck++; }
    } else {
      m.safeCases++;
      if (r.items.some((i) => i.forSafety)) m.falseAlarms++;
    }
    if (!knownSpecies.has(c.species)) continue;
    m.known++;
    if (top === c.species) m.rightFirst++;
    if (onList) m.onList++;
  }
  return m;
}

/** The highest safety threshold that keeps known dangerous species on the shortlist at least 98 in 100, or null. */
export function chooseSafety(cases: Case[], classes: ClassInfo[], danger: Map<string, 'deadly' | 'poisonous'>,
  lookalikes: Map<string, string[]>, base: Thresholds): number | null {
  for (const safety of SAFETY_GRID) {
    const m = measure(cases, classes, danger, lookalikes, { ...base, safety }, 3);
    if (m.dangerKnown > 0 && m.dangerOnList / m.dangerKnown >= PASS_MARK) return safety;
  }
  return null;
}

/** The lowest "not sure" threshold above which the first answer is right at least 90 in 100. */
export function chooseNotSure(cases: Case[], classes: ClassInfo[], danger: Map<string, 'deadly' | 'poisonous'>,
  lookalikes: Map<string, string[]>, base: Thresholds): number {
  for (const notSure of NOT_SURE_GRID) {
    const m = measure(cases, classes, danger, lookalikes, { ...base, notSure }, 3);
    if (m.sure > 0 && m.rightWhenSure / m.sure >= SURE_TARGET) return notSure;
  }
  return NOT_SURE_GRID.at(-1) as number;
}
```

  (`chooseSafety` uses `SAFETY_GRID` from high to low, so the first that passes is the highest.)

- [ ] **Step 3: `tools/evaluate-scan.ts`** — reads `content/model/df20-classes.json`, `cache/test-photos/index.json`,
  every `cache/scores/*.json` + `.f32` (copied into a `Float32Array`; rows in the index's file order), our pairs from
  `tools/config/core-lists.json` (both ways) and our danger levels. `--quick`: right first per score file, nothing
  written. Otherwise, per model: the off-season factor (from 1, 0.7, 0.5, 0.3: best right first on the tuning half),
  the two thresholds from the tuning half, then every measure on the checking half with one photo and with up to
  three. Writes `reports/scan-test.md` (per model; the pass mark met or not; false alarms; not-sure share; coverage
  and the species the model cannot recognise; how each unknown dangerous species fared through Check) and
  `content/model/scan-settings.json` for the best phone-sized model that passes
  (`{ model, thresholds, record: { rightFirst, onList, dangerOnList, … }, tested }`) — or `{ "passed": false, … }`.

- [ ] **Step 4: Run; read the report; commit** — `feat(scan-test): measures, thresholds from the test, and the
  report`.

---

### Task 7: The models as ONNX, shrunk to 8 bits

**Files:** create `tools/scan-test/export_onnx.py`; add `public/models/*.onnx` for the two best phone-sized models.

- [ ] **Step 1: Export** — wrap each model so the file takes pixels in 0–1 and returns probabilities (the colour
  normalisation and softmax inside); `torch.onnx.export` at the model's size, batch 1; check against PyTorch on 10
  test photos (largest difference under 1e-4).
- [ ] **Step 2: Shrink** — `onnxruntime.quantization.quantize_static` (QDQ, 8-bit), calibrated on 200 test photos
  from the tuning half; then score the checking half with the 8-bit file (onnxruntime in Python) and run Task 6's
  measures on it: the 8-bit model must keep the pass mark and lose at most 1 point of "right first".
- [ ] **Step 3: Commit** the 8-bit files (a few MB each; CC BY-NC 4.0, credited on the About page) —
  `feat(scan-test): the two best phone-sized models as 8-bit ONNX`.

---

### Task 8: The speed test on the iPhone

**Files:** create `src/screens/scan-speed.tsx`; modify `src/router.ts` (+ test), `src/app.tsx`,
`src/screens/about.tsx`, `e2e/app.spec.ts`, `package.json` (`onnxruntime-web@1.30.0`).

- [ ] **Step 1: The page** (`#/scan-speed`, linked from About as "Scan speed test"): loads a model file from
  `public/models/` only when its button is pressed (onnxruntime-web, imported lazily; WebGPU first, else
  single-threaded WebAssembly — GitHub Pages cannot send the headers threads need), draws a guide photo
  (`photos/deathcap/1.webp`) at the model's size, runs once to warm up, then a three-photo scan (three runs), and shows:
  the time per photo and for the scan, which engine ran it, the file size, and the top three names (a sanity check:
  the Deathcap's own photo should name the Deathcap).
- [ ] **Step 2: Browser test** — in both engines the page loads the smaller model and shows a time and "Deathcap" in
  the top three.
- [ ] **Step 3: Publish; Stefan opens About → Scan speed test on his iPhone** and reads the three numbers back.
  Target (spec 6.1): a three-photo scan in about 3 seconds.
- [ ] **Step 4: Commit** — `feat(scan-test): a hidden speed test page for the iPhone`.

---

### Task 9: The report to Stefan

- [ ] Add his iPhone timings to `reports/scan-test.md`; record the stage-3 proofs in spec §14 (which of the 300 the
  model knows; whether a candidate passes the pass mark); memory; and give him the plain-English summary: which
  model, its measured record, the species it cannot recognise, and whether the scan can be switched on. **The scan is
  switched on only after he has seen it (spec 6.3).**

---

## Self-review

- **Spec coverage:** 6.1 (candidates, 8-bit, the iPhone timing, names matched with older names, "not in the guide"
  handled by `ours: null`), 6.2 (every rule in `rules.ts`, both thresholds from the test), 6.3 (test photos not in the
  guide, capped per species, the three measures, coverage, the pass mark, his review before switch-on), §14 stage 2
  and 3 proofs.
- **Left for plan 2d-2:** the Scan screen (camera, three photos, the shortlist, the red banner, "not sure" → Identify)
  and the Check screen.
- **Names:** `parseCsv`, `binomial`, `df20Classes`, `matchClasses`, `pickTestObservations`, `combine`, `outOfSeason`,
  `shortlist`, `measure`, `chooseSafety`, `chooseNotSure`, `tuningHalf`, `checkingHalf` — each defined once, used
  with the same signature.
