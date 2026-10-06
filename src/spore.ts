// Spore print colour, read from the guide's own words into the four groups Identify asks about. A colour named in
// a range ("white to cream", "rusty brown") adds its group; plain "brown" adds both brown groups, so a vague text
// never removes a species. The content check refuses a text that names no group.
export type SporeGroup = 'white' | 'pink' | 'brown' | 'dark';
export const SPORE_GROUPS: SporeGroup[] = ['white', 'pink', 'brown', 'dark'];

const WORDS: Array<[RegExp, SporeGroup[]]> = [
  [/\b(white|whitish|cream|creamy|pale yellow)\b/, ['white']],
  [/\b(pink|pinkish|salmon)\b/, ['pink']],
  [/\b(rust|rusty|ochre|cinnamon|clay|tobacco|snuff|orange-brown|yellow-brown|yellowish-brown)\b/, ['brown']],
  [/\b(chocolate|purple|purplish|black|blackish|sepia|dark brown|purple-brown)\b/, ['dark']],
];
/** "brown" with a word in front that already says which brown ("dark brown", "rusty brown", "purple-brown"). */
const QUALIFIED_BROWN = /\b(dark|chocolate|purple|purplish|rusty|rust|orange|yellow|yellowish|cinnamon|tobacco|snuff|clay)[- ]brown\b/g;

export function sporeGroups(text: string): SporeGroup[] {
  const t = text.toLowerCase();
  const found = new Set<SporeGroup>();
  for (const [re, groups] of WORDS) if (re.test(t)) groups.forEach((g) => found.add(g));
  // A plain "brown" left once the qualified ones are taken out counts as both browns. (No look-behind in the pattern:
  // Safari before iOS 16.4 cannot read one, and the whole app would fail to start.)
  if (/\bbrown\b/.test(t.replace(QUALIFIED_BROWN, ' '))) { found.add('brown'); found.add('dark'); }
  return SPORE_GROUPS.filter((g) => found.has(g));
}
