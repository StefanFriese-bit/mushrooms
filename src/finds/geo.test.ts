import { describe, expect, it } from 'vitest';
import { appleMapsLink, distanceM, sayAccuracy, sayDistance, saySpot } from './geo';

describe('geo', () => {
  it('measures the distance between two spots on the ground', () => {
    expect(distanceM({ lat: 51.5, lon: -0.1 }, { lat: 51.5, lon: -0.1 })).toBe(0);
    expect(Math.round(distanceM({ lat: 51.5, lon: -0.1 }, { lat: 51.501, lon: -0.1 }))).toBe(111); // 0.001° of latitude
    expect(Math.round(distanceM({ lat: 52.2053, lon: 0.1218 }, { lat: 51.7520, lon: -1.2577 }) / 1000)).toBe(107); // Cambridge–Oxford in a straight line
  });
  it('says a distance the way a walker reads it', () => {
    expect(sayDistance(8.4)).toBe('8 m');
    expect(sayDistance(940)).toBe('940 m');
    expect(sayDistance(1234)).toBe('1.2 km');
    expect(sayDistance(25300)).toBe('25 km');
  });
  it('says how exact a GPS spot is', () => {
    expect(sayAccuracy(4.6)).toBe('within 5 m');
    expect(sayAccuracy(null)).toBe('placed by hand');
  });
  it('writes a spot as latitude and longitude to five places (about a metre)', () => {
    expect(saySpot({ lat: 51.501234567, lon: -0.123456789 })).toBe('51.50123, -0.12346');
  });
  it('opens Apple Maps with walking directions to the spot', () => {
    expect(appleMapsLink({ lat: 51.50123, lon: -0.12346 })).toBe('https://maps.apple.com/?daddr=51.50123,-0.12346&dirflg=w');
  });
});
