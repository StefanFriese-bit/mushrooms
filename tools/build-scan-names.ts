import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { genusOf, type ClassInfo } from '../src/scan/rules.ts';

// English names for every UK species the scan model knows (not only the guide's 300), and for its genera — the group
// headline, "most likely one of the brittlegills (Russula)" → content/model/df20-names.json.
// A species: the British Mycological Society's recommended English name (cache/bms-english-names-2005.txt, "List of
// Recommended English Names for Fungi in the UK"), else iNaturalist's English name (fetched once into
// cache/df20/inat-english.json), else none — the screen then shows the scientific name.
// A genus: the plural of the last word that ends at least 3 of its species' names and 75 in 100 of them
// ("Brittlegill" for Russula, "Webcap" for Cortinarius); none when no word does (Amanita: Deathcap, Panthercap, Grisette …).
const ROOT = new URL('../', import.meta.url);
const read = <T>(rel: string): T => JSON.parse(readFileSync(new URL(rel, ROOT), 'utf8')) as T;
const classes = read<{ classes: ClassInfo[] }>('content/model/df20-classes.json').classes.filter((c) => c.uk);

// The BMS list as text: one "Scientific name English Name" per line; page breaks leave a form feed and a page number.
const bmsLines = readFileSync(new URL('cache/bms-english-names-2005.txt', ROOT), 'utf8').split('\n').map((l) => l.trim());
const clean = (s: string) => s.replace(/\f\d*/g, '').replace(/\s+/g, ' ').trim();
function bms(names: string[]): string | null {
  for (const n of names) {
    const line = bmsLines.find((l) => l.startsWith(`${n} `) && !l.startsWith(`${n} var.`) && !l.startsWith(`${n} f.`));
    const rest = line ? clean(line.slice(n.length + 1)) : '';
    if (/^[A-Z]/.test(rest)) return rest;
  }
  return null;
}

type Inat = Record<string, { id: number; common: string | null; inat: string | null }>;
const INAT = 'cache/df20/inat-english.json';
async function inatNames(): Promise<Inat> {
  if (existsSync(new URL(INAT, ROOT))) return read<Inat>(INAT);
  const uk = read<Record<string, { id: number }>>('cache/df20/uk-species.json');
  const look = read<Record<string, string>>('cache/df20/taxa-lookup.json');
  const want = classes.flatMap((c) => { const n = uk[c.name] ? c.name : look[c.name]; return n && uk[n] ? [[c.name, uk[n].id] as const] : []; });
  const out: Inat = {};
  for (let i = 0; i < want.length; i += 30) {
    const batch = want.slice(i, i + 30);
    const url = `https://api.inaturalist.org/v1/taxa/${batch.map((b) => b[1]).join(',')}?locale=en&preferred_place_id=6857&per_page=30`;
    let json: { results: Array<{ id: number; name: string; preferred_common_name?: string }> } | null = null;
    for (let a = 1; a <= 4 && !json; a++) {
      try { const r = await fetch(url, { signal: AbortSignal.timeout(30000) }); if (r.ok) json = await r.json(); } catch { /* ask again */ }
      if (!json) await new Promise((r) => setTimeout(r, 2000 * a));
    }
    if (!json) throw new Error(`iNaturalist did not answer: ${url}`);
    const byId = new Map(json.results.map((t) => [t.id, t]));
    for (const [name, id] of batch) out[name] = { id, common: byId.get(id)?.preferred_common_name ?? null, inat: byId.get(id)?.name ?? null };
    await new Promise((r) => setTimeout(r, 1100)); // iNaturalist asks for at most 60 requests a minute
  }
  writeFileSync(new URL(INAT, ROOT), JSON.stringify(out, null, 1));
  return out;
}
const titleCase = (s: string) => s.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

export function plural(word: string): string | null {
  if (word === 'Fungus' || word === 'Tooth') return null; // "fungi", "teeth" say nothing as a group name
  if (/(s|x|sh|ch)$/.test(word)) return `${word}es`;
  return `${word}s`;
}

const inat = await inatNames();
const english: Record<string, string> = {};
for (const c of classes) {
  const i = inat[c.name];
  const name = bms([c.name, ...(i?.inat && i.inat !== c.name ? [i.inat] : [])]) ?? (i?.common ? titleCase(i.common) : null);
  if (name) english[c.name] = name;
}
const groups: Record<string, string> = {};
const byGenus = new Map<string, string[]>();
for (const c of classes) if (english[c.name]) byGenus.set(genusOf(c.name), [...(byGenus.get(genusOf(c.name)) ?? []), english[c.name]]);
for (const [genus, names] of byGenus) {
  const counts = new Map<string, number>();
  for (const n of names) { const w = titleCase(n.split(' ').at(-1) as string); counts.set(w, (counts.get(w) ?? 0) + 1); }
  const [word, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  const label = plural(word);
  if (n >= 3 && n / names.length >= 0.75 && label && word.toLowerCase() !== genus.toLowerCase()) groups[genus] = label;
}
writeFileSync(new URL('content/model/df20-names.json', ROOT), JSON.stringify({
  about: 'English names for the UK species the scan model knows, and for its genera (tools/build-scan-names.ts): the British ' +
    "Mycological Society's recommended English names first, iNaturalist's second.",
  classes: english, groups,
}, null, 1) + '\n');
console.log(`${Object.keys(english).length} of ${classes.length} UK species named; ${Object.keys(groups).length} groups named`);
