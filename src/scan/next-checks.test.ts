import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { QUESTIONS, UNSURE } from '../identify';
import type { Features, SpeciesRecord } from '../types';
import { checksFor, dangerFirst, differences, standing, type Candidate, type Danger } from './next-checks';

const src = { sources: ['a', 'b'] };
function rec(english: string, f: Partial<Record<keyof Features, unknown>>, more: { spore?: string; habitat?: string } = {}): SpeciesRecord {
  const slug = english.toLowerCase().replace(/\s+/g, '-');
  const feature = <T,>(k: keyof Features, d: T) => ({ value: (k in f ? f[k] : d) as T, ...src });
  return {
    slug, inatId: 1, scientific: `Genus ${slug}`, english, olderNames: [],
    edibility: { value: 'not-edible', ...src }, edibilityNote: null, protectedInUk: { value: false, ...src },
    topPoints: [], habitat: { value: more.habitat ?? 'Woods', ...src }, seasonMonths: { value: [9], ...src },
    sporePrint: { value: more.spore ?? 'White', ...src },
    features: {
      underside: feature('underside', 'gills'), ring: feature('ring', 'no'), bagAtBase: feature('bagAtBase', 'no'),
      growsOn: feature('growsOn', 'ground'), capCm: feature('capCm', [3, 8]), fleshChange: feature('fleshChange', 'White'),
      smell: feature('smell', 'None'),
    } as Features,
    lookalikes: [], noDangerousLookalike: null, photos: [], sources: [], checked: '2026-10-09',
  };
}
const cand = (s: SpeciesRecord, danger: Danger = null): Candidate => ({ s, danger });
const names = (list: Candidate[]) => list.map((c) => c.s.english);

const deathcap = cand(rec('Deathcap', { ring: 'yes', bagAtBase: 'yes', capCm: [5, 15] }), 'deadly');
const field = cand(rec('Field Mushroom', { ring: 'sometimes', capCm: [3, 10] }, { spore: 'Chocolate brown' }));
const blusher = cand(rec('Blusher', { ring: 'yes', capCm: [5, 15] }));
const panther = cand(rec('Panthercap', { ring: 'yes', bagAtBase: 'yes', capCm: [5, 10] }), 'poisonous');

describe('checksFor', () => {
  it('offers only the questions that tell the candidates apart, and only answers one of them fits', () => {
    const checks = checksFor([field, blusher, deathcap]);
    const ids = checks.map((c) => c.question.id);
    expect(ids).not.toContain('underside'); // all three have gills
    expect(ids).not.toContain('growsOn'); // all on the ground
    expect(ids).toEqual(expect.arrayContaining(['ring', 'bag', 'spore']));
    for (const c of checks) for (const o of c.options) expect(o.fit.length).toBeGreaterThan(0);
    const bag = checks.find((c) => c.question.id === 'bag')!;
    expect(bag.options.map((o) => [o.option.value, names(o.fit)])).toEqual([
      ['yes', ['Deathcap']], ['no', ['Field Mushroom', 'Blusher']],
    ]);
  });

  it('puts the check that leaves the fewest first, and the spore print last however well it splits', () => {
    // The spore print alone would leave one species whatever the answer; it still comes last (it takes hours).
    const a = cand(rec('A', { ring: 'yes', bagAtBase: 'no' }, { spore: 'White' }));
    const b = cand(rec('B', { ring: 'yes', bagAtBase: 'yes' }, { spore: 'Pink' }));
    const c = cand(rec('C', { ring: 'no', bagAtBase: 'yes' }, { spore: 'Rusty brown' }));
    const d = cand(rec('D', { ring: 'no', bagAtBase: 'no' }, { spore: 'Black' }));
    expect(checksFor([a, b, c, d]).map((x) => x.question.id)).toEqual(['ring', 'bag', 'spore']);
    // A ring that splits 1 from 3 leaves more on average than a bag that splits 2 from 2: the bag comes first.
    const e = cand(rec('E', { ring: 'yes', bagAtBase: 'yes' }));
    const f = cand(rec('F', { ring: 'no', bagAtBase: 'yes' }));
    const g = cand(rec('G', { ring: 'no', bagAtBase: 'no' }));
    const h = cand(rec('H', { ring: 'no', bagAtBase: 'no' }));
    const checks = checksFor([e, f, g, h]);
    expect(checks.map((x) => x.question.id)).toEqual(['bag', 'ring']);
    expect(checks[0].left).toBe(2);
    expect(checks[1].left).toBeCloseTo((1 + 3 * 3) / 4);
  });

  it('counts a species that fits two answers (a ring only sometimes) under both', () => {
    const ring = checksFor([field, blusher]).find((c) => c.question.id === 'ring');
    // The Field Mushroom fits "yes" and "no": a "no" leaves only it, a "yes" leaves both.
    expect(ring!.options.map((o) => [o.option.value, names(o.fit)])).toEqual([
      ['yes', ['Field Mushroom', 'Blusher']], ['no', ['Field Mushroom']],
    ]);
  });

  it('lists the dangerous species first under each answer', () => {
    const bag = checksFor([field, panther, blusher, deathcap]).find((c) => c.question.id === 'bag')!;
    expect(names(bag.options[0].fit)).toEqual(['Deathcap', 'Panthercap']);
  });

  it('has nothing to offer when the candidates cannot be told apart by the questions', () => {
    expect(checksFor([cand(rec('One', {})), cand(rec('Two', {}))])).toEqual([]);
  });
});

describe('standing', () => {
  it('rules nothing out before an answer, or on "Not sure"', () => {
    const all = [field, blusher, deathcap];
    expect(names(standing(all, {}).fit)).toEqual(['Deathcap', 'Field Mushroom', 'Blusher']);
    const unsure = Object.fromEntries(QUESTIONS.map((q) => [q.id, UNSURE]));
    expect(standing(all, unsure).fit).toHaveLength(3);
  });

  it('rules out a species an answer does not fit, and says which answer', () => {
    const st = standing([field, blusher], { ring: 'no' });
    expect(names(st.fit)).toEqual(['Field Mushroom']);
    expect(st.out.map((p) => [p.c.s.english, p.against])).toEqual([['Blusher', ['ring']]]);
  });

  it('never drops a dangerous species: it is kept, with every answer it does not fit', () => {
    const st = standing([field, deathcap, panther], { ring: 'no', bag: 'no', spore: 'dark' });
    expect(names(st.fit)).toEqual(['Field Mushroom']);
    expect(st.kept.map((p) => [p.c.s.english, p.against])).toEqual([
      ['Deathcap', ['ring', 'bag', 'spore']], ['Panthercap', ['ring', 'bag', 'spore']],
    ]);
    expect(st.out).toEqual([]);
  });
});

describe('differences', () => {
  it('shows only the facts whose words differ, quickest first', () => {
    const a = cand(rec('A', { smell: 'Fruity' }, { habitat: 'Under pines.' }));
    const b = cand(rec('B', { smell: 'fruity' }, { habitat: 'Under birch' }));
    const d = differences([a, b]);
    expect(d.map((x) => x.label)).toEqual(['Where it grows']);
    expect(d[0].words.map((w) => w.text)).toEqual(['Under pines.', 'Under birch']);
  });

  it('gives the cap width in centimetres, or "No set size" for a crust', () => {
    const crust = cand(rec('Crust', { capCm: null }));
    const d = differences([crust, blusher]).find((x) => x.label === 'Cap width');
    expect(d!.words.map((w) => w.text)).toEqual(['No set size', '5–15 cm']);
  });

  it('needs two species to compare', () => expect(differences([blusher])).toEqual([]));
});

it('dangerFirst keeps the scan order within each group', () => {
  expect(names(dangerFirst([field, panther, blusher, deathcap]))).toEqual(['Deathcap', 'Panthercap', 'Field Mushroom', 'Blusher']);
});

// The guide's own pages: every pair of species in one genus — the kind of list a scan gives.
const DIR = new URL('../../content/species/', import.meta.url);
const ALL = readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(new URL(f, DIR), 'utf8')) as SpeciesRecord);
const dangerOf = (s: SpeciesRecord): Danger => (s.edibility.value === 'deadly' ? 'deadly' : s.edibility.value === 'poisonous' ? 'poisonous' : null);
const byGenus = new Map<string, SpeciesRecord[]>();
for (const s of ALL) byGenus.set(s.scientific.split(' ')[0], [...(byGenus.get(s.scientific.split(' ')[0]) ?? []), s]);
const groups = [...byGenus.values()].filter((g) => g.length > 1).map((g) => g.map((s) => cand(s, dangerOf(s))));

describe('on the guide\'s own pages', () => {
  it('no answer offered after a scan ever drops a dangerous species', () => {
    let tried = 0;
    for (const g of groups) {
      for (const check of checksFor(g)) {
        for (const o of check.options) {
          const st = standing(g, { [check.question.id]: o.option.value });
          expect(st.out.filter((p) => p.c.danger)).toEqual([]);
          expect(st.fit.length + st.kept.length + st.out.length).toBe(g.length);
          tried++;
        }
      }
    }
    expect(tried).toBeGreaterThan(50);
  });

  it('the words shown never speak of eating', () => {
    const EDIBILITY_WORDS = /edible|\bsafe\b|\beat(?:s|en|ing)?\b|tast/i;
    for (const g of groups) for (const d of differences(g)) for (const w of d.words) expect(w.text).not.toMatch(EDIBILITY_WORDS);
    for (const q of QUESTIONS) expect(`${q.title} ${q.hint} ${q.options.map((o) => o.label).join(' ')}`).not.toMatch(EDIBILITY_WORDS);
  });
});
