// The British Mycological Society's "List of Recommended English Names for Fungi in the UK" (2005), as text from
// `pdftotext -raw`. The Latin-to-English section has one "Genus species English Name" per line; a few names are
// split over two lines (Latin first).
const LATIN_LINE = /^([A-Z][a-z]+ [a-z][a-z-]+(?: (?:var|f|subsp|ssp)\. [a-z][a-z-]+)?)(?: (.+))?$/;
// Ten names carry a footnote star ("has alternative English names"); the star is not part of the name.
const clean = (english: string) => english.replace(/\s*\*+$/, '').trim();
// A double name ("Shaggy Inkcap / Lawyer's") can wrap: its last word or two ("Wig") stand on the next line.
const CONTINUATION = /^[A-Z][A-Za-z'’-]*(?: [A-Z][A-Za-z'’-]*)?$/;

export function parseBmsLatinToEnglish(raw: string): { names: Map<string, string>; unparsed: string[] } {
  // A page break (form feed) ends a line too: the PDF puts each page's number right after its last name.
  const lines = raw.split(/[\r\n\f]+/).map((l) => l.trim());
  const start = lines.findIndex((l) => /^Current Scientific Latin name/i.test(l));
  const end = lines.findIndex((l) => /^English to Latin names/i.test(l));
  if (start < 0 || end <= start) throw new Error('Could not find the Latin-to-English section in the BMS list');

  const names = new Map<string, string>();
  const unparsed: string[] = [];
  let pendingLatin: string | null = null;
  let lastSet: string | null = null;
  for (const line of lines.slice(start + 1, end)) {
    if (!line) continue;
    const m = LATIN_LINE.exec(line);
    if (m && m[2]) {
      if (pendingLatin) unparsed.push(pendingLatin);
      names.set(m[1], clean(m[2]));
      pendingLatin = null;
      lastSet = m[1];
    } else if (m) {
      if (pendingLatin) unparsed.push(pendingLatin);
      pendingLatin = m[1];
      lastSet = null;
    } else if (pendingLatin && /^[A-Z'"]/.test(line)) {
      names.set(pendingLatin, clean(line));
      lastSet = pendingLatin;
      pendingLatin = null;
    } else if (lastSet && names.get(lastSet)!.includes(' / ') && CONTINUATION.test(line)) {
      names.set(lastSet, clean(`${names.get(lastSet)} ${line}`));
      lastSet = null;
    } else {
      unparsed.push(line);
      lastSet = null;
    }
  }
  if (pendingLatin) unparsed.push(pendingLatin);
  return { names, unparsed };
}

const SMALL_WORDS = new Set(['of', 'the', 'and', 'in', 'on', 'a', 'an', 'to', 'with', 'or']);

/** iNaturalist's names are often all lower case; give them the UK list's style ("Chicken of the Woods"). */
export function tidyEnglish(name: string): string {
  return name
    .split(' ')
    .map((w, i) => (i > 0 && SMALL_WORDS.has(w.toLowerCase()) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

export function englishName(
  name: string,
  bms: Map<string, string>,
  inatEnglish: string | null,
  olderNames: string[] = [],
): { english: string | null; source: 'bms-2005' | 'inaturalist' | null; via: string | null } {
  const direct = bms.get(name);
  if (direct) return { english: direct, source: 'bms-2005', via: null };
  for (const old of olderNames) {
    const hit = bms.get(old);
    if (hit) return { english: hit, source: 'bms-2005', via: old };
  }
  if (inatEnglish) return { english: tidyEnglish(inatEnglish), source: 'inaturalist', via: null };
  return { english: null, source: null, via: null };
}

/** An English name used for two species in the list, or one the BMS list gives to a different species. */
export function nameClashes(
  rows: Array<{ name: string; english: string | null; via?: string | null }>,
  bms: Map<string, string>,
): string[] {
  const out: string[] = [];
  const groups = new Map<string, { label: string; names: string[] }>();
  for (const r of rows) {
    if (!r.english) continue;
    const key = r.english.toLowerCase();
    const g = groups.get(key) ?? { label: r.english, names: [] };
    g.names.push(r.name);
    groups.set(key, g);
  }
  for (const g of groups.values()) if (g.names.length > 1) out.push(`"${g.label}" is used for ${g.names.join(' and ')}`);
  const bmsByEnglish = new Map<string, string[]>();
  for (const [latin, english] of bms) {
    const key = english.toLowerCase();
    bmsByEnglish.set(key, [...(bmsByEnglish.get(key) ?? []), latin]);
  }
  for (const r of rows) {
    if (!r.english) continue;
    for (const latin of bmsByEnglish.get(r.english.toLowerCase()) ?? []) {
      if (latin !== r.name && latin !== r.via) out.push(`"${r.english}" (${r.name}) is the BMS name of ${latin}`);
    }
  }
  return out;
}
