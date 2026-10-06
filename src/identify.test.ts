import { describe, expect, it } from 'vitest';
import { QUESTIONS, answersFromQuery, fits, narrow, nextQuestion, queryFromAnswers, type Answers } from './identify';
import type { Edibility, Features, Lookalike, SpeciesRecord } from './types';

const src = { sources: ['a', 'b'] };
function rec(english: string, f: Partial<Record<keyof Features, unknown>>, edibility: Edibility = 'edible-cooked',
  lookalikes: Array<Pick<Lookalike, 'english' | 'kind' | 'slug'>> = [], spore = 'White'): SpeciesRecord {
  const slug = english.toLowerCase().replace(/\s+/g, '-');
  const feature = <T,>(k: keyof Features, d: T) => ({ value: (k in f ? f[k] : d) as T, ...src });
  return {
    slug, inatId: 1, scientific: `Genus ${slug}`, english, olderNames: [],
    edibility: { value: edibility, ...src }, edibilityNote: null, protectedInUk: { value: false, ...src },
    topPoints: [], habitat: { value: '', ...src }, seasonMonths: { value: [9], ...src }, sporePrint: { value: spore, ...src },
    features: {
      underside: feature('underside', 'gills'), ring: feature('ring', 'no'), bagAtBase: feature('bagAtBase', 'no'),
      growsOn: feature('growsOn', 'ground'), capCm: feature('capCm', [3, 8]), fleshChange: feature('fleshChange', ''),
      smell: feature('smell', ''),
    } as Features,
    lookalikes: lookalikes.map((l) => ({ ...l, scientific: `Genus ${l.english.toLowerCase().replace(/\s+/g, '-')}`, tellApart: [] })),
    noDangerousLookalike: null, photos: [], sources: [], checked: '2026-10-06',
  };
}

const field = rec('Field Mushroom', { ring: 'sometimes', capCm: [3, 10] }, 'edible-cooked', [
  { english: 'Deathcap', kind: 'deadly', slug: 'deathcap' },
  { english: 'Fools Funnel', kind: 'poisonous', slug: null },
  { english: 'Wood Mushroom', kind: 'edible', slug: null },
], 'Chocolate brown');
const deathcap = rec('Deathcap', { ring: 'yes', bagAtBase: 'yes', capCm: [5, 15] }, 'deadly', [
  { english: 'Field Mushroom', kind: 'edible', slug: 'field-mushroom' },
]);
const chanterelle = rec('Chanterelle', { underside: 'ridges', capCm: [3, 10] }, 'edible-cooked', [], 'Pale yellow to cream');
const bracket = rec('Bracket', { underside: 'pores', growsOn: 'wood', capCm: [10, 40] }, 'not-edible', [], 'Rusty brown');
const ALL = [field, deathcap, chanterelle, bracket];
const names = (l: Array<{ english: string }>) => l.map((x) => x.english);

describe('fits', () => {
  it('"Not sure" and no answer always fit', () => {
    for (const q of QUESTIONS) { expect(fits(bracket, q.id, 'unsure')).toBe(true); expect(fits(bracket, q.id, undefined)).toBe(true); }
  });
  it('underside and grows on match exactly', () => {
    expect(fits(chanterelle, 'underside', 'ridges')).toBe(true);
    expect(fits(chanterelle, 'underside', 'gills')).toBe(false);
    expect(fits(bracket, 'growsOn', 'ground')).toBe(false);
  });
  it('a ring that is there "sometimes" fits both yes and no', () => {
    expect(fits(field, 'ring', 'yes')).toBe(true);
    expect(fits(field, 'ring', 'no')).toBe(true);
    expect(fits(deathcap, 'ring', 'no')).toBe(false);
  });
  it('a cap band keeps every species whose range touches it', () => {
    expect(fits(deathcap, 'cap', 'small')).toBe(true); // 5–15 touches "under 5" at 5
    expect(fits(chanterelle, 'cap', 'large')).toBe(true); // 3–10 touches "over 10" at 10
    expect(fits(bracket, 'cap', 'small')).toBe(false);
  });
  it('keeps a crust with no set size under every size answer', () => {
    const crust = rec('Crust', { underside: 'other', growsOn: 'wood', capCm: null }, 'not-edible', [], 'White');
    for (const band of ['small', 'medium', 'large']) expect(fits(crust, 'cap', band)).toBe(true);
  });
  it('a spore colour keeps the species whose text names it', () => {
    expect(fits(field, 'spore', 'dark')).toBe(true);
    expect(fits(field, 'spore', 'white')).toBe(false);
    expect(fits(chanterelle, 'spore', 'white')).toBe(true);
  });
});

describe('narrow', () => {
  it('with no answers every species fits', () => {
    expect(names(narrow(ALL, {}).matches)).toEqual(names(ALL));
  });
  it('"Not sure" never narrows', () => {
    const a: Answers = Object.fromEntries(QUESTIONS.map((q) => [q.id, 'unsure']));
    expect(names(narrow(ALL, a).matches)).toEqual(names(ALL));
  });
  it('keeps every Deadly or Poisonous lookalike of a species that still fits, even when an answer rules it out', () => {
    const r = narrow(ALL, { underside: 'gills', bag: 'no' }); // a hidden bag: the Deathcap must not vanish
    expect(names(r.matches)).toEqual(['Field Mushroom']);
    expect(r.kept).toEqual([
      { slug: 'deathcap', english: 'Deathcap', scientific: 'Genus deathcap', danger: 'deadly', keptFor: ['Field Mushroom'] },
      { slug: null, english: 'Fools Funnel', scientific: 'Genus fools-funnel', danger: 'poisonous', keptFor: ['Field Mushroom'] },
    ]);
  });
  it('does not keep an edible lookalike', () => {
    expect(names(narrow(ALL, { underside: 'gills', bag: 'no' }).kept)).not.toContain('Wood Mushroom');
  });
  it('lists a species that fits every answer but one as a near miss, naming that answer', () => {
    const r = narrow(ALL, { underside: 'ridges', spore: 'dark' });
    expect(names(r.matches)).toEqual([]);
    expect(r.nearMisses.map((n) => [n.english, n.differsOn])).toEqual([
      ['Field Mushroom', 'underside'], ['Chanterelle', 'spore'],
    ]);
  });
  it('a species kept for safety is not listed again as a near miss', () => {
    const r = narrow(ALL, { underside: 'gills', ring: 'no' }); // Deathcap differs only on the ring
    expect(names(r.kept)).toContain('Deathcap');
    expect(names(r.nearMisses)).not.toContain('Deathcap');
  });
  it('shows the danger of every species it lists, and nothing about eating', () => {
    const r = narrow(ALL, {});
    expect(r.matches.map((m) => m.danger)).toEqual([null, 'deadly', null, null]);
    expect(JSON.stringify(r)).not.toMatch(/edible/i);
  });
});

describe('the answers in the address', () => {
  it('round-trips, in question order', () => {
    const a: Answers = { ring: 'unsure', underside: 'gills' };
    expect(queryFromAnswers(a)).toBe('underside=gills&ring=unsure');
    expect(answersFromQuery(new URLSearchParams('underside=gills&ring=unsure'))).toEqual(a);
  });
  it('drops anything it does not know', () => {
    expect(answersFromQuery(new URLSearchParams('underside=feathers&colour=red&bag=yes'))).toEqual({ bag: 'yes' });
  });
  it('the next question is the first one not answered', () => {
    expect(nextQuestion({})?.id).toBe('underside');
    expect(nextQuestion({ underside: 'gills', growsOn: 'unsure' })?.id).toBe('ring');
    expect(nextQuestion(Object.fromEntries(QUESTIONS.map((q) => [q.id, 'unsure'])))).toBeNull();
  });
});
