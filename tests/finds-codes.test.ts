import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { osGridRef, plusCode, plusCodeFromIntegers, plusCodeIntegers } from '../src/finds/codes';

// A find's spot as an OS grid reference and a Plus Code (src/finds/codes.ts).
const CASES = readFileSync(new URL('./fixtures/olc-encoding.csv', import.meta.url), 'utf8').split('\n')
  .filter((l) => l && !l.startsWith('#')).map((l) => l.split(','));

describe('Plus Codes, against Google\'s own test data', () => {
  it('encodes every case exactly from the whole numbers', () => {
    expect(CASES.length).toBe(302);
    for (const [, , latInt, lngInt, len, code] of CASES) expect(plusCodeFromIntegers(Number(latInt), Number(lngInt), Number(len))).toBe(code);
  });
  it('from degrees, at most 5% differ by one step, as Google\'s own tests allow (floating point)', () => {
    const off = CASES.filter(([lat, lng, , , len, code]) => plusCode({ lat: Number(lat), lon: Number(lng) }, Number(len)) !== code);
    expect(off.length / CASES.length).toBeLessThan(0.05);
    const near = CASES.filter(([lat, lng, latInt, lngInt]) => {
      const [a, b] = plusCodeIntegers({ lat: Number(lat), lon: Number(lng) });
      return Math.abs(a - Number(latInt)) > 1 || Math.abs(b - Number(lngInt)) > 1;
    });
    expect(near).toEqual([]); // never more than one step out
  });
  it('a British spot gets the usual 10-digit code', () => {
    expect(plusCode({ lat: 50.87, lon: -1.6 })).toMatch(/^9C2W[2-9CFGHJMPQRVWX]{4}\+[2-9CFGHJMPQRVWX]{2}$/);
  });
});

describe('OS grid references', () => {
  it('match geodesy\'s worked example to 10 m', () => {
    expect(osGridRef({ lat: 52.65798, lon: 1.71605 })).toBe('TG 5140 1317'); // TG 51409 13177 to 1 m
  });
  it('cover Great Britain, its far corners included, and nothing far outside it', () => {
    expect(osGridRef({ lat: 50.87, lon: -1.6 })).toBe('SU 2824 0790'); // the New Forest
    expect(osGridRef({ lat: 60.15, lon: -1.15 })).toMatch(/^HU /); // Shetland
    expect(osGridRef({ lat: 49.92, lon: -6.3 })).toMatch(/^SV /); // the Scilly Isles
    expect(osGridRef({ lat: 48.85, lon: 2.35 })).toBeNull(); // Paris
  });
});
