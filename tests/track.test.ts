import { describe, expect, it } from 'vitest';
import { climbOf, defaultTrackName, freshFollow, heightProfile, sayDuration, sayKm, takeReading, trackStats, type Reading, type Track } from '../src/finds/track';
import { distanceM } from '../src/finds/geo';

const START = Date.parse('2026-10-16T13:00:00Z');
const newTrack = (): Track => ({ id: 't', start: new Date(START).toISOString(), end: null, name: 'x', parts: [], pausedMs: 0, gapMs: 0 });
/** A reading `north` metres north and `east` metres east of the start, `secs` seconds in. */
const at = (north: number, east: number, secs: number, extra: Partial<Reading> = {}): Reading => ({
  lat: 51.6588 + north / 111_320, lon: 0.0466 + east / (111_320 * Math.cos((51.6588 * Math.PI) / 180)),
  at: START + secs * 1000, accuracy: 5, ...extra,
});

describe('recording a walk', () => {
  it('a straight 1 km walk north at walking pace comes to 1 km', () => {
    const t = newTrack(); const f = freshFollow();
    for (let i = 0; i <= 100; i++) takeReading(t, f, at(i * 10, 0, i * 8)); // 10 m every 8 s = 4.5 km/h
    const s = trackStats(t, START + 800_000);
    expect(s.distanceM).toBeGreaterThan(990);
    expect(s.distanceM).toBeLessThan(1010);
    expect(s.parts).toBe(1);
  });
  it('standing still for ten minutes with GPS wander adds nothing', () => {
    const t = newTrack(); const f = freshFollow();
    for (let i = 0; i < 120; i++) takeReading(t, f, at(Math.sin(i) * 3, Math.cos(i) * 3, i * 5, { accuracy: 6 }));
    expect(trackStats(t).distanceM).toBeLessThan(10);
  });
  it('a reading worse than 35 m is not used', () => {
    const t = newTrack(); const f = freshFollow();
    takeReading(t, f, at(0, 0, 0));
    expect(takeReading(t, f, at(200, 0, 60, { accuracy: 80 }))).toBe('weak');
    expect(trackStats(t).distanceM).toBe(0);
  });
  it('a single GPS jump is not believed; the walk carries on from where he really is', () => {
    const t = newTrack(); const f = freshFollow();
    takeReading(t, f, at(0, 0, 0));
    takeReading(t, f, at(10, 0, 8));
    expect(takeReading(t, f, at(400, 0, 10))).toBe('jump');
    expect(takeReading(t, f, at(20, 0, 16))).toBe('added');
    expect(trackStats(t).distanceM).toBeLessThan(25);
  });
  it('a GPS that keeps saying he is elsewhere starts a new part there, the jump not counted', () => {
    const t = newTrack(); const f = freshFollow();
    takeReading(t, f, at(0, 0, 0));
    takeReading(t, f, at(400, 0, 5));
    takeReading(t, f, at(402, 0, 6));
    expect(takeReading(t, f, at(404, 0, 7))).toBe('new-part');
    expect(t.parts.length).toBe(2);
    expect(trackStats(t).distanceM).toBe(0);
  });
  it('⛔ a gap (screen locked, app shut) is never a straight line: a new part, its time said', () => {
    const t = newTrack(); const f = freshFollow();
    takeReading(t, f, at(0, 0, 0));
    takeReading(t, f, at(10, 0, 8));
    // Five minutes with no reading, and he is 300 m on.
    expect(takeReading(t, f, at(310, 0, 308))).toBe('new-part');
    takeReading(t, f, at(320, 0, 316));
    const s = trackStats(t);
    expect(s.parts).toBe(2);
    expect(s.distanceM).toBeGreaterThan(19);
    expect(s.distanceM).toBeLessThan(21);
    expect(s.gapMs).toBe(300_000);
  });
  it('a gap where he stood still carries the same line on', () => {
    const t = newTrack(); const f = freshFollow();
    takeReading(t, f, at(0, 0, 0));
    takeReading(t, f, at(10, 0, 8));
    takeReading(t, f, at(12, 0, 300));
    takeReading(t, f, at(22, 0, 308));
    expect(trackStats(t).parts).toBe(1);
  });
  it('after Pause, where he walked is not counted', () => {
    const t = newTrack(); const f = freshFollow();
    takeReading(t, f, at(0, 0, 0));
    takeReading(t, f, at(10, 0, 8));
    f.breakNext = true; f.lastAt = null;
    expect(takeReading(t, f, at(100, 0, 20))).toBe('new-part');
    expect(trackStats(t).distanceM).toBeLessThan(11);
  });
});

describe('the climb', () => {
  it('counts a hill up and down, not the wobble on level ground', () => {
    expect(climbOf([100, 102, 99, 101, 100, 102])).toEqual({ up: 0, down: 0 });
    expect(climbOf([100, 110, 120, 130, 120, 110])).toEqual({ up: 30, down: 20 });
  });
  it('a walk up a 50 m hill: about 50 m up, the high and low points, a height profile', () => {
    const t = newTrack(); const f = freshFollow();
    for (let i = 0; i <= 50; i++) takeReading(t, f, at(i * 10, 0, i * 8, { alt: 60 + i, altAccuracy: 5 }));
    const s = trackStats(t);
    expect(s.up).toBeGreaterThanOrEqual(45);
    expect(s.up).toBeLessThanOrEqual(50);
    expect(s.down).toBe(0);
    expect(s.high).toBe(110);
    expect(s.low).toBe(60);
    const prof = heightProfile(t);
    expect(prof.length).toBe(51);
    expect(prof.at(-1)![0]).toBeCloseTo(500, -1);
  });
  it('heights the phone is unsure of are left out', () => {
    const t = newTrack(); const f = freshFollow();
    takeReading(t, f, at(0, 0, 0, { alt: 50, altAccuracy: 60 }));
    takeReading(t, f, at(10, 0, 8, { alt: null }));
    expect(trackStats(t).high).toBeNull();
  });
});

describe('how a walk reads', () => {
  it('distance, time and name', () => {
    expect(sayKm(2371)).toBe('2.37 km');
    expect(sayKm(420)).toBe('420 m');
    expect(sayDuration(3_900_000)).toBe('1 h 05 min');
    expect(sayDuration(720_000)).toBe('12 min');
    expect(defaultTrackName('2026-10-16T13:05:00Z')).toMatch(/^Walk · Fri 16 Oct, \d\d:05$/);
  });
  it('the time leaves out Pause', () => {
    const t = { ...newTrack(), end: new Date(START + 3_600_000).toISOString(), pausedMs: 600_000 };
    expect(trackStats(t).timeMs).toBe(3_000_000);
  });
  it('test helper is sane', () => { expect(distanceM(at(0, 0, 0), at(100, 0, 0))).toBeCloseTo(100, 0); });
});
