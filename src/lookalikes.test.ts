import { describe, expect, it } from 'vitest';
import { apartRows, featureRank, lookalikeButton, lookalikeHeading, lookalikeTitle, orderedLookalikes } from './lookalikes';
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
  it('never calls a harmless lookalike poisonous: beside dangerous ones it stands under "Other lookalikes"', () => {
    const mixed = species('edible-cooked', [look('Deadly one', 'deadly'), look('Edible one', 'edible'), look('Not eaten', 'not-edible')]);
    expect(lookalikeHeading(mixed, mixed.lookalikes[0])).toBe('Poisonous lookalikes');
    expect(lookalikeHeading(mixed, mixed.lookalikes[1])).toBe('Other lookalikes');
    expect(lookalikeHeading(mixed, mixed.lookalikes[2])).toBe('Other lookalikes');
    const harmless = species('edible-cooked', [look('Edible one', 'edible')]);
    expect(lookalikeHeading(harmless, harmless.lookalikes[0])).toBe('Lookalikes');
    const deadly = species('deadly', [look('Edible one', 'edible')]);
    expect(lookalikeHeading(deadly, deadly.lookalikes[0])).toBe('Mistaken for');
  });
  it('counts on the button only what its name says', () => {
    expect(lookalikeButton(species('edible-cooked', [look('A', 'deadly'), look('B', 'poisonous'), look('C', 'edible')])))
      .toBe('Poisonous lookalikes (2) and 1 other');
    expect(lookalikeButton(species('edible-cooked', [look('A', 'deadly'), look('B', 'edible'), look('C', 'not-edible')])))
      .toBe('Poisonous lookalikes (1) and 2 others');
    expect(lookalikeButton(species('edible-cooked', [look('A', 'deadly'), look('B', 'poisonous')]))).toBe('Poisonous lookalikes (2)');
    expect(lookalikeButton(species('edible-cooked', [look('A', 'edible'), look('B', 'not-edible')]))).toBe('Lookalikes (2)');
    expect(lookalikeButton(species('deadly', [look('A', 'edible'), look('B', 'edible')]))).toBe('Mistaken for (2)');
  });
  it('puts the checks that settle it fastest first: ring, bag, gills, spore print, stem … the page\'s order otherwise', () => {
    const l = look('X', 'deadly', ['Where it grows', 'Cap', 'Spore print', 'Stem', 'Ring', 'Gills', 'Smell', 'Stem base']);
    expect(apartRows(l).map((r) => r.feature)).toEqual(['Ring', 'Stem base', 'Gills', 'Spore print', 'Stem', 'Smell', 'Cap', 'Where it grows']);
    expect(featureRank('Milk from the cut gills')).toBe(2); // about the gills first
    expect(featureRank('Something new')).toBe(11);
  });
});
