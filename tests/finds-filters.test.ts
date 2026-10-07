import { describe, expect, it } from 'vitest';
import { ALL, NO_FILTER, UNIDENTIFIED, filterFinds, speciesChoices } from '../src/finds/filters';
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
    expect(ids(filterFinds(finds, { species: 'Boletus edulis', pastYears: false }, now))).toEqual(['c', 'd']);
    expect(ids(filterFinds(finds, { species: UNIDENTIFIED, pastYears: false }, now))).toEqual(['e']);
  });
  it('"this month in past years": the same month in earlier years only — not this year, not other months', () => {
    expect(ids(filterFinds(finds, { species: ALL, pastYears: true }, now))).toEqual(['b', 'c', 'e']);
  });
  it('both together', () => {
    expect(ids(filterFinds(finds, { species: 'Cantharellus cibarius', pastYears: true }, now))).toEqual(['b']);
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
