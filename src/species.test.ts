import { describe, expect, it } from 'vitest';
import { EDIBILITY_WORDS, bySlug, loadAll, searchSpecies } from './species.ts';
import type { SpeciesRecord } from './types.ts';

const r = (slug: string, english: string, scientific: string, olderNames: string[] = [], other: string[] = []) =>
  ({ slug, english, scientific, olderNames, ...(other.length ? { otherNames: { value: other, sources: ['wt'] } } : {}) }) as unknown as SpeciesRecord;

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

describe('search by other names and with small spelling slips', () => {
  const all = loadAll({
    'a.json': { default: r('penny-bun-cep', 'Penny Bun / Cep', 'Boletus edulis', [], ['King Bolete', 'Porcini']) },
    'b.json': { default: r('chanterelle', 'Chanterelle', 'Cantharellus cibarius', [], ['Girolle']) },
    'c.json': { default: r('deathcap', 'Deathcap', 'Amanita phalloides') },
    'd.json': { default: r('fly-agaric', 'Fly Agaric', 'Amanita muscaria') },
  });
  const find = (q: string) => searchSpecies(all, q).map((s) => s.slug);
  it('finds a species by the other names its sources give', () => {
    expect(find('porcini')).toEqual(['penny-bun-cep']);
    expect(find('girolle')).toEqual(['chanterelle']);
  });
  it('forgives a slip of a letter or two in a word of four letters or more', () => {
    expect(find('porchini')).toEqual(['penny-bun-cep']); // one letter too many
    expect(find('chantrelle')).toEqual(['chanterelle']); // one letter missing
    expect(find('dethcap')).toEqual(['deathcap']);
    expect(find('kign bolete')).toEqual(['penny-bun-cep']); // two letters swapped
  });
  it('lists exact matches before near ones, and does not guess at short words', () => {
    expect(find('fly')).toEqual(['fly-agaric']);
    expect(find('fla')).toEqual([]);
    expect(find('zzzz')).toEqual([]);
  });
});
