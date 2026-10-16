// The mushrooms he marks with a picture (Stefan 16/10/2026; three more the same day: Horn of Plenty, Hedgehog, Winter
// Chanterelle — "these are the ones I primarily look for"): "a crown for the Penny Bun Bolete, a red cap with
// white dots for the Fly Agaric, a thin silver tree for the Birch Bolete" — picked above the description when he saves
// a location, and drawn as the location's pin on every map, so a look at the map says what grows where.
//
// A picture IS the species: picking one names the location as that species (the same `species` field its own page
// sets), so the map's species choice, the word search and the location's title all follow it. A location named any of
// these three on its page gets the picture too.

export type BadgeKey = 'penny-bun' | 'bay-bolete' | 'fly-agaric' | 'birch-bolete' | 'horn-of-plenty' | 'hedgehog' | 'winter-chanterelle';
export type Badge = { key: BadgeKey; name: string; species: string; alsoSpecies?: string[]; svg: string };

// Drawn on a 32 × 32 square, in their own colours (they are pictures, not line icons). Plain constants: never built
// from anything he typed, so they are safe to put into the page as they are.
const PENNY_BUN = `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<path d="M9.5 6.5 11.5 10.5 16 5.5 20.5 10.5 22.5 6.5 22.5 12.5H9.5Z" fill="#f2b705" stroke="#a67c00" stroke-width="1" stroke-linejoin="round"/>
<circle cx="9.5" cy="6.3" r="1.3" fill="#f2b705" stroke="#a67c00" stroke-width=".8"/><circle cx="16" cy="5.2" r="1.3" fill="#f2b705" stroke="#a67c00" stroke-width=".8"/><circle cx="22.5" cy="6.3" r="1.3" fill="#f2b705" stroke="#a67c00" stroke-width=".8"/>
<path d="M4 21.5C4 15.5 9.5 12.5 16 12.5S28 15.5 28 21.5Z" fill="#8a5a2b" stroke="#5c3a17" stroke-width="1"/>
<path d="M12 21.5H20L21 28.5Q16 30 11 28.5Z" fill="#efe3c8" stroke="#a89670" stroke-width="1" stroke-linejoin="round"/>
</svg>`;

// Bay Bolete (Stefan 16/10/2026: "similar to the Porcini except very orange and without the crown"): the same bolete
// shape as the Penny Bun, larger without the crown, a bright orange-brown cap over a pale yellow stem.
const BAY_BOLETE = `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<path d="M2.5 18.5C2.5 10.5 8.5 5.5 16 5.5S29.5 10.5 29.5 18.5Z" fill="#e8730c" stroke="#9a4a05" stroke-width="1"/>
<path d="M7 11.5Q10.5 7.8 16 7.6" stroke="#f6a54b" stroke-width="1.6" fill="none" stroke-linecap="round"/>
<path d="M3.2 18.5H28.8L28 19.9H4Z" fill="#f2d24a" stroke="#b08a10" stroke-width=".7" stroke-linejoin="round"/>
<path d="M12 19.9H20L21 28.5Q16 30 11 28.5Z" fill="#f1dfa8" stroke="#a8915a" stroke-width="1" stroke-linejoin="round"/>
<path d="M13.6 22.5Q14 25.5 13.4 28M17.6 22Q18 25 17.8 28.4" stroke="#c9b27a" stroke-width=".7" fill="none" stroke-linecap="round"/>
</svg>`;

const FLY_AGARIC = `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<path d="M13 18.5H19L20 28.5Q16 30 12 28.5Z" fill="#fbfbf7" stroke="#b8b8b0" stroke-width="1" stroke-linejoin="round"/>
<path d="M12.2 21.5H19.8" stroke="#b8b8b0" stroke-width="1.4" stroke-linecap="round"/>
<path d="M3 18.5C3 10.5 9 5 16 5S29 10.5 29 18.5Z" fill="#d7261e" stroke="#8f140f" stroke-width="1"/>
<circle cx="10" cy="13" r="1.7" fill="#fff"/><circle cx="16" cy="9" r="1.8" fill="#fff"/><circle cx="21.5" cy="12" r="1.6" fill="#fff"/>
<circle cx="14.5" cy="15" r="1.4" fill="#fff"/><circle cx="24.5" cy="16" r="1.2" fill="#fff"/><circle cx="7" cy="16.5" r="1.1" fill="#fff"/><circle cx="19" cy="16" r="1.1" fill="#fff"/>
</svg>`;

// A silver birch: the white trunk with its black marks standing in front of a light, rounded yellow-green crown,
// a few leaves already turning gold.
const BIRCH_BOLETE = `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<g fill="#a9c63c"><circle cx="10.5" cy="11" r="4.6"/><circle cx="21.5" cy="11" r="4.6"/><circle cx="16" cy="7.2" r="5.2"/><circle cx="12.5" cy="16" r="4"/><circle cx="19.8" cy="16" r="4"/><circle cx="16" cy="13" r="5"/></g>
<g fill="#c9dc5a"><circle cx="13.4" cy="6" r="2.2"/><circle cx="9" cy="9.6" r="1.9"/><circle cx="19.6" cy="8.6" r="1.8"/><circle cx="22.6" cy="13.6" r="1.6"/><circle cx="11" cy="14.8" r="1.5"/></g>
<g fill="#e2b83a"><circle cx="21.2" cy="5.6" r="1.2"/><circle cx="7" cy="13.4" r="1.1"/><circle cx="23.8" cy="17.4" r="1.1"/><circle cx="14.2" cy="18.6" r=".9"/></g>
<path d="M16 13.5 11.6 9.6M16.4 11.2 20.6 8.4M16.1 16.6 20 14.4" stroke="#f4f3ef" stroke-width="1" stroke-linecap="round"/>
<path d="M14.4 31 15.3 7.5Q16.1 6.6 16.9 7.5L17.8 31Z" fill="#fdfdfb" stroke="#5f5a54" stroke-width=".9" stroke-linejoin="round"/>
<g stroke="#1f1d1b" stroke-width="1.3" stroke-linecap="round"><path d="M15.5 11H16.4M16 14.4H17.2M15.2 17.8H16.6M16.4 21.2H17.6M14.9 24.6H16.8M16.5 27.4H17.7"/></g>
<path d="M14.6 28.6 17.6 28.2 17.8 31H14.4Z" fill="#3b3733"/>
</svg>`;

// Horn of Plenty / Black Trumpet: a dark, hollow trumpet with a ragged, rolled-out rim.
const HORN_OF_PLENTY = `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<path d="M14.2 30.2Q16 31 17.8 30.2L18.4 22.5Q23.5 15 27.5 8.5Q24.5 6.4 22.5 8.2Q20.5 5.8 18 7.4Q16 5.2 14 7.2Q11.5 5.6 9.5 8Q7.2 6.6 4.5 8.5Q8.5 15 13.6 22.5Z" fill="#2c2724" stroke="#120f0d" stroke-width="1" stroke-linejoin="round"/>
<ellipse cx="16" cy="9.3" rx="9.6" ry="2.6" fill="#0f0c0b"/>
<path d="M11 13.5Q13 19 15 25M20.8 13.8Q19.2 19 17.3 25" stroke="#5e5650" stroke-width=".8" fill="none" stroke-linecap="round"/>
</svg>`;

// Hedgehog mushrooms, shown as the animal (Stefan 16/10/2026: "look like a hedgehog - not a mushroom"): a brown
// hedgehog walking right, its spines fanned over its back, a pale pointed face and a black nose.
const HEDGEHOG = `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<path d="M6.0 18.0L1.9 18.4L5.9 19.5ZM6.5 16.3L3.4 16.2L6.1 17.8ZM7.3 14.8L3.4 13.6L6.6 16.1ZM8.4 13.5L5.5 12.1L7.4 14.6ZM9.7 12.4L6.6 9.7L8.5 13.3ZM11.2 11.6L9.1 9.2L9.9 12.2ZM12.9 11.1L11.0 7.4L11.4 11.5ZM14.6 10.9L13.6 7.9L13.1 11.0ZM16.3 11.1L16.0 7.0L14.8 10.9ZM17.9 11.6L18.2 8.5L16.5 11.1ZM19.4 12.5L20.8 8.6L18.1 11.7ZM20.7 13.6L22.2 10.8L19.6 12.6ZM21.8 14.9L24.6 11.9L20.9 13.7ZM22.6 16.5L25.0 14.5L21.9 15.1ZM23.0 18.2L26.7 16.5L22.6 16.7Z" fill="#4e3a2a" stroke="#2e2117" stroke-width=".5" stroke-linejoin="round"/>
<path d="M4.5 22.5Q4 12.2 14.5 11Q22 10.6 24.5 17.5L29 21.3Q29.6 22.4 28.4 22.8L24 23.6Q22 25 18 25H7.2Q4.6 25 4.5 22.5Z" fill="#7a5a3c" stroke="#3a2a1c" stroke-width="1" stroke-linejoin="round"/>
<path d="M7 18Q9.5 13.5 14 13.2M10 21Q12 16.5 16.5 16M15.5 22.5Q17 19 20.5 18.6" stroke="#5a412b" stroke-width="1" fill="none" stroke-linecap="round"/>
<path d="M21 17.6Q24 16.8 25.4 18.6L29 21.3Q29.6 22.4 28.4 22.8L24 23.6Q21.5 23.4 21 21Z" fill="#e3c7a1" stroke="#3a2a1c" stroke-width=".8" stroke-linejoin="round"/>
<circle cx="28.9" cy="22" r="1.1" fill="#1b1410"/>
<circle cx="24.3" cy="19.6" r=".9" fill="#1b1410"/><circle cx="24.6" cy="19.3" r=".3" fill="#fff"/>
<path d="M21.6 16.9Q22.4 15.6 23.4 16.6" fill="#e3c7a1" stroke="#3a2a1c" stroke-width=".7"/>
<path d="M9 25V27M13 25V27M17.5 25V27M21 24.6V26.6" stroke="#3a2a1c" stroke-width="1.4" stroke-linecap="round"/>
</svg>`;

// Winter Chanterelle, drawn yellow as he asked: a funnel cap with a wavy rim, the ridges running down onto a yellow stem.
const WINTER_CHANTERELLE = `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<path d="M14.3 30.2Q16 31 17.7 30.2L17.6 19.6H14.4Z" fill="#f2c230" stroke="#b5880f" stroke-width="1" stroke-linejoin="round"/>
<path d="M14.4 20.5Q8.5 15.5 4 9.8Q6.6 8.2 8.6 9.6Q10.4 7.4 12.8 8.8Q14.6 6.8 16.6 8.4Q18.8 6.8 20.6 8.8Q23 7.4 24.6 9.6Q26.6 8.4 28.2 10Q23.4 15.6 17.6 20.5Z" fill="#f5c63a" stroke="#b5880f" stroke-width="1" stroke-linejoin="round"/>
<path d="M6 10.8Q15 13.6 26.4 11" stroke="#b5880f" stroke-width=".8" fill="none"/>
<path d="M10 12.6 14.8 19.6M13.4 13.2 15.6 19.4M16.4 13.3 16.3 19.4M19.4 13 17 19.5M22.6 12.3 17.4 19.6" stroke="#d59d17" stroke-width=".8" fill="none" stroke-linecap="round"/>
<path d="M7.6 9.9Q10.5 9 12.5 10" stroke="#fde59a" stroke-width="1.1" fill="none" stroke-linecap="round"/>
</svg>`;

export const BADGES: readonly Badge[] = [
  { key: 'penny-bun', name: 'Penny Bun', species: 'Boletus edulis', svg: PENNY_BUN },
  { key: 'bay-bolete', name: 'Bay Bolete', species: 'Imleria badia', svg: BAY_BOLETE },
  { key: 'fly-agaric', name: 'Fly Agaric', species: 'Amanita muscaria', svg: FLY_AGARIC },
  { key: 'birch-bolete', name: 'Birch Bolete', species: 'Leccinum scabrum', svg: BIRCH_BOLETE },
  { key: 'horn-of-plenty', name: 'Horn of Plenty', species: 'Craterellus cornucopioides', svg: HORN_OF_PLENTY },
  // Both hedgehogs in the guide share the picture; picking it names the Wood Hedgehog.
  { key: 'hedgehog', name: 'Hedgehog', species: 'Hydnum repandum', alsoSpecies: ['Hydnum rufescens'], svg: HEDGEHOG },
  // The guide calls it Trumpet Chanterelle (Craterellus tubaeformis); he calls it the Winter Chanterelle.
  { key: 'winter-chanterelle', name: 'Winter Chanterelle', species: 'Craterellus tubaeformis', svg: WINTER_CHANTERELLE },
];

/** The picture for a location's species, or null when it is none of the three (or not named yet). */
export function badgeFor(species: string | null | undefined): Badge | null {
  if (!species) return null;
  return BADGES.find((b) => b.species === species || b.alsoSpecies?.includes(species)) ?? null;
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
  'bay-bolete': [['bay', 'bolete'], ['imleria', 'badia'], ['boletus', 'badius'], ['xerocomus', 'badius']],
  'fly-agaric': [['fly', 'agaric'], ['amanita', 'muscaria']],
  'birch-bolete': [['birch', 'bolete'], ['leccinum', 'scabrum']],
  'horn-of-plenty': [['horn', 'of', 'plenty'], ['black', 'trumpet'], ['craterellus', 'cornucopioides']],
  'hedgehog': [['hedgehog'], ['hydnum']],
  // Not "yellowleg": the Yellowleg Bonnet is another mushroom altogether.
  'winter-chanterelle': [['winter', 'chanterelle'], ['trumpet', 'chanterelle'], ['yellowfoot'], ['craterellus', 'tubaeformis']],
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
/** Every picture a description names, in the order of the pictures (Stefan 16/10/2026: "a penny bun was found and a
 * bay bolete … two little icons"). */
export function badgesFromWords(text: string): Badge[] {
  const ws = bareWords(text);
  // The names go through the same plural rule as his words ("boletus" -> "boletu"), so Latin names match too.
  return BADGES.filter((b) => NAMES_IN_WORDS[b.key].some((n) => hasName(ws, bareWords(n.join(' ')))));
}
/** The picture a description names — null when it names none, or more than one. */
export function badgeFromWords(text: string): Badge | null {
  const named = badgesFromWords(text);
  return named.length === 1 ? named[0] : null;
}
/** A saved location's pictures: the species it is named as first, then every other one its description names (two
 * mushrooms found together = two pictures). Named as a species that has no picture = none (what he identified it as
 * wins over what he first wrote). */
export function badgesOfFind(f: { species: string | null; notes: string }): Badge[] {
  const named = f.species ? badgeFor(f.species) : null;
  if (f.species && !named) return [];
  const words = badgesFromWords(f.notes).filter((b) => b.key !== named?.key);
  return named ? [named, ...words] : words;
}
