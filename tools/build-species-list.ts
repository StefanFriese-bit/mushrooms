import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createInatClient, type InatTaxon } from './lib/inat.ts';
import { makeGroupFilter, resolveGroups, type GroupsConfig } from './lib/groups.ts';
import { validateCoreLists, type CoreLists } from './lib/core-lists.ts';
import { selectSpecies, type Candidate } from './lib/select.ts';
import { englishName, nameClashes, parseBmsLatinToEnglish } from './lib/bms-names.ts';
import { renderReviewPage, sectionOf, type ReviewRow } from './lib/review-page.ts';

const ROOT = new URL('../', import.meta.url);
const TARGET = 300;
const BMS_URL = 'https://www.davidmoore.org.uk/assets/fungi4schools/Reprints/ENGLISH_NAMES.pdf';

const readJson = <T>(rel: string): T => JSON.parse(readFileSync(new URL(rel, ROOT), 'utf8')) as T;
const writeText = (rel: string, text: string) => {
  const url = new URL(rel, ROOT);
  mkdirSync(new URL('./', url), { recursive: true });
  writeFileSync(url, text);
};

function toCandidate(t: InatTaxon, ukRecords: number): Candidate {
  const photo = t.default_photo?.square_url
    ? { url: t.default_photo.square_url, attribution: t.default_photo.attribution ?? '' }
    : null;
  return { inatId: t.id, name: t.name, ukRecords, inatEnglish: t.preferred_common_name ?? null, photo };
}

async function loadBmsNames(): Promise<{ names: Map<string, string>; unparsed: number }> {
  const pdf = new URL('cache/bms-english-names-2005.pdf', ROOT);
  const txt = new URL('cache/bms-english-names-2005.txt', ROOT);
  if (!existsSync(pdf)) {
    const res = await fetch(BMS_URL);
    if (!res.ok) throw new Error(`Could not download the BMS names list: HTTP ${res.status}`);
    mkdirSync(new URL('cache/', ROOT), { recursive: true });
    writeFileSync(pdf, Buffer.from(await res.arrayBuffer()));
  }
  execFileSync('pdftotext', ['-raw', fileURLToPath(pdf), fileURLToPath(txt)]);
  const parsed = parseBmsLatinToEnglish(readFileSync(txt, 'utf8'));
  return { names: parsed.names, unparsed: parsed.unparsed.length };
}

async function main() {
  const groupsCfg = readJson<GroupsConfig>('tools/config/groups.json');
  const core = readJson<CoreLists>('tools/config/core-lists.json');
  const overrides = readJson<{ add: string[]; remove: string[] }>('tools/config/list-overrides.json');

  const problems = validateCoreLists(core);
  if (problems.length > 0) {
    console.error(`The core lists have ${problems.length} problem(s). Run "npm run check-core-lists".`);
    process.exit(1);
  }

  const inat = createInatClient();
  const groups = await resolveGroups(groupsCfg, inat.resolveTaxon);
  const isLargerFungus = makeGroupFilter(groups);

  const byName = new Map<string, Candidate>();
  const groupLines: string[] = [];
  for (const g of groups.include) {
    const counts = await inat.speciesCounts(groupsCfg.placeId, g.id);
    let kept = 0;
    for (const { count, taxon } of counts) {
      if (!isLargerFungus(taxon)) continue;
      kept++;
      const prev = byName.get(taxon.name);
      if (!prev || prev.ukRecords < count) byName.set(taxon.name, toCandidate(taxon, count));
    }
    groupLines.push(`- ${g.name} (${g.rank}, iNaturalist ${g.id}): ${counts.length} UK species, ${kept} kept`);
    console.log(groupLines.at(-1));
  }
  for (const g of groups.exclude) groupLines.push(`- Left out: ${g.name} (${g.rank}, iNaturalist ${g.id}) — ${g.why}`);

  const resolve = async (name: string): Promise<Candidate> => {
    const known = byName.get(name);
    if (known) return known;
    const taxon = await inat.resolveTaxon(name, 'species');
    const own = await inat.speciesCounts(groupsCfg.placeId, taxon.id);
    const count = own.find((c) => c.taxon.id === taxon.id)?.count ?? 0;
    return toCandidate(taxon, count);
  };

  const coreMap = new Map<string, Candidate>();
  for (const name of [...core.edibles.map((e) => e.name), ...core.dangerous.map((d) => d.name)]) {
    coreMap.set(name, await resolve(name));
  }
  const addMap = new Map<string, Candidate>();
  for (const name of overrides.add) addMap.set(name, await resolve(name));

  const { picked, notes } = selectSpecies({
    ranked: [...byName.values()],
    core: coreMap,
    edibles: core.edibles.map((e) => e.name),
    dangerous: core.dangerous.map((d) => ({ name: d.name, level: d.level })),
    lookalikeNames: new Set(core.pairs.map((p) => p.dangerous)),
    add: addMap,
    remove: overrides.remove,
    target: TARGET,
  });

  const bms = await loadBmsNames();
  const handNamed = readJson<Record<string, { english: string; source: string; why: string }>>('tools/config/english-names.json');
  type BuiltRow = ReviewRow & { englishVia: string | null };
  const rows: BuiltRow[] = [];
  for (const p of picked) {
    const hand = handNamed[p.name];
    if (hand) {
      rows.push({ ...p, english: hand.english, englishSource: 'hand-set', englishVia: null });
      continue;
    }
    const older = bms.names.has(p.name) ? [] : await inat.olderNames(p.inatId);
    const n = englishName(p.name, bms.names, p.inatEnglish, older);
    rows.push({ ...p, english: n.english, englishSource: n.source, englishVia: n.via });
  }
  const clashes = nameClashes(rows.map((r) => ({ name: r.name, english: r.english, via: r.englishVia })), bms.names);

  const generated = new Date().toISOString();
  writeText(
    'content/species-list.json',
    JSON.stringify(
      {
        generated,
        placeId: groupsCfg.placeId,
        target: TARGET,
        species: rows.map((r) => ({
          inatId: r.inatId,
          name: r.name,
          english: r.english,
          englishSource: r.englishSource,
          englishVia: r.englishVia,
          ukRecords: r.ukRecords,
          reasons: r.reasons,
          dangerLevel: r.dangerLevel,
        })),
      },
      null,
      2,
    ) + '\n',
  );

  const count = (title: string) => rows.filter((r) => sectionOf(r) === title).length;
  const fromBms = rows.filter((r) => r.englishSource === 'bms-2005').length;
  const viaOlder = rows.filter((r) => r.englishSource === 'bms-2005' && r.englishVia).length;
  const fromInat = rows.filter((r) => r.englishSource === 'inaturalist').length;
  const byHand = rows.filter((r) => r.englishSource === 'hand-set').length;
  writeText(
    'reports/species-list-report.md',
    [
      '# Species list: build report',
      '',
      `Generated: ${generated} · Target: ${TARGET} · Picked: ${rows.length}`,
      '',
      '## Where they come from',
      `- Deadly: ${count('Deadly species')}`,
      `- Dangerous lookalikes: ${count('Dangerous lookalikes of edible species')}`,
      `- Edible: ${count('Edible species')}`,
      `- Added by Stefan: ${count('Added by you')}`,
      `- Most recorded in the UK: ${count('Most recorded in the UK')}`,
      '',
      '## Groups',
      ...groupLines,
      '',
      '## English names',
      `- From the BMS list (2005): ${fromBms} of ${rows.length} (${viaOlder} of them found under an older scientific name)`,
      `- Set by hand, with a source (tools/config/english-names.json): ${byHand}`,
      `- From iNaturalist: ${fromInat}`,
      `- None: ${rows.length - fromBms - fromInat - byHand}`,
      `- BMS list lines not understood: ${bms.unparsed}`,
      '',
      '## English names that clash',
      ...(clashes.length ? clashes.map((c) => `- ${c}`) : ['- none']),
      '',
      '## Notes',
      ...(notes.length ? notes.map((n) => `- ${n}`) : ['- none']),
      '',
    ].join('\n'),
  );

  writeText('review/species-list.html', renderReviewPage(rows, { generated: generated.slice(0, 10), target: TARGET, notes }));
  console.log(`Picked ${rows.length} species; English names from BMS ${fromBms} (${viaOlder} via older names), by hand ${byHand}, iNaturalist ${fromInat}; clashes ${clashes.length}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
