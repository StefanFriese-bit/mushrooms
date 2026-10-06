import { describe, expect, it } from 'vitest';
import { combine, outOfSeason, shortlist, type ClassInfo } from './rules';

const ALL_YEAR = Array(12).fill(5);
const JUL_DEC = [0, 0, 0, 0, 0, 0, 16, 71, 86, 207, 43, 4];
const cls = (id: number, ours: string | null, danger: ClassInfo['danger'] = null, uk = true, months = ALL_YEAR): ClassInfo =>
  ({ id, name: ours ?? `other ${id}`, ours, danger, uk, months });
const T = { safety: 0.05, notSure: 0.3, offSeason: 0.5, group: 0.6 };

describe('combine', () => {
  it('averages the scores of up to three photos', () => {
    const c = combine([[0.2, 0.8], [0.6, 0.4]]);
    expect(c[0]).toBeCloseTo(0.4);
    expect(c[1]).toBeCloseTo(0.6);
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
    expect(r.items[0].ours).toBe('Seasonal');
    expect(r.items[0].score).toBeCloseTo(0.45);
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
    expect(r.items[0].ours).toBe('A');
    expect(r.items[0].score).toBeCloseTo(0.6);
  });
  it('refuses scores that do not fit the class list', () => {
    expect(() => shortlist([0.5], classes, 10, T)).toThrow();
  });
});

describe('the group (genus) headline', () => {
  const g = (id: number, name: string, ours: string | null = null, uk = true, months = ALL_YEAR): ClassInfo =>
    ({ id, name, ours, danger: null, uk, months });
  const classes = [g(0, 'Russula fellea'), g(1, 'Russula emetica', 'Russula emetica'), g(2, 'Russula fragilis'),
    g(3, 'Lactarius blennius', 'Lactarius blennius'), g(4, 'Russula gone', null, false), g(5, 'Russula late', null, true, JUL_DEC)];
  it('names the genus whose species together score highest, when at or above the group line', () => {
    const r = shortlist([0.3, 0.2, 0.15, 0.3, 0, 0], classes, 10, T);
    expect(r.group?.genus).toBe('Russula');
    expect(r.group?.score).toBeCloseTo(0.65);
    expect(r.items.slice(0, 2).map((i) => i.name)).toEqual(['Russula fellea', 'Lactarius blennius']); // the list is unchanged
  });
  it('gives no headline below the line', () => {
    expect(shortlist([0.2, 0.2, 0.1, 0.3, 0, 0], classes, 10, T).group).toBeNull();
  });
  it('counts a genus only over UK species, with the season mark-down', () => {
    expect(shortlist([0.2, 0.2, 0, 0.1, 0.9, 0], classes, 10, T).group).toBeNull(); // the non-UK class is not counted
    expect(shortlist([0.15, 0.2, 0, 0, 0, 0.4], classes, 3, T).group).toBeNull(); // out of season: 0.4 counts as 0.2
    expect(shortlist([0.15, 0.2, 0, 0, 0, 0.4], classes, 10, T).group?.genus).toBe('Russula');
  });
});
