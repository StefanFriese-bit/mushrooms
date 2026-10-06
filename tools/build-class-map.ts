import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createInatClient } from './lib/inat.ts';
import { makeGroupFilter, resolveGroups, type GroupsConfig } from './lib/groups.ts';
import { parseCsv } from './lib/csv.ts';
import { df20Classes, matchClasses, type Df20Row } from './lib/df20-classes.ts';

// The model's species list (DF20, 1,604 classes), matched to our 300 (older names included), with whether each class
// is a UK species and its UK records by month. Every lookup is cached under cache/df20/, saved as it goes.
const ROOT = new URL('../', import.meta.url);
const CACHE = new URL('cache/df20/', ROOT);
const ZIP_URL = 'http://ptak.felk.cvut.cz/plants/DanishFungiDataset/DF20-metadata.zip';
const CSV = 'DF20-train_metadata_PROD-2.csv';
const at = (rel: string) => fileURLToPath(new URL(rel, CACHE));

/** A JSON object on disk that grows as lookups are made, saved every 20 additions and at the end. */
function store<T>(file: string) {
  const data: Record<string, T> = existsSync(at(file)) ? JSON.parse(readFileSync(at(file), 'utf8')) : {};
  let unsaved = 0;
  const save = () => { writeFileSync(at(file), JSON.stringify(data)); unsaved = 0; };
  return {
    has: (k: string) => k in data,
    get: (k: string) => data[k],
    set: (k: string, v: T) => { data[k] = v; if (++unsaved >= 20) save(); },
    save,
  };
}

type Ours = { name: string; inatId: number; dangerLevel: 'deadly' | 'poisonous' | null };

async function main() {
  mkdirSync(CACHE, { recursive: true });
  if (!existsSync(at(CSV))) {
    if (!existsSync(at('DF20-metadata.zip'))) {
      const res = await fetch(ZIP_URL);
      if (!res.ok) throw new Error(`DF20 metadata: HTTP ${res.status}`);
      writeFileSync(at('DF20-metadata.zip'), Buffer.from(await res.arrayBuffer()));
    }
    execFileSync('unzip', ['-o', '-q', at('DF20-metadata.zip'), '-d', at('.')]);
  }
  const classes = df20Classes(parseCsv(readFileSync(at(CSV), 'utf8')) as unknown as Df20Row[]);
  console.log(`DF20: ${classes.length} classes, ${classes.reduce((n, c) => n + c.photos, 0)} training photos`);
  // The model's output number i is class i: the list must run 0, 1, 2 … with no gap, or every name is wrong.
  if (classes.some((c, i) => c.id !== i)) throw new Error('DF20 class numbers are not 0 … n-1: the names would not line up with the model');

  const inat = createInatClient();
  const ours = (JSON.parse(readFileSync(new URL('content/species-list.json', ROOT), 'utf8')) as { species: Ours[] }).species;
  const older = store<string[]>('older-names.json');
  for (const s of ours) if (!older.has(s.name)) older.set(s.name, await inat.olderNames(s.inatId));
  older.save();
  const matched = matchClasses(classes, ours.map((s) => ({ name: s.name, olderNames: older.get(s.name) })));
  const ourByName = new Map(ours.map((s) => [s.name, s]));

  const uk = store<{ id: number; records: number }>('uk-species.json');
  if (!uk.has('__complete__')) {
    const groupsCfg = JSON.parse(readFileSync(new URL('tools/config/groups.json', ROOT), 'utf8')) as GroupsConfig;
    const groups = await resolveGroups(groupsCfg, inat.resolveTaxon);
    const isLargerFungus = makeGroupFilter(groups);
    for (const g of groups.include) {
      for (const { count, taxon } of await inat.speciesCounts(groupsCfg.placeId, g.id)) {
        if (isLargerFungus(taxon)) uk.set(taxon.name, { id: taxon.id, records: count });
      }
    }
    uk.set('__complete__', { id: 0, records: 0 });
    uk.save();
  }

  // A class that is not ours and whose own name is not a current UK name: what is it called now?
  const lookup = store<string | null>('taxa-lookup.json');
  const taxonIdOf = new Map<number, number>();
  for (const c of classes) {
    const our = matched.get(c.id);
    if (our) { taxonIdOf.set(c.id, ourByName.get(our)!.inatId); continue; }
    if (uk.has(c.name)) { taxonIdOf.set(c.id, uk.get(c.name).id); continue; }
    if (!lookup.has(c.name)) {
      const body = await inat.getJson(`/taxa?${new URLSearchParams({ q: c.name, rank: 'species', per_page: '10' })}`);
      const hit = (body.results ?? []).find((r: { name: string; matched_term?: string; is_active?: boolean }) =>
        r.is_active !== false && (r.name === c.name || r.matched_term?.toLowerCase() === c.name.toLowerCase()));
      lookup.set(c.name, hit?.name ?? null);
    }
    const now = lookup.get(c.name);
    if (now && uk.has(now)) taxonIdOf.set(c.id, uk.get(now).id);
  }
  lookup.save();

  const months = store<number[]>('months.json');
  for (const id of new Set(taxonIdOf.values())) {
    if (months.has(String(id))) continue;
    const q = new URLSearchParams({ taxon_id: String(id), place_id: '6857', quality_grade: 'research', interval: 'month_of_year', date_field: 'observed' });
    const body = await inat.getJson(`/observations/histogram?${q}`);
    const byMonth = body.results?.month_of_year ?? {};
    months.set(String(id), Array.from({ length: 12 }, (_, i) => Number(byMonth[String(i + 1)] ?? 0)));
  }
  months.save();

  const out = classes.map((c) => {
    const our = matched.get(c.id) ?? null;
    const taxon = taxonIdOf.get(c.id);
    return {
      id: c.id,
      name: c.name,
      ours: our,
      danger: our ? ourByName.get(our)!.dangerLevel ?? null : null,
      uk: taxon !== undefined,
      months: taxon !== undefined ? months.get(String(taxon)) : Array(12).fill(0),
    };
  });
  const dst = new URL('content/model/df20-classes.json', ROOT);
  mkdirSync(new URL('./', dst), { recursive: true });
  writeFileSync(dst, JSON.stringify({
    source: 'BVRA Danish Fungi 2020 (DF20) models, 1,604 classes; names from DF20-metadata.zip (CC BY-NC 4.0, non-commercial)',
    built: new Date().toISOString().slice(0, 10),
    classes: out,
  }) + '\n');

  const known = new Set(out.filter((c) => c.ours).map((c) => c.ours));
  const byOlder = ours.filter((s) => known.has(s.name) && !classes.some((c) => c.name === s.name)).length;
  console.log(`UK classes: ${out.filter((c) => c.uk).length} of ${out.length}`);
  console.log(`ours known: ${known.size} of ${ours.length} (${known.size - byOlder} by name, ${byOlder} by an older or filed-under name)`);
  const unknownDanger = ours.filter((s) => s.dangerLevel && !known.has(s.name));
  console.log(`dangerous species the model does not know: ${unknownDanger.map((s) => `${s.name} [${s.dangerLevel}]`).join(', ') || 'none'}`);
}

await main();
