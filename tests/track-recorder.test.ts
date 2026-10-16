import { beforeEach, describe, expect, it } from 'vitest';
import type { Track } from '../src/finds/track';
import { pauseTrack, recorderState, resumeAfterClose, resumeTrack, startTrack, stopTrack, useRecorderDeps } from '../src/finds/track-recorder';
import { trackStats } from '../src/finds/track';

// A stand-in GPS that the test moves, a clock the test sets, and a store that keeps what was saved.
let now = Date.parse('2026-10-16T13:00:00Z');
let cb: ((p: GeolocationPosition) => void) | null = null;
let watching = 0;
const saved = new Map<string, Track>();
const gps = {
  watchPosition: (ok: (p: GeolocationPosition) => void) => { cb = ok; watching++; return 1; },
  clearWatch: () => { cb = null; watching--; },
};
/** He is `north` metres north of the start; `secs` on the clock. */
function walkTo(north: number, secs: number, alt: number | null = null) {
  now = Date.parse('2026-10-16T13:00:00Z') + secs * 1000;
  cb?.({ coords: { latitude: 51.6588 + north / 111_320, longitude: 0.0466, accuracy: 5, altitude: alt, altitudeAccuracy: alt === null ? null : 5 } } as unknown as GeolocationPosition);
}

beforeEach(async () => {
  if (recorderState().track) await stopTrack();
  saved.clear(); now = Date.parse('2026-10-16T13:00:00Z'); cb = null; watching = 0;
  useRecorderDeps({ geo: gps as unknown as Geolocation, now: () => now, save: async (t) => { saved.set(t.id, structuredClone(t)); },
    load: async () => [...saved.values()], id: () => `walk-${saved.size + 1}` });
});

describe('the recorder', () => {
  it('Start, walk 500 m, Stop: the walk is saved, finished, with its distance; the GPS is let go', async () => {
    await startTrack();
    expect(recorderState().track?.end).toBeNull();
    expect(saved.size).toBe(1); // written to the phone at once
    for (let i = 0; i <= 50; i++) walkTo(i * 10, i * 8);
    const done = await stopTrack();
    expect(done?.end).not.toBeNull();
    expect(trackStats(done!).distanceM).toBeGreaterThan(495);
    expect(saved.get(done!.id)?.end).not.toBeNull();
    expect(recorderState().track).toBeNull();
    expect(watching).toBe(0);
  });
  it('Pause: walking while paused is not counted, and the time paused comes off', async () => {
    await startTrack();
    for (let i = 0; i <= 10; i++) walkTo(i * 10, i * 8); // 100 m in 80 s
    pauseTrack();
    walkTo(200, 100);
    walkTo(400, 380);
    await resumeTrack();
    walkTo(410, 400);
    walkTo(420, 408);
    const done = (await stopTrack())!;
    const s = trackStats(done);
    expect(s.distanceM).toBeGreaterThan(105); // 100 m before Pause + 10 m after it; the 300 m while paused left out
    expect(s.distanceM).toBeLessThan(115);
    expect(done.pausedMs).toBe(300_000);
    expect(s.parts).toBe(2);
  });
  it('the app closed mid-walk: when it opens, recording carries on; the part walked while closed is not counted', async () => {
    await startTrack();
    for (let i = 0; i <= 10; i++) walkTo(i * 10, i * 8);
    const open = structuredClone(recorderState().track!);
    saved.set(open.id, open);
    // The app is closed: everything in memory is gone. (Stopping it here stands in for that, then the record is put back.)
    await stopTrack();
    saved.set(open.id, open);
    await resumeAfterClose();
    expect(recorderState().resumed).toBe(true);
    walkTo(500, 600);
    walkTo(510, 608);
    const done = (await stopTrack())!;
    expect(trackStats(done).distanceM).toBeGreaterThan(105);
    expect(trackStats(done).distanceM).toBeLessThan(115);
  });
  it('the database refuses the first reads when the app opens again: it keeps trying, and the walk carries on', async () => {
    await startTrack();
    for (let i = 0; i <= 5; i++) walkTo(i * 10, i * 8);
    const open = structuredClone(recorderState().track!);
    await stopTrack();
    saved.set(open.id, open);
    let refusals = 2;
    useRecorderDeps({ geo: gps as unknown as Geolocation, now: () => now, save: async (t) => { saved.set(t.id, structuredClone(t)); },
      load: async () => { if (refusals-- > 0) throw new Error('UnknownError'); return [...saved.values()]; }, id: () => 'x' });
    await resumeAfterClose();
    expect(recorderState().track?.id).toBe(open.id);
    expect(recorderState().resumed).toBe(true);
  });
});
