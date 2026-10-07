import type { Find } from './store';

// Filters on Finds (spec 7): by species (or "not identified yet"), and "this month in past years" — the finds made in
// the same calendar month in earlier years, on this phone's own calendar, so last autumn's spots show this autumn.
export const ALL = 'all';
export const UNIDENTIFIED = 'none';
export type FindFilter = { species: string; pastYears: boolean };
export const NO_FILTER: FindFilter = { species: ALL, pastYears: false };

export function filterFinds(finds: Find[], f: FindFilter, now: Date): Find[] {
  return finds.filter((x) => {
    if (f.species === UNIDENTIFIED ? x.species !== null : f.species !== ALL && x.species !== f.species) return false;
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
