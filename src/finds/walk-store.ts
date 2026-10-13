import type { LatLon } from './geo';
import type { Stop, Walk } from './walk';

// The walk he is on, kept on this phone while he walks it (Stefan 13/10/2026). It has to outlive the screen: he plans
// it on the map, then walks stop to stop, with the phone in and out of his pocket. One walk at a time — planning
// another replaces it — and a walk older than FRESH_HOURS belongs to an earlier outing, as the dogs' spot does.

export type SavedWalk = Walk & { at: string; start: LatLon };
export const WALK_KEY = 'walk';
export const FRESH_HOURS = 12;

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
function phoneStore(): Store | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isPlace = (v: unknown): boolean => {
  if (!v || typeof v !== 'object') return false;
  const p = v as Record<string, unknown>;
  return isNum(p.lat) && p.lat >= -90 && p.lat <= 90 && isNum(p.lon) && p.lon >= -180 && p.lon <= 180;
};
const isStop = (v: unknown): v is Stop => isPlace(v) && typeof (v as Record<string, unknown>).id === 'string';

export function isSavedWalk(v: unknown): v is SavedWalk {
  if (!v || typeof v !== 'object') return false;
  const w = v as Record<string, unknown>;
  return Array.isArray(w.order) && w.order.length > 0 && w.order.every(isStop)
    && Array.isArray(w.legs) && w.legs.length === w.order.length && w.legs.every(isNum)
    && isNum(w.total) && isNum(w.backToStart) && isPlace(w.start)
    && typeof w.at === 'string' && Number.isFinite(Date.parse(w.at));
}

/** The walk as saved, however old; null when there is none or what is stored cannot be read. */
export function readWalk(store: Store | null = phoneStore()): SavedWalk | null {
  try {
    const raw = store?.getItem(WALK_KEY);
    if (!raw) return null;
    const v: unknown = JSON.parse(raw);
    return isSavedWalk(v) ? v : null;
  } catch { return null; }
}

/** Saves the walk, replacing any earlier one. A phone that will not keep it still walks — the screen simply forgets it
 * when he leaves, so this never throws. */
export function saveWalk(w: Walk, start: LatLon, at: Date = new Date(), store: Store | null = phoneStore()): SavedWalk {
  const saved: SavedWalk = { ...w, start: { lat: start.lat, lon: start.lon }, at: at.toISOString() };
  try { store?.setItem(WALK_KEY, JSON.stringify(saved)); } catch { /* it lasts as long as the screen */ }
  return saved;
}

export function clearWalk(store: Store | null = phoneStore()): void {
  try { store?.removeItem(WALK_KEY); } catch { /* nothing stored that could be read back either */ }
}

/** Saved on this outing: no more than FRESH_HOURS ago (and not more than an hour "ahead", if the clock went back). */
export function isFresh(w: SavedWalk, now: number): boolean {
  const age = now - Date.parse(w.at);
  return age >= -3_600_000 && age <= FRESH_HOURS * 3_600_000;
}

/** The walk he is on, or null. */
export function walkOf(now = Date.now(), store: Store | null = phoneStore()): SavedWalk | null {
  const w = readWalk(store);
  return w && isFresh(w, now) ? w : null;
}
