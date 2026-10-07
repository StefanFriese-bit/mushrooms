import { LatLon as OsLatLon } from 'geodesy/osgridref.js';
import type { LatLon } from './geo';

// A find's spot as references a person can read out, write down or type into a map (spec 7): the OS grid reference
// (what UK walkers and fungus recorders use) and a Plus Code (the free, open equivalent of what3words). Both are worked
// out on the phone, with no signal and no account. Neither makes the spot more exact than the GPS fix it comes from.

/** The OS National Grid reference to 10 m ("SU 2824 0790"), or null outside the grid. The conversion from GPS
 * coordinates is good to about 5 m, so a finer reference would claim more than it knows. */
export function osGridRef(s: LatLon): string | null {
  try {
    return new OsLatLon(s.lat, s.lon).toOsGrid().toString(8);
  } catch {
    return null;
  }
}

// Open Location Code ("Plus Code"), encoding only — the published algorithm (github.com/google/open-location-code),
// checked against its own test data in src/finds/codes.test.ts.
const ALPHABET = '23456789CFGHJMPQRVWX';
const SEPARATOR_POSITION = 8;
const PAIR_LENGTH = 10;
const GRID_LENGTH = 5;
const LAT_PRECISION = 8000 * 5 ** GRID_LENGTH; // 2.5e7
const LNG_PRECISION = 8000 * 4 ** GRID_LENGTH; // 8,192,000

/** Degrees as the whole numbers the code is built from (floating point can put a spot one step over a boundary, which
 * Google's own tests allow for — the code is still the right box to within its size). */
export function plusCodeIntegers(s: LatLon): [number, number] {
  let lat = Math.floor(s.lat * LAT_PRECISION) + 90 * LAT_PRECISION;
  lat = Math.min(Math.max(lat, 0), 180 * LAT_PRECISION - 1);
  const lngSpan = 360 * LNG_PRECISION;
  let lng = Math.floor(s.lon * LNG_PRECISION) + 180 * LNG_PRECISION;
  lng = ((lng % lngSpan) + lngSpan) % lngSpan;
  return [lat, lng];
}

/** A Plus Code from the whole numbers (exact; checked against every case of Google's test data). */
export function plusCodeFromIntegers(latInt: number, lngInt: number, digits: number): string {
  const length = Math.min(digits, PAIR_LENGTH + GRID_LENGTH); // longer is no finer: the reference stops at 15
  if (length < 2 || (length < PAIR_LENGTH && length % 2 === 1)) throw new Error(`a Plus Code cannot be ${digits} digits long`);
  let lat = latInt;
  let lng = lngInt;
  let code = '';
  if (length > PAIR_LENGTH) {
    for (let i = 0; i < GRID_LENGTH; i++) {
      code = ALPHABET.charAt((lat % 5) * 4 + (lng % 4)) + code;
      lat = Math.floor(lat / 5);
      lng = Math.floor(lng / 4);
    }
  } else {
    lat = Math.floor(lat / 5 ** GRID_LENGTH);
    lng = Math.floor(lng / 4 ** GRID_LENGTH);
  }
  for (let i = 0; i < PAIR_LENGTH / 2; i++) {
    code = ALPHABET.charAt(lng % 20) + code;
    code = ALPHABET.charAt(lat % 20) + code;
    lat = Math.floor(lat / 20);
    lng = Math.floor(lng / 20);
  }
  code = `${code.slice(0, SEPARATOR_POSITION)}+${code.slice(SEPARATOR_POSITION)}`;
  if (length >= SEPARATOR_POSITION) return code.slice(0, length + 1);
  return `${code.slice(0, length)}${'0'.repeat(SEPARATOR_POSITION - length)}+`;
}

/** The Plus Code of a spot; 10 digits (the usual length) is a box of about 14 × 9 m in Britain. */
export function plusCode(s: LatLon, digits = 10): string {
  const [lat, lng] = plusCodeIntegers(s);
  return plusCodeFromIntegers(lat, lng, digits);
}
