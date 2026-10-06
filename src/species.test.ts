import { describe, expect, it } from 'vitest';
import { EDIBILITY_WORDS, bySlug, loadAll, searchSpecies } from './species.ts';
import type { SpeciesRecord } from './types.ts';

const r = (slug: string, english: string, scientific: string, olderNames: string[] = []) =>
  ({ slug, english, scientific, olderNames }) as unknown as SpeciesRecord;

describe('species logic', () => {
  const all = loadAll({
    'a.json': { default: r('yellow-stainer', 'Yellow Stainer', 'Agaricus xanthodermus') },
    'b.json': { default: r('field-mushroom', 'Field Mushroom', 'Agaricus campestris') },
    'c.json': { default: r('wood-blewit', 'Wood Blewit', 'Collybia nuda', ['Lepista nuda']) },
  });
  it('sorts by English name', () => {
    expect(all.map((s) => s.slug)).toEqual(['field-mushroom', 'wood-blewit', 'yellow-stainer']);
  });
  it('searches English, scientific and older names, ignoring case', () => {
    expect(searchSpecies(all, 'AGARICUS').map((s) => s.slug)).toEqual(['field-mushroom', 'yellow-stainer']);
    expect(searchSpecies(all, 'lepista').map((s) => s.slug)).toEqual(['wood-blewit']);
    expect(searchSpecies(all, '  ')).toHaveLength(3);
  });
  it('finds a page by slug', () => {
    expect(bySlug(all, 'wood-blewit')?.english).toBe('Wood Blewit');
    expect(bySlug(all, 'nope')).toBeUndefined();
  });
  it('words edibility plainly and never "safe"', () => {
    expect(EDIBILITY_WORDS.deadly).toBe('Deadly');
    expect(Object.values(EDIBILITY_WORDS).join(' ')).not.toMatch(/safe/i);
  });
});
