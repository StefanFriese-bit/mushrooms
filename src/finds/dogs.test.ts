import { describe, expect, it } from 'vitest';
import { DOGS_GO_HREF, DOGS_KEY, dogsButtonHref, forgetDogs, freshDogs, isFresh, readDogs, saveDogs, sayDogsWhen } from './dogs';
import { hrefFor, parseHash } from '../router';

/** The phone's storage, in memory. */
function memory(start: Record<string, string> = {}) {
  const m = new Map(Object.entries(start));
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => { m.set(k, v); },
    removeItem: (k: string) => { m.delete(k); },
    raw: m,
  };
}
const HOUR = 3_600_000;
const SAVED = new Date('2026-10-13T08:42:00Z');
const SPOT = { lat: 51.6588, lon: 0.0466, accuracy: 6 };

describe('the dogs\' spot', () => {
  it('is saved with the time, read back, and forgotten', () => {
    const s = memory();
    expect(readDogs(s)).toBeNull();
    expect(saveDogs(SPOT, SAVED, s)).toEqual({ ...SPOT, at: '2026-10-13T08:42:00.000Z' });
    expect(readDogs(s)).toEqual({ ...SPOT, at: '2026-10-13T08:42:00.000Z' });
    forgetDogs(s);
    expect(readDogs(s)).toBeNull();
  });
  it('is one spot: saving again replaces it', () => {
    const s = memory();
    saveDogs(SPOT, SAVED, s);
    saveDogs({ lat: 51.7, lon: 0.05, accuracy: null }, new Date(SAVED.getTime() + HOUR), s);
    expect(readDogs(s)).toEqual({ lat: 51.7, lon: 0.05, accuracy: null, at: '2026-10-13T09:42:00.000Z' });
    expect(s.raw.size).toBe(1);
  });
  it('a spot placed by hand (no accuracy) is kept as such', () => {
    const s = memory();
    saveDogs({ lat: 51.6, lon: -1.2, accuracy: null }, SAVED, s);
    expect(readDogs(s)?.accuracy).toBeNull();
  });
  it('saying it is saved when the phone would not keep it is never allowed', () => {
    expect(() => saveDogs(SPOT, SAVED, null)).toThrow();
    const full = { ...memory(), setItem: () => { throw new Error('QuotaExceededError'); } };
    expect(() => saveDogs(SPOT, SAVED, full)).toThrow();
    const forgetful = { ...memory(), setItem: () => {} }; // takes it, keeps nothing
    expect(() => saveDogs(SPOT, SAVED, forgetful)).toThrow();
  });
  it('what cannot be read is no spot (never a wrong one)', () => {
    for (const bad of ['{', 'null', '"x"', '{"lat":51,"lon":0}', '{"lat":91,"lon":0,"accuracy":5,"at":"2026-10-13T08:42:00Z"}',
      '{"lat":51,"lon":0,"accuracy":-1,"at":"2026-10-13T08:42:00Z"}', '{"lat":51,"lon":0,"accuracy":5,"at":"yesterday-ish"}',
      '{"lat":"51","lon":0,"accuracy":5,"at":"2026-10-13T08:42:00Z"}']) {
      expect(readDogs(memory({ [DOGS_KEY]: bad }))).toBeNull();
    }
    const throwing = { getItem: () => { throw new Error('SecurityError'); }, setItem: () => {}, removeItem: () => {} };
    expect(readDogs(throwing)).toBeNull();
    expect(readDogs(null)).toBeNull();
  });
});

describe('this walk or an earlier one', () => {
  const d = { ...SPOT, at: SAVED.toISOString() };
  it('counts as this walk for 12 hours', () => {
    expect(isFresh(d, SAVED.getTime())).toBe(true);
    expect(isFresh(d, SAVED.getTime() + 12 * HOUR)).toBe(true);
    expect(isFresh(d, SAVED.getTime() + 12 * HOUR + 1)).toBe(false);
    expect(isFresh(d, SAVED.getTime() - 2 * HOUR)).toBe(false); // the clock was put back a long way
  });
  it('the Dogs button walks back to this walk\'s spot, else saves a new one', () => {
    const s = memory();
    expect(dogsButtonHref(SAVED.getTime(), s)).toBe('#/dogs');
    saveDogs(SPOT, SAVED, s);
    expect(dogsButtonHref(SAVED.getTime() + HOUR, s)).toBe(DOGS_GO_HREF);
    expect(freshDogs(SAVED.getTime() + HOUR, s)).not.toBeNull();
    expect(dogsButtonHref(SAVED.getTime() + 13 * HOUR, s)).toBe('#/dogs'); // tomorrow's walk starts by saving
    expect(freshDogs(SAVED.getTime() + 13 * HOUR, s)).toBeNull();
    expect(readDogs(s)).not.toBeNull(); // still there, to walk back to by hand
  });
  it('its addresses are the router\'s own', () => {
    expect(DOGS_GO_HREF).toBe(hrefFor({ name: 'dogs-go' }));
    expect(parseHash(DOGS_GO_HREF)).toEqual({ name: 'dogs-go' });
    expect(parseHash('#/dogs')).toEqual({ name: 'dogs' });
    expect(parseHash('#/dogs/new')).toEqual({ name: 'dogs-new' });
    expect(hrefFor({ name: 'dogs-new' })).toBe('#/dogs/new');
    expect(parseHash('#/dogs/go/x')).toEqual({ name: 'not-found', path: '/dogs/go/x' });
  });
  it('says when it was saved: the time today, the date too on another day', () => {
    const today = new Date(SAVED.getTime() + HOUR);
    const time = SAVED.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    expect(sayDogsWhen(SAVED.toISOString(), today)).toBe(`today at ${time}`);
    expect(sayDogsWhen(SAVED.toISOString(), new Date(SAVED.getTime() + 30 * HOUR))).toMatch(/2026/);
  });
});
