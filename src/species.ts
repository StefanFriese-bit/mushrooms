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

/** A name as search compares it: lower case, no accents, apostrophes or full stops, words split by single spaces. */
const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/['’.]/g, '')
  .replace(/[^a-z0-9]+/g, ' ').trim();

/** Letters to change, add, drop or swap (two side by side) to turn a into b. */
export function editDistance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/** How many slips a typed word may have: none under 4 letters, one up to 7, two from 8. */
const slips = (word: string) => (word.length >= 8 ? 2 : word.length >= 4 ? 1 : 0);

/** Every name a species goes by: English, scientific, older scientific, and the other English names its sources give. */
const namesOf = (s: SpeciesRecord) => [s.english, s.scientific, ...s.olderNames, ...(s.otherNames?.value ?? [])].map(norm);

/** The species whose names contain what was typed, then — for words of 4 letters or more — those a slip or two away
 * ("porchini" finds the Porcini), every typed word matching a word of one name. */
export function searchSpecies(all: SpeciesRecord[], query: string): SpeciesRecord[] {
  const q = norm(query);
  if (!q) return all;
  const exact = all.filter((s) => namesOf(s).some((n) => n.includes(q)));
  const words = q.split(' ');
  if (words.every((w) => slips(w) === 0)) return exact;
  const near = (w: string, x: string) => x.startsWith(w) || (slips(w) > 0 && editDistance(w, x) <= slips(w));
  const close = all.filter((s) => !exact.includes(s) &&
    namesOf(s).some((n) => { const nw = n.split(' '); return words.every((w) => nw.some((x) => near(w, x))); }));
  return [...exact, ...close];
}

export function bySlug(all: SpeciesRecord[], slug: string): SpeciesRecord | undefined {
  return all.find((s) => s.slug === slug);
}

/** The websites behind a fact, by name — "First Nature and Wild Food UK" — from its sources' titles ("First Nature — …").
 * "No dangerous lookalike" says WHICH sites name none (10/10/2026): another trusted site may name one that only it names,
 * and a one-site fact stays off the page, so "the trusted sites" would claim more than is true. */
export function siteNames(rec: SpeciesRecord, sources: string[]): string {
  const names = [...new Set(sources.map((id) => rec.sources.find((s) => s.id === id)?.title.split(' — ')[0].trim())
    .filter((n): n is string => !!n))];
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0] ?? 'The trusted sites';
}
