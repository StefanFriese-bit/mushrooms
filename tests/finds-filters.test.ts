import { describe, expect, it } from 'vitest';
import { ALL, NO_FILTER, UNIDENTIFIED, filterFinds, matchesText, speciesChoices, wordMatches, words } from '../src/finds/filters';
import type { Find } from '../src/finds/store';

const find = (id: string, at: string, species: string | null): Find => ({ id, at, spot: null, species, notes: '', photoIds: [] });
const finds = [
  find('a', '2026-10-03T10:00:00', 'Cantharellus cibarius'),
  find('b', '2025-10-12T10:00:00', 'Cantharellus cibarius'),
  find('c', '2024-10-20T10:00:00', 'Boletus edulis'),
  find('d', '2025-09-30T10:00:00', 'Boletus edulis'),
  find('e', '2025-10-01T10:00:00', null),
];
const now = new Date('2026-10-07T12:00:00');
const ids = (l: Find[]) => l.map((f) => f.id);

describe('filtering finds', () => {
  it('with no filter shows every find', () => expect(ids(filterFinds(finds, NO_FILTER, now))).toEqual(['a', 'b', 'c', 'd', 'e']));
  it('by species, and "not identified yet"', () => {
    expect(ids(filterFinds(finds, { ...NO_FILTER, species: 'Boletus edulis' }, now))).toEqual(['c', 'd']);
    expect(ids(filterFinds(finds, { ...NO_FILTER, species: UNIDENTIFIED }, now))).toEqual(['e']);
  });
  it('"this month in past years": the same month in earlier years only — not this year, not other months', () => {
    expect(ids(filterFinds(finds, { ...NO_FILTER, species: ALL, pastYears: true }, now))).toEqual(['b', 'c', 'e']);
  });
  it('both together', () => {
    expect(ids(filterFinds(finds, { ...NO_FILTER, species: 'Cantharellus cibarius', pastYears: true }, now))).toEqual(['b']);
  });
});

describe('the species choices', () => {
  it('lists the species among his finds by name, with counts, and "not identified yet" last', () => {
    const names = new Map([['Cantharellus cibarius', 'Chanterelle'], ['Boletus edulis', 'Penny Bun']]);
    expect(speciesChoices(finds, names)).toEqual([
      { value: 'Cantharellus cibarius', label: 'Chanterelle', count: 2 },
      { value: 'Boletus edulis', label: 'Penny Bun', count: 2 },
      { value: UNIDENTIFIED, label: 'Not identified yet', count: 1 },
    ]);
  });
});

describe('finding a location by a word he typed (Stefan 13/10/2026: "locations that have the word penny bun in")', () => {
  const named = new Map([['Boletus edulis', 'Penny Bun'], ['Cantharellus cibarius', 'Chanterelle']]);
  const noted = (id: string, notes: string, species: string | null = null): Find =>
    ({ id, at: '2026-10-03T10:00:00', spot: null, species, notes, photoIds: [] });
  const mine = [
    noted('n1', 'Penny bun under the big beech\nthree of them'),
    noted('n2', 'penny buns by the gate'),
    noted('n3', 'chanterelles on the bank'),
    noted('n4', '', 'Boletus edulis'),            // never described, but named as a species
    noted('n5', 'bun left on the bench'),         // the word, nothing to do with pennies
    noted('n6', 'Pennywort patch'),
  ];
  const found = (text: string) => ids(filterFinds(mine, { ...NO_FILTER, text }, now, named));

  it('finds every location with those words, in any order, whatever the capitals', () => {
    expect(found('penny bun')).toEqual(['n1', 'n2', 'n4']);
    expect(found('BUN PENNY')).toEqual(['n1', 'n2', 'n4']);
  });
  it('counts a location he named as that species, even with nothing typed', () => {
    expect(found('boletus')).toEqual(['n4']);
    expect(found('chanterelle')).toEqual(['n3', 'n4'].slice(0, 1)); // n3 by its note; n4 is a Penny Bun
  });
  it('needs every word, so one word alone is not enough', () => {
    expect(found('bun')).toEqual(['n1', 'n2', 'n4', 'n5']);
    expect(found('penny')).toEqual(['n1', 'n2', 'n4', 'n6']); // Pennywort starts with penny
  });
  it('is forgiving about an ending: plurals, and a word dictated a little longer', () => {
    expect(found('penny buns')).toEqual(['n1', 'n2', 'n4']);
    expect(found('penny bunny')).toEqual(['n1', 'n2', 'n4']); // what the phone heard him say
  });
  it('an empty box filters nothing', () => expect(found('   ')).toEqual(['n1', 'n2', 'n3', 'n4', 'n5', 'n6']));
  it('reads punctuation and accents as he typed them or not', () => {
    expect(words('Penny Bun (3!)')).toEqual(['penny', 'bun', '3']);
    expect(words('Cép')).toEqual(['cep']);
  });
  it('keeps a short word whole, so it cannot match half the wood', () => {
    expect(wordMatches('ar', 'army')).toBe(false);
    expect(wordMatches('oak', 'oaks')).toBe(true);
    expect(wordMatches('bun', 'bunny')).toBe(true);
    expect(wordMatches('bun', 'urban')).toBe(false); // the start of the word, never the middle
    expect(wordMatches('buns', 'bunny')).toBe(true);  // both are his Penny Buns
    expect(wordMatches('oak', 'oar')).toBe(false);    // two letters in common is not a word
  });
  it('works for a location with no description and no species', () => {
    expect(matchesText(noted('x', ''), 'penny', named)).toBe(false);
    expect(matchesText(noted('x', ''), '', named)).toBe(true);
  });
});
