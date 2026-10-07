import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { combine, shortlist, type ClassInfo } from './rules';
import { dangerOfPage, dangerousSpecies, withPageDanger, worse } from './danger';
import type { Edibility } from '../types';

const cls = (id: number, name: string, danger: ClassInfo['danger'] = null): ClassInfo =>
  ({ id, name, ours: name, danger, uk: true, months: Array(12).fill(1) });

describe('how dangerous a species is: the worse of the approved list and its page', () => {
  it('takes the worse of the two levels', () => {
    expect(worse(null, 'poisonous')).toBe('poisonous');
    expect(worse('poisonous', 'deadly')).toBe('deadly');
    expect(worse('deadly', null)).toBe('deadly');
    expect(worse(null, null)).toBe(null);
    expect(dangerOfPage('edible-some-react')).toBe(null);
    expect(dangerOfPage('poisonous')).toBe('poisonous');
  });
  it('a species dangerous only on its page raises the red banner and is kept on the shortlist for safety', () => {
    // White Fibrecap: no level on the approved list, "deadly" on its page (batch 2). Before 07/10/2026 neither rule saw it.
    const classes = [cls(0, 'A'), cls(1, 'B'), cls(2, 'C'), cls(3, 'D'), cls(4, 'E'), cls(5, 'Inocybe geophylla')];
    const pages = new Map<string, Edibility>([['Inocybe geophylla', 'deadly']]);
    const scores = [0.3, 0.25, 0.2, 0.15, 0.09, 0.01]; // sixth: below the five, above the safety line
    const t = { safety: 0.005, notSure: 0.9, offSeason: 0.3, group: 2 };
    const before = shortlist(combine([scores]), classes, 9, t);
    expect(before.dangerous).toBe(false); // the old way: invisible
    const after = shortlist(combine([scores]), withPageDanger(classes, pages), 9, t);
    expect(after.dangerous).toBe(true);
    expect(after.items.find((i) => i.ours === 'Inocybe geophylla')).toMatchObject({ danger: 'deadly', forSafety: true });
  });
  it('the guide as it stands: every page that says poisonous or deadly is dangerous to the scan', () => {
    const dir = new URL('../../content/species/', import.meta.url);
    const pages = new Map<string, Edibility>(readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => {
      const p = JSON.parse(readFileSync(new URL(f, dir), 'utf8')) as { scientific: string; edibility: { value: Edibility } };
      return [p.scientific, p.edibility.value];
    }));
    const list = (JSON.parse(readFileSync(new URL('../../content/species-list.json', import.meta.url), 'utf8')) as
      { species: Array<{ name: string; dangerLevel: ClassInfo['danger'] }> }).species;
    const dangerous = dangerousSpecies(list, pages);
    for (const [name, e] of pages) if (e === 'poisonous' || e === 'deadly') expect(dangerous.get(name), name).toBeDefined();
    for (const s of list) if (s.dangerLevel) expect(dangerous.get(s.name), s.name).toBeDefined();
    expect(dangerous.get('Inocybe geophylla')).toBe('deadly');
  });
});
