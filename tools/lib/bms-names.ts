// The British Mycological Society's "List of Recommended English Names for Fungi in the UK" (2005), as text from
// `pdftotext -raw`. The Latin-to-English section has one "Genus species English Name" per line; a few names are
// split over two lines (Latin first).
const LATIN_LINE = /^([A-Z][a-z]+ [a-z][a-z-]+(?: (?:var|f|subsp|ssp)\. [a-z][a-z-]+)?)(?: (.+))?$/;
// Ten names carry a footnote star ("has alternative English names"); the star is not part of the name.
const clean = (english: string) => english.replace(/\s*\*+$/, '').trim();

export function parseBmsLatinToEnglish(raw: string): { names: Map<string, string>; unparsed: string[] } {
  // A page break (form feed) ends a line too: the PDF puts each page's number right after its last name.
  const lines = raw.split(/[\r\n\f]+/).map((l) => l.trim());
  const start = lines.findIndex((l) => /^Current Scientific Latin name/i.test(l));
  const end = lines.findIndex((l) => /^English to Latin names/i.test(l));
  if (start < 0 || end <= start) throw new Error('Could not find the Latin-to-English section in the BMS list');

  const names = new Map<string, string>();
  const unparsed: string[] = [];
  let pendingLatin: string | null = null;
  for (const line of lines.slice(start + 1, end)) {
    if (!line) continue;
    const m = LATIN_LINE.exec(line);
    if (m && m[2]) {
      if (pendingLatin) unparsed.push(pendingLatin);
      names.set(m[1], clean(m[2]));
      pendingLatin = null;
    } else if (m) {
      if (pendingLatin) unparsed.push(pendingLatin);
      pendingLatin = m[1];
    } else if (pendingLatin && /^[A-Z'"]/.test(line)) {
      names.set(pendingLatin, clean(line));
      pendingLatin = null;
    } else {
      unparsed.push(line);
    }
  }
  if (pendingLatin) unparsed.push(pendingLatin);
  return { names, unparsed };
}

export function englishName(
  name: string,
  bms: Map<string, string>,
  inatEnglish: string | null,
): { english: string | null; source: 'bms-2005' | 'inaturalist' | null } {
  const fromBms = bms.get(name);
  if (fromBms) return { english: fromBms, source: 'bms-2005' };
  if (inatEnglish) return { english: inatEnglish, source: 'inaturalist' };
  return { english: null, source: null };
}
