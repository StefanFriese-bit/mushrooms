import { distanceM, type LatLon } from './geo';

// A recorded walk (Stefan 16/10/2026: "press start and it kind of tracks my kilometres and my route and it shows me
// where I've walked … allocated to a date and stored, so … I can see where the last four times I walked is" — the
// way AllTrails does, with the climb). Not the PLANNED walk round his saved locations (src/finds/walk.ts): this one is
// what he really walked, point by point, from the GPS.
//
// The rules here are pure (no GPS, no storage), so every one of them is tested on its own:
// - a reading less exact than WEAK_M is not used (under trees the GPS can wander 50 m);
// - a point is added only once he has moved further than the reading can tell apart — standing still for ten minutes
//   while picking mushrooms must not add up to a kilometre of GPS wander;
// - a jump faster than anyone walks is not believed; if the GPS keeps saying he is there, it starts a new part there;
// - ⛔ a GAP is never counted as a straight line: when the phone gave no reading for a while (the screen locked, the
//   app closed, Pause) and he is somewhere else when it comes back, the walk carries on as a new PART — the line is
//   broken there, and neither the distance nor the climb across the gap is counted. The screen says how long it was.

export type TrackPoint = LatLon & { at: number; accuracy: number; alt: number | null };
export type Track = {
  id: string;
  start: string; // ISO
  end: string | null; // ISO; null while it is being recorded
  name: string;
  /** The walk in parts: a new part begins after a gap (see above). Each part is a line of its own. */
  parts: TrackPoint[][];
  /** Milliseconds he had it paused (taken off the time). */
  pausedMs: number;
  /** Milliseconds with no usable reading while recording and not paused (the screen locked, the app shut). */
  gapMs: number;
};

/** One reading off the phone: where, how exact (m), when (ms), and its height above sea level when it gives one. */
export type Reading = LatLon & { at: number; accuracy: number; alt?: number | null; altAccuracy?: number | null };

export const WEAK_M = 35;
/** Faster than this between two points (m/s, about 22 km/h) is a GPS jump, not a walk. */
export const JUMP_MPS = 6;
/** No reading for longer than this, and moved more than GAP_MOVED_M: the part ends there. */
export const GAP_MS = 60_000;
export const GAP_MOVED_M = 30;
/** A height reading less exact than this (m) is left out of the climb. */
export const WEAK_ALT_M = 25;
/** The climb counts a rise or fall only once it is this big (m): GPS height wobbles a few metres on level ground. */
export const CLIMB_STEP_M = 4;

/** What the recorder keeps between readings, besides the track itself. */
export type Follow = { last: TrackPoint | null; lastAt: number | null; jumps: TrackPoint[]; breakNext: boolean };
export const freshFollow = (): Follow => ({ last: null, lastAt: null, jumps: [], breakNext: false });

/** How far he must move before a point is added: what the reading can tell apart, never under 5 m, never over 20 m. */
export const stepM = (accuracy: number) => Math.max(5, Math.min(20, accuracy));

function asPoint(r: Reading): TrackPoint {
  const altOk = typeof r.alt === 'number' && Number.isFinite(r.alt) && (r.altAccuracy == null || r.altAccuracy <= WEAK_ALT_M);
  return { lat: r.lat, lon: r.lon, at: r.at, accuracy: r.accuracy, alt: altOk ? (r.alt as number) : null };
}

/**
 * Takes one reading into the track. Returns what happened, so the screen (and the tests) can say it:
 * 'weak' not used · 'still' not far enough from the last point · 'added' · 'new-part' a new part began here ·
 * 'jump' not believed (yet).
 */
export function takeReading(t: Track, f: Follow, r: Reading): 'weak' | 'still' | 'added' | 'new-part' | 'jump' {
  if (!Number.isFinite(r.accuracy) || r.accuracy > WEAK_M) return 'weak';
  const p = asPoint(r);
  const last = f.last;
  const since = f.lastAt === null ? 0 : r.at - f.lastAt;
  f.lastAt = r.at;
  const begin = (): 'new-part' => {
    t.parts.push([p]);
    f.last = p;
    f.jumps = [];
    f.breakNext = false;
    return 'new-part';
  };
  if (!last || t.parts.length === 0) return begin();
  const moved = distanceM(last, p);
  // Back after a gap (or Pause) somewhere else: a new part, the gap not counted.
  if ((f.breakNext || since > GAP_MS) && moved > GAP_MOVED_M) {
    if (since > GAP_MS && !f.breakNext) t.gapMs += since;
    return begin();
  }
  f.breakNext = false;
  if (moved < stepM(r.accuracy)) return 'still';
  const secs = Math.max(1, (p.at - last.at) / 1000);
  if (moved / secs > JUMP_MPS) {
    // Believed only when the GPS says so three times running, close together: then it is a new part there.
    const near = f.jumps.length === 0 || distanceM(f.jumps[f.jumps.length - 1], p) <= Math.max(GAP_MOVED_M, r.accuracy * 2);
    f.jumps = near ? [...f.jumps, p] : [p];
    if (f.jumps.length >= 3) return begin();
    return 'jump';
  }
  f.jumps = [];
  t.parts[t.parts.length - 1].push(p);
  f.last = p;
  return 'added';
}

/** The climb and descent of one line of heights: a rise or fall counts once it passes CLIMB_STEP_M from the last
 * turning point, so wobble on level ground adds nothing. */
export function climbOf(heights: number[]): { up: number; down: number } {
  let up = 0, down = 0;
  if (heights.length === 0) return { up, down };
  let ref = heights[0];
  for (const h of heights.slice(1)) {
    if (h - ref >= CLIMB_STEP_M) { up += h - ref; ref = h; }
    else if (ref - h >= CLIMB_STEP_M) { down += ref - h; ref = h; }
  }
  return { up, down };
}

/** Heights smoothed over five points (each single height reading can be several metres out). */
function smooth(hs: number[]): number[] {
  return hs.map((_, i) => {
    const w = hs.slice(Math.max(0, i - 2), i + 3);
    return w.reduce((a, b) => a + b, 0) / w.length;
  });
}

export type TrackStats = {
  distanceM: number;
  /** Time walking: from Start to now/Stop, less Pause. */
  timeMs: number;
  up: number; down: number;
  high: number | null; low: number | null;
  parts: number;
  gapMs: number;
  points: number;
};

export function trackStats(t: Track, now = Date.now()): TrackStats {
  let dist = 0, up = 0, down = 0, points = 0;
  const all: number[] = [];
  for (const part of t.parts) {
    points += part.length;
    for (let i = 1; i < part.length; i++) dist += distanceM(part[i - 1], part[i]);
    const hs = part.map((p) => p.alt).filter((h): h is number => h !== null);
    const c = climbOf(smooth(hs));
    up += c.up; down += c.down;
    all.push(...hs);
  }
  const end = t.end ? Date.parse(t.end) : now;
  return {
    distanceM: dist, timeMs: Math.max(0, end - Date.parse(t.start) - t.pausedMs), up: Math.round(up), down: Math.round(down),
    high: all.length ? Math.round(Math.max(...all)) : null, low: all.length ? Math.round(Math.min(...all)) : null,
    parts: t.parts.length, gapMs: t.gapMs, points,
  };
}

/** Height against distance along the walk (m, m), for the profile under the map; gaps are not counted in the distance. */
export function heightProfile(t: Track): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  let along = 0;
  for (const part of t.parts) {
    for (let i = 0; i < part.length; i++) {
      if (i > 0) along += distanceM(part[i - 1], part[i]);
      if (part[i].alt !== null) out.push([along, part[i].alt as number]);
    }
  }
  return out;
}

/** "2.37 km", or metres under one kilometre. */
export const sayKm = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(2)} km`);

/** "1 h 05 min", "12 min", "45 s". */
export function sayDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
}

/** A walk's name until he gives it one: "Walk · Thu 16 Oct, 14:05". */
export function defaultTrackName(startIso: string): string {
  const d = new Date(startIso);
  const day = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `Walk · ${day}, ${time}`;
}

/** The colours of the walks on the map: the one being recorded, then the last ones, newest first. */
export const NOW_COLOUR = '#2b8a3e';
export const PAST_COLOURS = ['#d9480f', '#7048e8', '#0c8599', '#c2255c'];

/** A stored walk checked before it is used (a damaged record must not break the map). */
export function isTrack(v: unknown): v is Track {
  if (!v || typeof v !== 'object') return false;
  const t = v as Record<string, unknown>;
  const num = (x: unknown) => typeof x === 'number' && Number.isFinite(x);
  return typeof t.id === 'string' && typeof t.start === 'string' && !Number.isNaN(Date.parse(t.start))
    && (t.end === null || (typeof t.end === 'string' && !Number.isNaN(Date.parse(t.end)))) && typeof t.name === 'string'
    && num(t.pausedMs) && num(t.gapMs) && Array.isArray(t.parts)
    && t.parts.every((part) => Array.isArray(part) && part.every((p) => p && typeof p === 'object'
      && num((p as TrackPoint).lat) && num((p as TrackPoint).lon) && num((p as TrackPoint).at)
      && ((p as TrackPoint).alt === null || num((p as TrackPoint).alt))));
}
