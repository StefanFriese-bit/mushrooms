import type { Find } from './store';

// Filters on Finds (spec 7): by species (or "not identified yet"), and "this month in past years" — the finds made in
// the same calendar month in earlier years, on this phone's own calendar, so last autumn's spots show this autumn.
export const ALL = 'all';
export const UNIDENTIFIED = 'none';
export type FindFilter = { species: string; pastYears: boolean; text: string };
export const NO_FILTER: FindFilter = { species: ALL, pastYears: false, text: '' };

// A word in his own descriptions (Stefan 13/10/2026: "if I've saved locations that have the word penny bun in … I can
// view on the map where all those locations are and choose one of them to navigate towards"). The species choice above
// only knows locations he has formally named on their own page; this searches what he actually typed, so a note saying
// "penny bun under the beech" is found whether or not he ever identified it.

/** A piece of text as its bare words: lower case, accents off, anything that is not a letter or a number treated as a
 * space. "Penny Bun (3!)" -> ["penny", "bun", "3"]. */
export function words(s: string): string[] {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().split(/[^\p{Letter}\p{Number}]+/u).filter(Boolean);
}

/** Whether a word he typed matches one of a location's words: they start the same way, for at least three letters.
 * That covers how a word really varies in his own notes - "bun" finds "buns", and "bunny", which is what the phone
 * hears when he says Penny Bun, finds both. Under three letters it must be the whole word, or "ar" would match half
 * the wood; and it is always the START, so "bun" never matches "urban". */
export const STEM = 3;
export function wordMatches(typed: string, word: string): boolean {
  if (typed === word) return true;
  if (typed.length < STEM || word.length < STEM) return false;
  let same = 0;
  while (same < typed.length && same < word.length && typed[same] === word[same]) same++;
  return same >= STEM;
}

/** Everything a location can be searched by: his description, and the species he named it - under both its English and
 * its scientific name, so "penny bun" finds a location named Boletus edulis. */
export function searchableWords(f: Find, names: Map<string, string>): string[] {
  const parts = [f.notes];
  if (f.species) parts.push(f.species, names.get(f.species) ?? '');
  return words(parts.join(' '));
}

/** Every word he typed must be somewhere in the location - in any order, so "bun penny" finds it too. */
export function matchesText(f: Find, text: string, names: Map<string, string>): boolean {
  const typed = words(text);
  if (typed.length === 0) return true;
  const mine = searchableWords(f, names);
  return typed.every((t) => mine.some((w) => wordMatches(t, w)));
}

export function filterFinds(finds: Find[], f: FindFilter, now: Date, names: Map<string, string> = new Map()): Find[] {
  return finds.filter((x) => {
    if (f.species === UNIDENTIFIED ? x.species !== null : f.species !== ALL && x.species !== f.species) return false;
    if (!matchesText(x, f.text, names)) return false;
    if (!f.pastYears) return true;
    const at = new Date(x.at);
    return at.getMonth() === now.getMonth() && at.getFullYear() < now.getFullYear();
  });
}

/** The species choices: those among his finds, by name, each with its count; "not identified yet" last. */
export function speciesChoices(finds: Find[], names: Map<string, string>): Array<{ value: string; label: string; count: number }> {
  const counts = new Map<string, number>();
  let none = 0;
  for (const f of finds) {
    if (f.species === null) none++;
    else counts.set(f.species, (counts.get(f.species) ?? 0) + 1);
  }
  const out = [...counts].map(([value, count]) => ({ value, label: names.get(value) ?? value, count }))
    .sort((a, b) => a.label.localeCompare(b.label));
  if (none > 0) out.push({ value: UNIDENTIFIED, label: 'Not identified yet', count: none });
  return out;
}

export const monthName = (d: Date) => d.toLocaleString('en-GB', { month: 'long' });
