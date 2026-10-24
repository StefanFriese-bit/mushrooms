import type { Find } from './store';

// The list under View map, a drawer per month (Stefan 24/10/2026: "it's going to get very long … while I still want
// them all appearing on the map itself … arrange the actual finds per month … a header row for months … I can pop that
// open if I want to see any of the finds specifically"). The map keeps every pin; only the list is folded.

export type MonthGroup = { key: string; label: string; finds: Find[] };

/** The month a location was saved in, on this phone's own calendar: "2026-10". */
export function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** "October 2026". */
export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

/** The locations by the month they were saved in, newest month first; inside a month the order they came in (the list
 * is newest first). A month with nothing saved has no drawer. */
export function byMonth(finds: Find[]): MonthGroup[] {
  const groups = new Map<string, Find[]>();
  for (const f of finds) {
    const k = monthKey(f.at);
    const g = groups.get(k);
    if (g) g.push(f); else groups.set(k, [f]);
  }
  return [...groups.keys()].sort().reverse().map((key) => ({ key, label: monthLabel(key), finds: groups.get(key)! }));
}
