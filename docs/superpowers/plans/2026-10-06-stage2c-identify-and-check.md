# Stage 2c: Identify and Check — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two parts of the app that need no photo model (spec 4.2, 8): **Identify** — simple questions one at a time,
each with drawings, the list of species narrowing with every answer, "Not sure" always allowed and never narrowing;
and **Check** — a species side by side with its lookalikes, one row per feature, where every feature he ticks that
fits a lookalike better is flagged red, ending with "Before eating, get it confirmed".

**Architecture:** The rules are pure TypeScript, tested without a browser: `src/spore.ts` (spore print colour groups
read from our own words), `src/identify.ts` (the questions, the matching, the narrowing and the safety rule),
`src/check.ts` (the side-by-side table and the verdict on his ticks). Two screens draw them: `#/identify?…` (the
answers live in the address, so Back works and a reload keeps them) and `#/check/<slug>`. Drawings are inline SVG in
one file. The content check refuses a spore print text that names no colour group.

**Tech:** Preact, Vitest, Playwright (Safari's engine at iPhone size, and Chromium), as in stage 2a.

**Decisions taken here (within the approved spec, told to Stefan):**
- **A dangerous lookalike is never dropped by an answer.** Every Deadly or Poisonous lookalike of a species that
  still matches stays on the list, marked "kept because it is mistaken for …". Rings fall off and the Deathcap's bag
  hides under the soil: a wrong "no ring" or "no bag" must never quietly remove it. Lookalikes without a page yet are
  listed by name with "not in the guide yet".
- **No edibility words on Identify or Check** (spec 6.2-8 and 9 say it of Scan and Check; Identify's list is the
  same kind of shortlist). Only the danger tags (Deadly, Poisonous) show; the species page keeps its facts.
- **Near misses are shown:** below the species that match every answer, those that match all but one, with the
  answer that differs — beginners misread features, and the list must not end empty for one slip.
- **Spore print colour groups are read from our own words** (`white`, `cream`, `pink`, `rusty`, `chocolate`,
  `purple-brown`, `black` …), not stored twice; plain "brown" counts as both brown groups so it never wrongly
  excludes. The content check fails on a spore text that names no group.
- Season is not asked: the guide's "in season now" covers it, and a season answer would wrongly drop a species
  found in an unusual month.

**Files:**

| File | What it does |
|---|---|
| `src/spore.ts` (+ `src/spore.test.ts`) | spore print text → colour groups |
| `src/identify.ts` (+ `src/identify.test.ts`) | the questions, matching one species, narrowing the list, the safety rule |
| `src/check.ts` (+ `src/check.test.ts`) | the side-by-side table, the verdict on his ticks |
| `src/router.ts` (+ test) | `identify` carries its answers; new `check` route |
| `src/screens/drawings.tsx` | the drawings for the answers |
| `src/screens/identify.tsx`, `src/screens/check.tsx` | the two screens |
| `src/screens/species-page.tsx` | a "Check a mushroom against this one" button |
| `src/styles.css` | answer buttons, the side-by-side table, ticks |
| `tools/check-content.ts` / `tools/lib/species-record.ts` | the spore text must name a group |
| `e2e/app.spec.ts` | the two screens in both browser engines |

---

### Task 1: Spore print colour groups

**Files:** create `src/spore.ts`, `src/spore.test.ts`.

- [ ] **Step 1: Failing tests** — every spore text of the ten sample pages, and the edge cases:

```ts
import { describe, expect, it } from 'vitest';
import { sporeGroups } from './spore';

describe('sporeGroups', () => {
  it.each([
    ['White', ['white']],
    ['White to cream', ['white']],
    ['White to pale cream', ['white']],
    ['Pale yellow to cream', ['white']],
    ['Rusty brown', ['brown']],
    ['Chocolate brown', ['dark']],
    ['Dark brown', ['dark']],
    ['Dark purple-brown to chocolate brown', ['dark']],
    ['Salmon pink', ['pink']],
    ['Ochre to tobacco brown', ['brown']],
    ['Black', ['dark']],
  ])('%s → %j', (text, groups) => expect(sporeGroups(text)).toEqual(groups));
  it('plain "brown" counts as both brown groups, so it never wrongly excludes', () => {
    expect(sporeGroups('Brown')).toEqual(['brown', 'dark']);
  });
  it('names no group for words it does not know', () => expect(sporeGroups('Varies')).toEqual([]));
});
```

- [ ] **Step 2: The groups**

```ts
// Spore print colour, read from the guide's own words into the four groups Identify asks about. A colour named in
// a range ("white to cream", "rusty brown") adds its group; plain "brown" adds both brown groups, so a vague text
// never removes a species. The content check refuses a text that names no group.
export type SporeGroup = 'white' | 'pink' | 'brown' | 'dark';
export const SPORE_GROUPS: SporeGroup[] = ['white', 'pink', 'brown', 'dark'];

const WORDS: Array<[RegExp, SporeGroup[]]> = [
  [/\b(white|whitish|cream|creamy|pale yellow)\b/, ['white']],
  [/\b(pink|pinkish|salmon)\b/, ['pink']],
  [/\b(rust|rusty|ochre|cinnamon|clay|tobacco|snuff|orange-brown|yellow-brown|yellowish-brown)\b/, ['brown']],
  [/\b(chocolate|purple|purplish|black|blackish|sepia|dark brown|purple-brown)\b/, ['dark']],
  [/(?<!(dark|chocolate|purple|purplish|rusty|rust|orange|yellow|yellowish|cinnamon|tobacco|snuff|clay)[- ])\bbrown\b/, ['brown', 'dark']],
];

export function sporeGroups(text: string): SporeGroup[] {
  const t = text.toLowerCase();
  const found = new Set<SporeGroup>();
  for (const [re, groups] of WORDS) if (re.test(t)) groups.forEach((g) => found.add(g));
  return SPORE_GROUPS.filter((g) => found.has(g));
}
```

- [ ] **Step 3: Run; commit** — `feat(identify): spore print colour groups from the guide's own words`.

---

### Task 2: The content check knows the groups

**Files:** modify `tools/lib/species-record.ts` (+ its test).

- [ ] **Step 1: Failing test** — a record whose spore print text is "Varies" is refused with
  `sporePrint: "Varies" names no colour group Identify can ask about`.
- [ ] **Step 2:** in the record check, `if (sporeGroups(r.sporePrint.value).length === 0)` add that problem.
- [ ] **Step 3: Run `npm test` and `npm run check-content`; commit** — `feat(content): a spore print text must name a
  colour group`.

---

### Task 3: The Identify rules

**Files:** create `src/identify.ts`, `src/identify.test.ts`.

- [ ] **Step 1: Failing tests** (made-up records built by a helper `rec(slug, features, edibility, lookalikes)`):
  - with no answers every species matches;
  - "Not sure" never narrows;
  - underside, grows on: exact; ring: "yes" keeps yes and sometimes, "no" keeps no and sometimes; bag: exact;
  - cap: a band keeps every species whose range touches it (a 5–15 cm cap matches "under 5 cm" at 5);
  - spore: keeps a species whose text names the group;
  - a species matching all answers but one is a near miss, with the question it differs on; two differences: gone;
  - **the safety rule:** when the Field Mushroom matches and the Deathcap does not (answer: no bag), the Deathcap is
    still listed, `keptFor: ['Field Mushroom']`; a Deadly lookalike with no page is listed by name, `slug: null`;
  - an edible lookalike is NOT kept (only Deadly and Poisonous ones);
  - the answers read from and written to the address round-trip (`answersFromQuery` / `queryFromAnswers`), unknown
    values dropped.

- [ ] **Step 2: The rules**

```ts
import type { LookalikeKind, SpeciesRecord } from './types';
import { sporeGroups, type SporeGroup } from './spore';

export type QuestionId = 'underside' | 'growsOn' | 'ring' | 'bag' | 'cap' | 'spore';
export type Option = { value: string; label: string; drawing: string };
export type Question = { id: QuestionId; title: string; hint: string; options: Option[]; unsureLabel: string };
export type Answers = Partial<Record<QuestionId, string>>; // 'unsure' = answered "Not sure"
export const UNSURE = 'unsure';

export const QUESTIONS: Question[] = [
  { id: 'underside', title: 'What is under the cap?', hint: 'Look at the underside: blades, a sponge, spines, or blunt folds that run down the stem.',
    unsureLabel: 'Not sure', options: [
      { value: 'gills', label: 'Gills (thin blades)', drawing: 'gills' },
      { value: 'pores', label: 'Pores (a sponge)', drawing: 'pores' },
      { value: 'teeth', label: 'Teeth (spines)', drawing: 'teeth' },
      { value: 'ridges', label: 'Ridges (blunt, forked folds)', drawing: 'ridges' },
      { value: 'smooth', label: 'Smooth', drawing: 'smooth' },
      { value: 'other', label: 'Something else (no cap: a ball, a cup, a crust)', drawing: 'other' } ] },
  { id: 'growsOn', title: 'What is it growing on?', hint: 'If it might be growing from buried wood or roots, choose Not sure.',
    unsureLabel: 'Not sure', options: [
      { value: 'ground', label: 'The ground (soil, grass, leaves)', drawing: 'ground' },
      { value: 'wood', label: 'Wood (a tree, stump, log or branch)', drawing: 'wood' },
      { value: 'other-fungi', label: 'Another mushroom', drawing: 'other-fungi' },
      { value: 'dung', label: 'Dung', drawing: 'dung' } ] },
  { id: 'ring', title: 'Is there a ring on the stem?', hint: 'A ring is a skirt of tissue around the stem. Rings can fall off or be washed away: if there might have been one, choose Not sure.',
    unsureLabel: 'Not sure', options: [
      { value: 'yes', label: 'Yes, a ring', drawing: 'ring' },
      { value: 'no', label: 'No ring, and no trace of one', drawing: 'no-ring' } ] },
  { id: 'bag', title: 'Is there a bag at the base of the stem?', hint: 'Deadly Amanitas hide a cup-like bag under the soil. Dig gently around the base to see it; never cut the stem.',
    unsureLabel: 'Not sure, I did not dig out the base', options: [
      { value: 'yes', label: 'Yes, a bag or cup', drawing: 'bag' },
      { value: 'no', label: 'No bag: I dug out the whole base', drawing: 'no-bag' } ] },
  { id: 'cap', title: 'How wide is the cap?', hint: 'Across the top, at its widest.', unsureLabel: 'Not sure', options: [
      { value: 'small', label: 'Under 5 cm', drawing: 'cap-small' },
      { value: 'medium', label: '5 to 10 cm', drawing: 'cap-medium' },
      { value: 'large', label: 'Over 10 cm', drawing: 'cap-large' } ] },
  { id: 'spore', title: 'What colour is its spore print?', hint: 'Leave the cap gills-down on white and dark paper for a few hours (see Learn).',
    unsureLabel: 'I have not made one', options: [
      { value: 'white', label: 'White or cream', drawing: 'spore-white' },
      { value: 'pink', label: 'Pink', drawing: 'spore-pink' },
      { value: 'brown', label: 'Brown (rusty, ochre)', drawing: 'spore-brown' },
      { value: 'dark', label: 'Dark (chocolate, purple-brown, black)', drawing: 'spore-dark' } ] },
];

const BANDS: Record<string, [number, number]> = { small: [0, 5], medium: [5, 10], large: [10, Infinity] };

/** Does one species fit one answer? "Not sure" and no answer always fit. */
export function fits(s: SpeciesRecord, q: QuestionId, answer: string | undefined): boolean {
  if (answer === undefined || answer === UNSURE) return true;
  const f = s.features;
  switch (q) {
    case 'underside': return f.underside.value === answer;
    case 'growsOn': return f.growsOn.value === answer;
    case 'ring': return f.ring.value === answer || f.ring.value === 'sometimes';
    case 'bag': return f.bagAtBase.value === answer;
    case 'cap': { const [lo, hi] = BANDS[answer] ?? [0, Infinity]; const [a, b] = f.capCm.value; return a <= hi && b >= lo; }
    case 'spore': return sporeGroups(s.sporePrint.value).includes(answer as SporeGroup);
  }
}

export type Listed = { slug: string | null; english: string; scientific: string; danger: 'deadly' | 'poisonous' | null;
  differsOn?: QuestionId; keptFor?: string[] };
export type Narrowed = { matches: Listed[]; kept: Listed[]; nearMisses: Listed[] };

const dangerOf = (e: string): Listed['danger'] => (e === 'deadly' ? 'deadly' : e === 'poisonous' ? 'poisonous' : null);
const DANGEROUS: LookalikeKind[] = ['deadly', 'poisonous'];

/** The species that fit every answer; every dangerous lookalike of those, kept; and the near misses (all but one). */
export function narrow(all: SpeciesRecord[], answers: Answers): Narrowed {
  const ids = QUESTIONS.map((q) => q.id);
  const listed = (s: SpeciesRecord): Listed => ({ slug: s.slug, english: s.english, scientific: s.scientific, danger: dangerOf(s.edibility.value) });
  const matches: Listed[] = [];
  const nearMisses: Listed[] = [];
  const matched: SpeciesRecord[] = [];
  for (const s of all) {
    const wrong = ids.filter((q) => !fits(s, q, answers[q]));
    if (wrong.length === 0) { matches.push(listed(s)); matched.push(s); }
    else if (wrong.length === 1) nearMisses.push({ ...listed(s), differsOn: wrong[0] });
  }
  const kept = new Map<string, Listed>();
  for (const s of matched) {
    for (const l of s.lookalikes) {
      if (!DANGEROUS.includes(l.kind) || matches.some((m) => m.scientific === l.scientific)) continue;
      const page = l.slug ? all.find((x) => x.slug === l.slug) : undefined;
      const k = kept.get(l.scientific) ?? { slug: page ? page.slug : null, english: l.english, scientific: l.scientific,
        danger: l.kind as 'deadly' | 'poisonous', keptFor: [] };
      k.keptFor!.push(s.english);
      kept.set(l.scientific, k);
    }
  }
  const keptList = [...kept.values()];
  return { matches, kept: keptList, nearMisses: nearMisses.filter((n) => !kept.has(n.scientific)) };
}

/** The answers in the address (`#/identify?underside=gills&ring=unsure`); anything unknown is dropped. */
export function answersFromQuery(qs: URLSearchParams): Answers {
  const out: Answers = {};
  for (const q of QUESTIONS) {
    const v = qs.get(q.id);
    if (v && (v === UNSURE || q.options.some((o) => o.value === v))) out[q.id] = v;
  }
  return out;
}
export function queryFromAnswers(a: Answers): string {
  return new URLSearchParams(QUESTIONS.filter((q) => a[q.id]).map((q) => [q.id, a[q.id] as string])).toString();
}
/** The first question not answered yet, or null when all are. */
export const nextQuestion = (a: Answers) => QUESTIONS.find((q) => a[q.id] === undefined) ?? null;
```

- [ ] **Step 3: Run; commit** — `feat(identify): the questions and the narrowing, dangerous lookalikes never dropped`.

---

### Task 4: The Check rules

**Files:** create `src/check.ts`, `src/check.test.ts`.

- [ ] **Step 1: Failing tests** (the real Field Mushroom record from `content/species/field-mushroom.json`):
  - columns: the species first, then each lookalike in the record's order, with its kind and page;
  - rows: every "tell apart" feature once, in order of first appearance; the species' own words for the feature
    (two different wordings joined with " · "); a lookalike with no row for a feature has no cell (`null`);
  - verdict: ticking the species' cell in every row → `fitsLookalike: []`; ticking a lookalike's cell → that row is
    flagged and the lookalike named; nothing ticked → `ticked: 0`.

- [ ] **Step 2: The rules**

```ts
import type { LookalikeKind, SpeciesRecord } from './types';

export type Column = { english: string; scientific: string; slug: string | null; kind: LookalikeKind | null }; // null = the species
export type Row = { feature: string; cells: Array<string | null> };
export type Table = { columns: Column[]; rows: Row[] };

/** The species side by side with its lookalikes: one row per "tell apart" feature, in order of first appearance. */
export function checkTable(s: SpeciesRecord): Table {
  const columns: Column[] = [{ english: s.english, scientific: s.scientific, slug: s.slug, kind: null },
    ...s.lookalikes.map((l) => ({ english: l.english, scientific: l.scientific, slug: l.slug, kind: l.kind }))];
  const rows: Row[] = [];
  s.lookalikes.forEach((l, i) => {
    for (const r of l.tellApart) {
      let row = rows.find((x) => x.feature.toLowerCase() === r.feature.toLowerCase());
      if (!row) { row = { feature: r.feature, cells: columns.map(() => null) }; rows.push(row); }
      const own = row.cells[0];
      if (own === null) row.cells[0] = r.thisOne;
      else if (!own.split(' · ').includes(r.thisOne)) row.cells[0] = `${own} · ${r.thisOne}`;
      row.cells[i + 1] = r.thatOne;
    }
  });
  return { columns, rows };
}

export type Verdict = { ticked: number; fitsSpecies: number; fitsLookalike: Array<{ feature: string; lookalike: Column }> };

/** His ticks: row index → the column he ticked (0 = the species). */
export function verdict(t: Table, ticks: Map<number, number>): Verdict {
  const v: Verdict = { ticked: 0, fitsSpecies: 0, fitsLookalike: [] };
  for (const [row, col] of ticks) {
    if (!t.rows[row] || t.rows[row].cells[col] == null) continue;
    v.ticked++;
    if (col === 0) v.fitsSpecies++;
    else v.fitsLookalike.push({ feature: t.rows[row].feature, lookalike: t.columns[col] });
  }
  return v;
}
```

- [ ] **Step 3: Run; commit** — `feat(check): the side-by-side table and the verdict on his ticks`.

---

### Task 5: Routes

**Files:** modify `src/router.ts`, `src/router.test.ts`.

- [ ] **Step 1: Failing tests** — `#/identify?underside=gills&ring=unsure` → `{ name: 'identify', query: 'underside=gills&ring=unsure' }`;
  `#/identify` → `query: ''`; `#/check/field-mushroom` → `{ name: 'check', slug: 'field-mushroom' }`; `hrefFor` returns
  them unchanged.
- [ ] **Step 2:** `identify` becomes `{ name: 'identify'; query: string }` (the screen reads the answers with
  `answersFromQuery`), `check` is `{ name: 'check'; slug: string }`; the Identify tab links to `#/identify`.
- [ ] **Step 3: Run; commit** — `feat(router): Identify keeps its answers in the address; the Check route`.

---

### Task 6: The drawings

**Files:** create `src/screens/drawings.tsx`.

- [ ] One `Drawing({ name })` component: line drawings on a 64 × 64 grid in the app's colours (stroke `currentColor`,
  2 px), one per `drawing` name in `QUESTIONS` — the underside seen from below for gills, pores, teeth, ridges and
  smooth; a puffball for "something else"; a mushroom on soil, on a log, on another mushroom, on dung; a stem with
  and without a ring; a base with a cup and a plain base; three caps against a 10 cm ruler; four filled squares for
  the spore colours (white with an outline, pink #e8a9a0, rusty brown #a0612c, dark #3b2a24).
- [ ] A unit test renders each drawing name used by `QUESTIONS` and fails on a name with no drawing.
- [ ] Commit — `feat(identify): drawings for every answer`.

---

### Task 7: The Identify screen

**Files:** create `src/screens/identify.tsx`; modify `src/app.tsx`, `src/styles.css`.

- [ ] **Step 1: The screen.** Reads the answers from the route. While a question is unanswered: its title, hint, one
  large button per option (drawing + label) and the "Not sure" button; each press sets the address to the answers
  plus this one. Above it: "N species fit so far" (matches + kept) and a "Show them now" link (`…&show=1`). Below:
  the answers so far, each with "change" (the address without that answer and those after it). When every question
  is answered, or `show=1`: the results — "Fit every answer" (rows like the guide's, photo, names, the danger tag
  only), "Kept because they are mistaken for …" (red edge; a lookalike without a page shows "not in the guide yet"),
  "Fit all but one answer" (names the differing answer); every row with a page has "Check" (to `#/check/<slug>`);
  then "Start again". No edibility words.
- [ ] **Step 2: Styles** — `.choices` (two columns of big buttons on a phone), `.choice svg`, `.kept` (red left edge).
- [ ] **Step 3: Commit** — `feat(identify): the screen, one question at a time`.

---

### Task 8: The Check screen

**Files:** create `src/screens/check.tsx`; modify `src/app.tsx`, `src/screens/species-page.tsx`, `src/styles.css`.

- [ ] **Step 1: The screen.** Heading "Check: <species>" (with its danger tag if it is Deadly or Poisonous; no other
  edibility words). "Tap what you see on your mushroom, row by row." The table: first column the feature, then the
  species, then each lookalike (its name links to its page when there is one, with its danger tag). Each cell with
  words is a button; tapping marks it ticked (one per row; tap again to clear). A row ticked on a lookalike's cell
  turns red. Under the table, the verdict: any red → a red box "Some features fit <names> better. Treat it as
  <names>: do not eat it."; all ticks on the species → "Every feature you ticked fits <species>. That is not proof."
  Always last, a box: "Before eating any wild mushroom, get it confirmed by someone who knows mushrooms, in person,
  or post your photos to iNaturalist and wait for the community's identification." with a link to iNaturalist.
- [ ] **Step 2:** the species page gets a button under the lookalikes: "Check a mushroom against this one".
- [ ] **Step 3: Commit** — `feat(check): the side-by-side check, red when a feature fits a lookalike`.

---

### Task 9: Browser tests, publish, his try

**Files:** modify `e2e/app.spec.ts`.

- [ ] **Step 1:** In both engines: Identify — answering gills, ground, "no ring", "no bag" leaves the Field Mushroom
  and keeps the Deathcap and the Destroying Angel "Kept because …"; "Not sure" on every question lists all ten;
  "change" takes an answer back. Check — the Field Mushroom against its lookalikes: tapping the Deathcap's gill cell
  turns the row red and shows "Treat it as Deathcap"; the page never shows "safe" or an edibility word.
- [ ] **Step 2:** `npm run typecheck`, `npm test`, `npm run check-content`, `npm run build`, `npm run e2e`; push;
  the publish run passes; the live site answers.
- [ ] **Step 3:** Stefan tries Identify and Check on his iPhone.
