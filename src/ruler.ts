// The ruler on the screen (Stefan 10/10/2026, on "How wide is the cap?": "a ruler … with a centimeter so a person can
// gauge what the width is of the mushroom they're looking at because I doubt they'll have a measuring stick in the
// wild").
//
// A web page cannot ask a phone how big its screen is. A CSS centimetre is a fixed number of CSS pixels everywhere, and
// on an iPhone that comes out at about 6 mm. So the scale comes from Apple's own screen figures, and he can check it
// once against a bank card, which is the same size everywhere: ISO/IEC 7810 ID-1, 85.60 × 53.98 mm (Wikipedia,
// "ISO/IEC 7810"; ICAO Doc 9303 Part 5, the TD1 card, which takes the ID-1 size).

/** A bank card (ISO/IEC 7810 ID-1), in millimetres. */
export const CARD_MM = { long: 85.6, short: 53.98 } as const;

/** Device pixels in a centimetre, from Apple's Tech Specs pages (support.apple.com): an iPhone 15 has 460 ppi (2556 ×
 * 1179 pixels, 393 points across: 3 pixels a point); an iPhone 11 has 326 ppi (1792 × 828 pixels, 414 points: 2 a
 * point). In Safari a point is a CSS pixel, so CSS pixels a centimetre = these ÷ devicePixelRatio. */
const IPHONE_DEVICE_PX_PER_CM: Readonly<Record<number, number>> = { 3: 460 / 2.54, 2: 326 / 2.54 };
/** The iPhone 12 and 13 mini: 476 ppi, 1080 pixels across 375 points (2.88 a point; useyourloaf.com's screen-size
 * table) — 65.1 CSS pixels a centimetre. Their screen in points, 375 × 812, is also the iPhone X's, XS's and 11 Pro's
 * at 3 a point, so on that screen the scale cannot be told: the ruler takes the middle and asks to be checked. */
const MINI_CSS_PX_PER_CM = 375 / ((1080 / 476) * 2.54);
const AMBIGUOUS_DEVICE_PX_PER_CM = (IPHONE_DEVICE_PX_PER_CM[3] + 3 * MINI_CSS_PX_PER_CM) / 2;
/** Any other phone: a starting point only, and the ruler says it has not been checked. */
const GUESS_CSS_PX_PER_CM = 60;
export const PX_PER_CM_LIMITS = { min: 40, max: 90 } as const;

export type RulerFrom = 'card' | 'iphone' | 'unknown';
export type RulerScale = { pxPerCm: number; from: RulerFrom };
export type ScreenFacts = { dpr: number; iPhone: boolean; width: number; height: number };

/** CSS pixels in a centimetre on this screen, and where that comes from. `checked` is what he set with a bank card, in
 * device pixels a centimetre, so a change of zoom (another devicePixelRatio) keeps the ruler true. */
export function rulerScale(s: ScreenFacts, checked: number | null): RulerScale {
  const dpr = s.dpr > 0 ? s.dpr : 1;
  if (checked !== null && checked > 0) return { pxPerCm: checked / dpr, from: 'card' };
  if (s.iPhone) {
    const short = Math.min(s.width, s.height);
    const long = Math.max(s.width, s.height);
    const k = Math.round(dpr);
    if (k === 3 && short === 375 && long === 812) return { pxPerCm: AMBIGUOUS_DEVICE_PX_PER_CM / dpr, from: 'unknown' };
    const device = IPHONE_DEVICE_PX_PER_CM[k];
    if (device) return { pxPerCm: device / dpr, from: 'iphone' };
  }
  return { pxPerCm: GUESS_CSS_PX_PER_CM, from: 'unknown' };
}

export type Tick = { y: number; size: 'cm' | 'half' | 'mm'; cm?: number };
/** A mark every millimetre from 0 to `lengthPx`; every half centimetre longer, every centimetre longest and numbered. */
export function ticks(lengthPx: number, pxPerCm: number): Tick[] {
  const out: Tick[] = [];
  if (!(pxPerCm > 0) || !(lengthPx >= 0)) return out;
  for (let mm = 0; (mm * pxPerCm) / 10 <= lengthPx + 1e-9; mm++) {
    const y = (mm * pxPerCm) / 10;
    if (mm % 10 === 0) out.push({ y, size: 'cm', cm: mm / 10 });
    else out.push({ y, size: mm % 5 === 0 ? 'half' : 'mm' });
  }
  return out;
}

/** The card check, kept on this phone. Never throws: where the phone keeps nothing, it lasts until the app closes. */
const KEY = 'ruler-checked-device-px-per-cm';
let kept: number | null | undefined; // undefined: not read yet
export function loadChecked(): number | null {
  if (kept !== undefined) return kept;
  try {
    const v = Number(localStorage.getItem(KEY));
    kept = Number.isFinite(v) && v > 0 ? v : null;
  } catch { kept = null; }
  return kept;
}
export function saveChecked(devicePxPerCm: number | null): void {
  kept = devicePxPerCm;
  try {
    if (devicePxPerCm === null) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, String(devicePxPerCm));
  } catch { /* kept in memory only */ }
}
