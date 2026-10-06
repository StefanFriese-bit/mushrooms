import { describe, expect, it } from 'vitest';
import { recordWords, scanRows } from './rows';
import type { ScanResult } from './rules';

const result: ScanResult = {
  notSure: false,
  group: null,
  dangerous: true,
  items: [
    { id: 1, name: 'Agaricus campestris', ours: 'Agaricus campestris', danger: null, score: 0.5, forSafety: false },
    { id: 2, name: 'Hygrocybe miniata', ours: 'Hygrocybe miniata', danger: null, score: 0.2, forSafety: false },
    { id: 3, name: 'Agaricus bernardii', ours: null, danger: null, score: 0.1, forSafety: false },
    { id: 4, name: 'Amanita phalloides', ours: 'Amanita phalloides', danger: 'deadly', score: 0.001, forSafety: true },
    { id: 5, name: 'Agaricus xanthodermus', ours: 'Agaricus xanthodermus', danger: null, score: 0.05, forSafety: false },
  ],
};
const english = new Map([['Agaricus campestris', 'Field Mushroom'], ['Amanita phalloides', 'Deathcap'], ['Agaricus xanthodermus', 'Yellow Stainer'],
  ['Agaricus bernardii', 'Salty Mushroom']]); // also the English names of species the model knows and the guide does not
const pages = new Map([
  ['Agaricus campestris', { slug: 'field-mushroom', edibility: 'edible-cooked' as const }],
  ['Amanita phalloides', { slug: 'deathcap', edibility: 'deadly' as const }],
  ['Agaricus xanthodermus', { slug: 'yellow-stainer', edibility: 'poisonous' as const }],
]);

describe('scanRows', () => {
  const rows = scanRows(result, english, pages);
  it('names each species, links its page, and says when the guide does not cover it', () => {
    expect(rows.map((r) => [r.english, r.slug, r.inList])).toEqual([
      ['Field Mushroom', 'field-mushroom', true],
      ['Hygrocybe miniata', null, true], // one of ours with no English name and no page yet
      ['Salty Mushroom', null, false], // the model knows it, the guide does not: named in English all the same
      ['Deathcap', 'deathcap', true],
      ['Yellow Stainer', 'yellow-stainer', true],
    ]);
  });
  it('takes the higher danger of the approved list and the page', () => {
    expect(rows.map((r) => r.danger)).toEqual([null, null, null, 'deadly', 'poisonous']);
  });
  it('says which species were added for safety', () => {
    expect(rows.map((r) => r.forSafety)).toEqual([false, false, false, true, false]);
  });
  it('never says anything about eating', () => {
    expect(rows.flatMap((r) => [r.english, r.scientific]).join(' ')).not.toMatch(/edible|safe/i); // the words it shows
  });
});

describe('recordWords', () => {
  it('puts the test figures into words', () => {
    expect(recordWords({ rightFirst: 0.6731, onList: 0.8548, dangerOnList: 0.9851, observations: 3178 })).toBe(
      'Tested on 3,178 UK finds it had never seen: the first name was right 67.3% of the time, the right species was on the ' +
      'list 85.5%, and a dangerous species was on the list 98.5% of the times it was the answer.');
  });
});

describe('a species the model knows under two names', () => {
  it('is listed once: the guide does not cover it, and its English name is the same', () => {
    const two: ScanResult = { notSure: true, dangerous: false, group: null, items: [
      { id: 1, name: 'Russula undulata', ours: null, danger: null, score: 0.3, forSafety: false },
      { id: 2, name: 'Russula fragilis', ours: null, danger: null, score: 0.2, forSafety: false },
      { id: 3, name: 'Russula depallens', ours: null, danger: null, score: 0.1, forSafety: false },
    ] };
    const names = new Map([['Russula undulata', 'Purple Brittlegill'], ['Russula depallens', 'Purple Brittlegill'], ['Russula fragilis', 'Fragile Brittlegill']]);
    expect(scanRows(two, names, new Map()).map((r) => r.english)).toEqual(['Purple Brittlegill', 'Fragile Brittlegill']);
  });
});
