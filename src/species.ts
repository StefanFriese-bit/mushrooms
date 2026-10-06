import type { Edibility, LookalikeKind, SpeciesRecord } from './types.ts';

export const EDIBILITY_WORDS: Record<Edibility, string> = {
  'edible-cooked': 'Edible, cooked',
  'edible-some-react': 'Edible, but some people react',
  'not-edible': 'Not edible',
  poisonous: 'Poisonous',
  deadly: 'Deadly',
};

export const KIND_WORDS: Record<LookalikeKind, string> = {
  deadly: 'Deadly',
  poisonous: 'Poisonous',
  edible: 'Edible',
  'not-edible': 'Not edible',
};

/** CSS class for a tag: deadly / poisonous / edible / plain. */
export function tagClass(v: Edibility | LookalikeKind): string {
  if (v === 'deadly') return 'deadly';
  if (v === 'poisonous') return 'poisonous';
  if (v === 'edible' || v === 'edible-cooked' || v === 'edible-some-react') return 'edible';
  return 'plain';
}

export function loadAll(modules: Record<string, { default: SpeciesRecord }>): SpeciesRecord[] {
  return Object.values(modules)
    .map((m) => m.default)
    .sort((a, b) => a.english.localeCompare(b.english, 'en-GB'));
}

export function searchSpecies(all: SpeciesRecord[], query: string): SpeciesRecord[] {
  const q = query.trim().toLowerCase();
  if (!q) return all;
  return all.filter((s) => [s.english, s.scientific, ...s.olderNames].some((n) => n.toLowerCase().includes(q)));
}

export function bySlug(all: SpeciesRecord[], slug: string): SpeciesRecord | undefined {
  return all.find((s) => s.slug === slug);
}
