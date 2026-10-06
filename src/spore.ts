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
  [/(?<!(dark|chocolate|purple|purplish|rusty|rust|orange|yellow|yellowish|cinnamon|tobacco|snuff|clay)[- ])\bbrown\b/, ['brown', 'dark']],
];

export function sporeGroups(text: string): SporeGroup[] {
  const t = text.toLowerCase();
  const found = new Set<SporeGroup>();
  for (const [re, groups] of WORDS) if (re.test(t)) groups.forEach((g) => found.add(g));
  return SPORE_GROUPS.filter((g) => found.has(g));
}
