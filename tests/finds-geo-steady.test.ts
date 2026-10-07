import { describe, expect, it } from 'vitest';
import { bearingDeg, circleRing, compassWord, distanceM, isThere, steadySpot, type Fix } from '../src/finds/geo';

const at = (lat: number, lon: number, accuracy: number, t: number): Fix => ({ lat, lon, accuracy, at: t });

describe('the way back to a find', () => {
  it('gives the direction to walk, clockwise from north', () => {
    const here = { lat: 51.0, lon: -1.0 };
    expect(bearingDeg(here, { lat: 51.001, lon: -1.0 })).toBeCloseTo(0, 0);
    expect(bearingDeg(here, { lat: 51.0, lon: -0.999 })).toBeCloseTo(90, 0);
    expect(bearingDeg(here, { lat: 50.999, lon: -1.0 })).toBeCloseTo(180, 0);
    expect(bearingDeg(here, { lat: 51.0, lon: -1.001 })).toBeCloseTo(270, 0);
  });
  it('names the eight compass points', () => {
    expect([0, 44, 46, 90, 135, 180, 225, 270, 315, 359, -10].map(compassWord))
      .toEqual(['north', 'north-east', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north']);
  });
  it('says "you are there" within what the two readings can tell apart, never closer than 5 m', () => {
    expect(isThere(4, 2, 2)).toBe(true);
    expect(isThere(6, 2, 2)).toBe(false);
    expect(isThere(15, 8, 9)).toBe(true);
    expect(isThere(20, 8, 9)).toBe(false);
    expect(isThere(9, 8, null)).toBe(false); // a pin placed by hand: only his own reading counts
  });
});

describe('a steadier spot when saving a find', () => {
  it('averages the readings about as good as the best, the better ones counting more', () => {
    const s = steadySpot([at(51.0003, -1.0, 40, 0), at(51.0, -1.0, 4, 1000), at(51.00002, -1.00002, 4, 2000)], 3000)!;
    expect(s.readings).toBe(2); // the 40 m reading is left out
    expect(s.lat).toBeCloseTo(51.00001, 6);
    expect(s.lon).toBeCloseTo(-1.00001, 6);
    expect(s.accuracy).toBe(4); // never claims more than the best single reading
  });
  it('leaves out where he was before he walked on', () => {
    // three good readings 50 m back, then two where he stands now
    const back = [at(51.0, -1.0, 4, 0), at(51.0, -1.0, 4, 1000), at(51.0, -1.0, 4, 2000)];
    const now = [at(51.00045, -1.0, 5, 20_000), at(51.00045, -1.0, 5, 21_000)];
    const s = steadySpot([...back, ...now], 21_000)!;
    expect(s.readings).toBe(2);
    expect(distanceM(s, { lat: 51.00045, lon: -1.0 })).toBeLessThan(0.5);
  });
  it('forgets readings older than a minute, and has nothing to say without readings', () => {
    expect(steadySpot([at(51, -1, 3, 0)], 61_000)).toBeNull();
    expect(steadySpot([], 0)).toBeNull();
    const s = steadySpot([at(51, -1, 3, 0), at(51.0001, -1, 5, 59_000)], 61_000)!;
    expect(s.readings).toBe(1);
    expect(distanceM(s, { lat: 51.0001, lon: -1 })).toBeLessThan(0.01);
  });
});

describe('the accuracy circle on the map', () => {
  it('is a closed ring whose every point lies the radius away from the spot', () => {
    const c = { lat: 52.5, lon: -1.9 };
    const ring = circleRing(c, 12);
    expect(ring[0]).toEqual(ring.at(-1));
    for (const [lon, lat] of ring) expect(distanceM(c, { lat, lon })).toBeCloseTo(12, 0);
  });
});
