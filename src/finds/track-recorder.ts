import { defaultTrackName, freshFollow, takeReading, type Follow, type Reading, type Track } from './track';
import { listTracks, putTrack, walksChanged } from './track-store';

// Records the walk he is on (src/finds/track.ts). ONE recorder for the whole app, not tied to a screen: he presses
// Start, then goes on saving locations, scanning, reading the guide — the walk keeps recording, and a bar at the top of
// every page says so (src/screens/track.tsx RecordingBar).
//
// ⚠ An iPhone gives a web app NO location while its screen is locked or another app is in front. So while recording,
// the recorder asks the phone to keep the screen on (Screen Wake Lock), and asks again each time the app comes back to
// the front (the phone lets it go whenever the app is hidden). Where the phone cannot keep it on, the screen says so,
// and how to: Settings ▸ Display & Brightness ▸ Auto-Lock ▸ Never, for the walk.
//
// The walk is written to the phone as it grows (every SAVE_EVERY_MS, and when the app is hidden), so if the iPhone
// closes the app, opening it again carries the recording on — the time it was closed is a gap, never a straight line.

export const SAVE_EVERY_MS = 10_000;
/** How many times the walk being recorded is looked for when the app opens (src: resumeAfterClose). */
export const RESUME_TRIES = 8;

export type Keep = 'on' | 'cannot' | 'off';
export type RecorderState = {
  track: Track | null; // the walk being recorded, or null
  paused: boolean;
  /** Is the screen being kept on? 'cannot' = this phone would not (or does not know how). */
  keepScreen: Keep;
  /** The last reading's accuracy (m) and what was done with it, for the screen. */
  lastAccuracy: number | null;
  lastOutcome: string | null;
  here: Reading | null;
  problem: string | null;
  /** The recording carried on after the app had been closed. */
  resumed: boolean;
};

type Geo = Pick<Geolocation, 'watchPosition' | 'clearWatch'>;
type Deps = { geo?: Geo | null; now?: () => number; save?: (t: Track) => Promise<void>; load?: () => Promise<Track[]>; id?: () => string };

let state: RecorderState = { track: null, paused: false, keepScreen: 'off', lastAccuracy: null, lastOutcome: null, here: null, problem: null, resumed: false };
const subs = new Set<(s: RecorderState) => void>();
let follow: Follow = freshFollow();
let watchId: number | null = null;
let pausedAt: number | null = null;
let lastSave = 0;
let lock: { release: () => Promise<void>; addEventListener?: (t: string, l: () => void) => void } | null = null;
let deps: Required<Deps> = makeDeps({});

function makeDeps(d: Deps): Required<Deps> {
  return {
    geo: d.geo !== undefined ? d.geo : (typeof navigator !== 'undefined' && 'geolocation' in navigator ? navigator.geolocation : null),
    now: d.now ?? (() => Date.now()),
    save: d.save ?? ((t) => putTrack(t)),
    load: d.load ?? listTracks,
    id: d.id ?? (() => (typeof crypto.randomUUID === 'function' ? crypto.randomUUID()
      : [...crypto.getRandomValues(new Uint8Array(16))].map((x) => x.toString(16).padStart(2, '0')).join(''))),
  };
}
/** For the tests: a stand-in GPS, clock and store. */
export function useRecorderDeps(d: Deps): void { deps = makeDeps(d); }

const set = (patch: Partial<RecorderState>) => {
  state = { ...state, ...patch };
  for (const s of subs) { try { s(state); } catch { /* its own fault */ } }
};
export const recorderState = () => state;
export function onRecorder(l: (s: RecorderState) => void): () => void { subs.add(l); return () => subs.delete(l); }

async function saveNow(): Promise<void> {
  if (!state.track) return;
  lastSave = deps.now();
  try { await deps.save(state.track); } catch { set({ problem: 'The walk could not be written to the phone just now; it is still being recorded.' }); }
}

async function keepScreenOn(): Promise<void> {
  const wl = typeof navigator !== 'undefined' ? (navigator as unknown as { wakeLock?: { request: (k: 'screen') => Promise<typeof lock> } }).wakeLock : undefined;
  if (!wl) { set({ keepScreen: 'cannot' }); return; }
  try {
    lock = await wl.request('screen');
    set({ keepScreen: 'on' });
    lock?.addEventListener?.('release', () => { lock = null; if (state.track) set({ keepScreen: 'off' }); });
  } catch { set({ keepScreen: 'cannot' }); }
}
async function letScreenGo(): Promise<void> {
  const l = lock; lock = null;
  try { await l?.release(); } catch { /* already gone */ }
  set({ keepScreen: 'off' });
}

function onReading(r: Reading) {
  const t = state.track;
  if (!t || state.paused) { set({ here: r }); return; }
  const outcome = takeReading(t, follow, r);
  set({ track: { ...t }, here: r, lastAccuracy: Math.round(r.accuracy), lastOutcome: outcome, problem: null });
  if (deps.now() - lastSave >= SAVE_EVERY_MS || outcome === 'new-part') void saveNow();
}

function watch() {
  if (watchId !== null) return;
  if (!deps.geo) { set({ problem: 'This phone gives no location to the app, so a walk cannot be recorded.' }); return; }
  watchId = deps.geo.watchPosition(
    (p) => onReading({ lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy, at: deps.now(),
      alt: p.coords.altitude, altAccuracy: p.coords.altitudeAccuracy }),
    (e) => set({ problem: e.code === e.PERMISSION_DENIED
      ? 'Location is off for this app. Allow it in the iPhone\'s Settings to record a walk.'
      : 'No GPS reading yet. It needs a view of the sky; the walk carries on when one comes.' }),
    { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 },
  );
}
function unwatch() {
  if (watchId !== null) deps.geo?.clearWatch(watchId);
  watchId = null;
}

/** Start: a new walk, recorded from the next good reading. */
export async function startTrack(): Promise<void> {
  if (state.track) return;
  const start = new Date(deps.now()).toISOString();
  const track: Track = { id: deps.id(), start, end: null, name: defaultTrackName(start), parts: [], pausedMs: 0, gapMs: 0 };
  follow = freshFollow();
  pausedAt = null;
  set({ track, paused: false, problem: null, resumed: false, lastOutcome: null, lastAccuracy: null });
  await saveNow();
  watch();
  await keepScreenOn();
}

export function pauseTrack(): void {
  if (!state.track || state.paused) return;
  pausedAt = deps.now();
  set({ paused: true });
  void saveNow();
  void letScreenGo();
}
export async function resumeTrack(): Promise<void> {
  const t = state.track;
  if (!t || !state.paused) return;
  t.pausedMs += deps.now() - (pausedAt ?? deps.now());
  pausedAt = null;
  follow.breakNext = true; // where he walked while paused is not counted
  follow.lastAt = null;
  set({ paused: false, track: { ...t } });
  watch();
  await keepScreenOn();
}

/** Stop: the walk is saved under its date, and nothing is recorded any more. Returns it (null if nothing was on). */
export async function stopTrack(): Promise<Track | null> {
  const t = state.track;
  if (!t) return null;
  if (state.paused && pausedAt !== null) t.pausedMs += deps.now() - pausedAt;
  t.end = new Date(deps.now()).toISOString();
  unwatch();
  await letScreenGo();
  const done = { ...t };
  set({ track: null, paused: false, here: null, lastOutcome: null, lastAccuracy: null, resumed: false });
  try { await deps.save(done); } catch { set({ problem: 'The walk could not be written to the phone; its last saved copy stands.' }); }
  walksChanged();
  return done;
}

/** When the app opens: a walk still marked as being recorded (the app was closed mid-walk) carries on recording. */
export async function resumeAfterClose(): Promise<void> {
  if (state.track) return;
  // ⚠ Tried more than once: right after the app is closed and opened again, the iPhone's engine can refuse the very
  // first read of the database while the closed copy lets go of it, and a moment later answers. Giving up on that first
  // answer lost the walk being recorded (5 times in 8 in the test, 16/10/2026) — the walk was safe on the phone all along.
  let open: Track | undefined;
  for (let attempt = 0; ; attempt++) {
    try { open = (await deps.load()).find((t) => t.end === null); break; } catch {
      if (attempt >= RESUME_TRIES - 1) { set({ problem: 'A walk being recorded could not be read back from the phone. Open Record a walk again in a moment.' }); return; }
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  if (!open || state.track) return;
  follow = freshFollow();
  follow.breakNext = true;
  const last = open.parts.at(-1)?.at(-1);
  if (last) { follow.last = last; follow.lastAt = last.at; }
  set({ track: open, paused: false, resumed: true });
  watch();
  await keepScreenOn();
}

// The phone lets the screen lock go whenever the app is hidden: ask again when it is back. Save before it is hidden.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!state.track) return;
    if (document.visibilityState === 'hidden') void saveNow();
    else if (!state.paused && !lock) void keepScreenOn();
  });
  addEventListener('pagehide', () => { if (state.track) void saveNow(); });
}
