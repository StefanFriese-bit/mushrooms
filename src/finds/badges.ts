// The three mushrooms he marks with a picture (Stefan 16/10/2026): "a crown for the Penny Bun Bolete, a red cap with
// white dots for the Fly Agaric, a thin silver tree for the Birch Bolete" — picked above the description when he saves
// a location, and drawn as the location's pin on every map, so a look at the map says what grows where.
//
// A picture IS the species: picking one names the location as that species (the same `species` field its own page
// sets), so the map's species choice, the word search and the location's title all follow it. A location named any of
// these three on its page gets the picture too.

export type BadgeKey = 'penny-bun' | 'fly-agaric' | 'birch-bolete';
export type Badge = { key: BadgeKey; name: string; species: string; svg: string };

// Drawn on a 32 × 32 square, in their own colours (they are pictures, not line icons). Plain constants: never built
// from anything he typed, so they are safe to put into the page as they are.
const PENNY_BUN = `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<path d="M9.5 6.5 11.5 10.5 16 5.5 20.5 10.5 22.5 6.5 22.5 12.5H9.5Z" fill="#f2b705" stroke="#a67c00" stroke-width="1" stroke-linejoin="round"/>
<circle cx="9.5" cy="6.3" r="1.3" fill="#f2b705" stroke="#a67c00" stroke-width=".8"/><circle cx="16" cy="5.2" r="1.3" fill="#f2b705" stroke="#a67c00" stroke-width=".8"/><circle cx="22.5" cy="6.3" r="1.3" fill="#f2b705" stroke="#a67c00" stroke-width=".8"/>
<path d="M4 21.5C4 15.5 9.5 12.5 16 12.5S28 15.5 28 21.5Z" fill="#8a5a2b" stroke="#5c3a17" stroke-width="1"/>
<path d="M12 21.5H20L21 28.5Q16 30 11 28.5Z" fill="#efe3c8" stroke="#a89670" stroke-width="1" stroke-linejoin="round"/>
</svg>`;

const FLY_AGARIC = `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<path d="M13 18.5H19L20 28.5Q16 30 12 28.5Z" fill="#fbfbf7" stroke="#b8b8b0" stroke-width="1" stroke-linejoin="round"/>
<path d="M12.2 21.5H19.8" stroke="#b8b8b0" stroke-width="1.4" stroke-linecap="round"/>
<path d="M3 18.5C3 10.5 9 5 16 5S29 10.5 29 18.5Z" fill="#d7261e" stroke="#8f140f" stroke-width="1"/>
<circle cx="10" cy="13" r="1.7" fill="#fff"/><circle cx="16" cy="9" r="1.8" fill="#fff"/><circle cx="21.5" cy="12" r="1.6" fill="#fff"/>
<circle cx="14.5" cy="15" r="1.4" fill="#fff"/><circle cx="24.5" cy="16" r="1.2" fill="#fff"/><circle cx="7" cy="16.5" r="1.1" fill="#fff"/><circle cx="19" cy="16" r="1.1" fill="#fff"/>
</svg>`;

const BIRCH_BOLETE = `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<path d="M16 10 8.5 5.5M16 14.5 23.5 9.5M16 19 9.5 15.5" stroke="#7d8792" stroke-width="1.5" stroke-linecap="round"/>
<path d="M14 30.5V3.5Q16 2 18 3.5V30.5Z" fill="#e9ecf1" stroke="#7d8792" stroke-width="1.2" stroke-linejoin="round"/>
<path d="M14 8H16.6M15.6 12.5H18M14 17H16.8M15.2 21.5H18M14 26H16.4" stroke="#2f343a" stroke-width="1.6" stroke-linecap="round"/>
<ellipse cx="7.8" cy="5" rx="2.6" ry="1.6" fill="#9cbf3b"/><ellipse cx="24.4" cy="9" rx="2.6" ry="1.6" fill="#9cbf3b"/><ellipse cx="8.6" cy="15" rx="2.4" ry="1.5" fill="#9cbf3b"/>
</svg>`;

export const BADGES: readonly Badge[] = [
  { key: 'penny-bun', name: 'Penny Bun', species: 'Boletus edulis', svg: PENNY_BUN },
  { key: 'fly-agaric', name: 'Fly Agaric', species: 'Amanita muscaria', svg: FLY_AGARIC },
  { key: 'birch-bolete', name: 'Birch Bolete', species: 'Leccinum scabrum', svg: BIRCH_BOLETE },
];

/** The picture for a location's species, or null when it is none of the three (or not named yet). */
export function badgeFor(species: string | null | undefined): Badge | null {
  if (!species) return null;
  return BADGES.find((b) => b.species === species) ?? null;
}

export function badgeByKey(key: BadgeKey | null | undefined): Badge | null {
  return key ? BADGES.find((b) => b.key === key) ?? null : null;
}

// Locations saved before the pictures existed (Stefan 16/10/2026: "it just shows them still as these red teardrop
// icons … I don't have to click on each one to see what it is when I'm navigating — that's the whole point"): a
// location that is not named as a species takes its picture from what he wrote, when the description names exactly
// one of the three. Whole names only, so "bun" alone or "birch" alone gives nothing.
const NAMES_IN_WORDS: Record<BadgeKey, string[][]> = {
  'penny-bun': [['penny', 'bun'], ['cep'], ['porcini'], ['king', 'bolete'], ['boletus', 'edulis']],
  'fly-agaric': [['fly', 'agaric'], ['amanita', 'muscaria']],
  'birch-bolete': [['birch', 'bolete'], ['leccinum', 'scabrum']],
};
/** Words as they are compared: lower case, accents off, a plural "s" dropped (penny buns, ceps, fly agarics). */
function bareWords(s: string): string[] {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().split(/[^\p{Letter}\p{Number}]+/u).filter(Boolean)
    .map((w) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w));
}
function hasName(ws: string[], name: string[]): boolean {
  for (let i = 0; i + name.length <= ws.length; i++) if (name.every((n, k) => ws[i + k] === n)) return true;
  return false;
}
/** The picture a description names — null when it names none of the three, or more than one. */
export function badgeFromWords(text: string): Badge | null {
  const ws = bareWords(text);
  const named = BADGES.filter((b) => NAMES_IN_WORDS[b.key].some((n) => hasName(ws, n)));
  return named.length === 1 ? named[0] : null;
}
/** A saved location's picture: the species it is named as; when it is not named at all, the one its description names.
 * Named as another species = no picture (what he identified it as wins over what he first wrote). */
export function badgeOfFind(f: { species: string | null; notes: string }): Badge | null {
  if (f.species) return badgeFor(f.species);
  return badgeFromWords(f.notes);
}
