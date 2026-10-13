import type { Spot } from './store';

// Where the dogs are tied (Stefan 13/10/2026: "sometimes I tie the dogs that I'm walking with to a tree while I walk
// around in the area and yesterday I almost lost them"). ONE spot at a time, kept on this phone only: saving again
// replaces it, "Got them" forgets it. It is not a saved location — it is not on the map's list and not in a backup.
// A spot older than FRESH_HOURS belongs to an earlier walk: the Dogs button then offers to save a new one instead of
// walking back to it.
export type DogsSpot = Spot & { at: string }; // `at`: when it was saved (ISO)

export const DOGS_KEY = 'dogs-spot';
export const FRESH_HOURS = 12;

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
/** The phone's own storage, or null where the browser gives none (it can refuse even to be looked at). */
function phoneStore(): Store | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
export function isDogsSpot(v: unknown): v is DogsSpot {
  if (!v || typeof v !== 'object') return false;
  const d = v as Record<string, unknown>;
  return isNum(d.lat) && d.lat >= -90 && d.lat <= 90 && isNum(d.lon) && d.lon >= -180 && d.lon <= 180
    && (d.accuracy === null || (isNum(d.accuracy) && d.accuracy >= 0))
    && typeof d.at === 'string' && Number.isFinite(Date.parse(d.at));
}

/** The dogs' spot as saved, however old; null when there is none (or what is stored cannot be read). */
export function readDogs(store: Store | null = phoneStore()): DogsSpot | null {
  try {
    const raw = store?.getItem(DOGS_KEY);
    if (!raw) return null;
    const v: unknown = JSON.parse(raw);
    return isDogsSpot(v) ? v : null;
  } catch { return null; }
}

/** Saves the spot, replacing any earlier one. Throws when the phone would not store it — the screen must say so,
 * never pretend it is saved. */
export function saveDogs(spot: Spot, at: Date, store: Store | null = phoneStore()): DogsSpot {
  if (!store) throw new Error('This phone gives the app no storage');
  const d: DogsSpot = { lat: spot.lat, lon: spot.lon, accuracy: spot.accuracy, at: at.toISOString() };
  store.setItem(DOGS_KEY, JSON.stringify(d));
  if (!readDogs(store)) throw new Error('The spot did not stay saved');
  return d;
}

export function forgetDogs(store: Store | null = phoneStore()): void {
  try { store?.removeItem(DOGS_KEY); } catch { /* nothing stored that could be read back either */ }
}

/** Saved on this walk: no more than FRESH_HOURS ago (and not more than an hour "ahead", if the clock was put back). */
export function isFresh(d: DogsSpot, now: number): boolean {
  const age = now - Date.parse(d.at);
  return age >= -3_600_000 && age <= FRESH_HOURS * 3_600_000;
}

/** The dogs' spot of this walk, or null. */
export function freshDogs(now = Date.now(), store: Store | null = phoneStore()): DogsSpot | null {
  const d = readDogs(store);
  return d && isFresh(d, now) ? d : null;
}

/** When it was saved, in the phone's own time: "10:42" today, else the date too ("12 Oct 2026, 10:42"). */
export function sayDogsWhen(iso: string, now: Date = new Date()): string {
  const t = new Date(iso);
  const time = t.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return t.toDateString() === now.toDateString() ? `today at ${time}` : t.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

/** Where the Dogs button goes: straight to the walk back while this walk's spot is saved, else to saving one. */
export const DOGS_GO_HREF = '#/dogs/go';
export const dogsButtonHref = (now = Date.now(), store: Store | null = phoneStore()): string =>
  (freshDogs(now, store) ? DOGS_GO_HREF : '#/dogs');
