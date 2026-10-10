import type { Find } from './store';

/** What a saved location is called: the first line of his description, else the species he named, else "Saved
 * location". ONE rule for the list, the map's pins, the location's own page and the walk back (Stefan 10/10/2026: a
 * location is saved with a description, a photo, or neither). */
export function findLabel(f: Pick<Find, 'notes' | 'species'>, names: Map<string, string>): string {
  const first = f.notes.split('\n').map((l) => l.trim()).find(Boolean);
  if (first) return first.length > 60 ? `${first.slice(0, 57).trimEnd()}…` : first;
  return f.species ? names.get(f.species) ?? f.species : 'Saved location';
}
