import { describe, expect, it } from 'vitest';
import { apartRows, featureRank, lookalikeTitle, orderedLookalikes } from './lookalikes';
import type { Lookalike, SpeciesRecord } from './types';

const look = (english: string, kind: Lookalike['kind'], rows: string[] = []): Lookalike =>
  ({ english, scientific: english, slug: null, kind, tellApart: rows.map((f) => ({ feature: f, thisOne: 'a', thatOne: 'b', sources: ['x'] })) });
const species = (edibility: SpeciesRecord['edibility']['value'], lookalikes: Lookalike[]) =>
  ({ edibility: { value: edibility, sources: [] }, lookalikes }) as unknown as SpeciesRecord;

describe('the lookalike screen', () => {
  it('shows the deadly lookalikes first, then the poisonous, then the rest, each as the page lists them', () => {
    const s = species('edible-cooked', [look('Edible one', 'edible'), look('Poison one', 'poisonous'), look('Deadly one', 'deadly'),
      look('Poison two', 'poisonous')]);
    expect(orderedLookalikes(s).map((l) => l.english)).toEqual(['Deadly one', 'Poison one', 'Poison two', 'Edible one']);
  });
  it('is called "Poisonous lookalikes" for an edible species with dangerous ones, "Mistaken for" for a dangerous one', () => {
    expect(lookalikeTitle(species('edible-cooked', [look('X', 'deadly')]))).toBe('Poisonous lookalikes');
    expect(lookalikeTitle(species('edible-cooked', [look('X', 'edible')]))).toBe('Lookalikes');
    expect(lookalikeTitle(species('deadly', [look('X', 'edible')]))).toBe('Mistaken for');
    expect(lookalikeTitle(species('poisonous', [look('X', 'edible')]))).toBe('Mistaken for');
  });
  it('puts the checks that settle it fastest first: ring, bag, gills, spore print, stem … the page\'s order otherwise', () => {
    const l = look('X', 'deadly', ['Where it grows', 'Cap', 'Spore print', 'Stem', 'Ring', 'Gills', 'Smell', 'Stem base']);
    expect(apartRows(l).map((r) => r.feature)).toEqual(['Ring', 'Stem base', 'Gills', 'Spore print', 'Stem', 'Smell', 'Cap', 'Where it grows']);
    expect(featureRank('Milk from the cut gills')).toBe(2); // about the gills first
    expect(featureRank('Something new')).toBe(11);
  });
});
