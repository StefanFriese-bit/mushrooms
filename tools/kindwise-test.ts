import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { ClassInfo, Thresholds } from '../src/scan/rules.ts';
import type { CoreLists } from './lib/core-lists.ts';
import { measure, type Case, type Measures } from './lib/scan-metrics.ts';
import { pageEdibility, readScoreCases, type TestEntry } from './lib/scan-scores.ts';
import { dangerousSpecies, withPageDanger } from '../src/scan/danger.ts';

// Our scanner against Kindwise's paid mushroom identifier (mushroom.kindwise.com), on the SAME observations of the scan
// test's checking half (odd observation numbers — photos neither side was tuned on) → reports/kindwise-test.md.
//
//   npx tsx tools/kindwise-test.ts            pick the sample, call Kindwise for the ones not yet asked, write the report
//   npx tsx tools/kindwise-test.ts --plan     pick the sample and print it; no call to Kindwise
//   npx tsx tools/kindwise-test.ts --report   write the report from the answers already saved; no call to Kindwise
//
// The key: ~/Downloads/kindwise-key.txt (Stefan's; never printed, never written anywhere, never committed). It is only
// ever sent to mushroom.kindwise.com, in the Api-Key header their documentation names.
// Credits: the free test allowance is 100. Every answer is saved under cache/kindwise/ (never asked twice); before the
// first call and every 20 calls the script reads the key's usage (usage_info — not an identification) and stops at once
// if one identification cost more than one credit, if the key cannot spend, or before the total would pass MAX_CALLS.
const ROOT = new URL('../', import.meta.url);
const read = <T>(rel: string): T => JSON.parse(readFileSync(new URL(rel, ROOT), 'utf8')) as T;
const API = 'https://mushroom.kindwise.com/api/v1';
const KEY_FILE = join(homedir(), 'Downloads', 'kindwise-key.txt');
const CACHE = new URL('cache/kindwise/', ROOT);
/** The sample: one observation per dangerous species that has one, the rest one per other species, 100 in all. */
const SAMPLE = 100;
/** Never more identifications than this, all runs together (the free allowance). */
const MAX_CALLS = 100;
/** Kindwise suggestions counted as "on the list": the same length as our shortlist before its safety additions. */
const TOP = 5;
/** Where and when, as far as the test knows it: the photos are UK records (no exact spot kept) with a month. Kindwise
 * uses both "to improve results"; our scanner gets the same two facts (UK species only, the month). */
const UK_CENTRE = { latitude: 52.6, longitude: -1.5 };
const mode = process.argv.includes('--plan') ? 'plan' : process.argv.includes('--report') ? 'report' : 'run';

type Ours = { name: string; inatId: number; english: string | null; dangerLevel: 'deadly' | 'poisonous' | null };
type Suggestion = { id: string; name: string; probability: number; details?: { inaturalist_id?: number | null; rank?: string | null } };
type Answer = { obsId: number; asked: string; photos: number;
  result: { classification: { suggestions: Suggestion[] }; is_mushroom?: { binary: boolean; probability: number } } };
type Usage = { active: boolean; can_use_credits: { value: boolean; reason: string | null };
  used: { total: number }; remaining: { total: number | null } };

const ours = read<{ species: Ours[] }>('content/species-list.json').species;
const english = new Map(ours.map((s) => [s.name, s.english ?? s.name]));
const PAGES = pageEdibility(ROOT);
/** Dangerous as the app decides it: the worse of the approved list's level and the page's (src/scan/danger.ts). */
const danger = dangerousSpecies(ours, PAGES);
const index = read<TestEntry[]>('cache/test-photos/index.json');
const checking = index.filter((e) => e.obsId % 2 === 1 && e.files.length > 0);

/** A fixed order nobody chose: by a hash of the observation number. */
const order = (e: TestEntry) => createHash('sha1').update(String(e.obsId)).digest('hex');
function pickSample(): TestEntry[] {
  const bySpecies = new Map<string, TestEntry>();
  for (const e of [...checking].sort((a, b) => order(a).localeCompare(order(b)))) if (!bySpecies.has(e.species)) bySpecies.set(e.species, e);
  const dangerous = [...bySpecies.values()].filter((e) => danger.has(e.species));
  const others = [...bySpecies.values()].filter((e) => !danger.has(e.species));
  return [...dangerous, ...others.slice(0, SAMPLE - dangerous.length)].sort((a, b) => a.obsId - b.obsId);
}

// Kindwise's names → ours: by iNaturalist number first (their detail `inaturalist_id`), then by name — current or an
// older name of ours as iNaturalist lists it (cache/df20/older-names.json, the same list the class maps use).
const byInat = new Map(ours.map((s) => [s.inatId, s.name]));
const byName = new Map<string, string>(ours.map((s) => [s.name, s.name]));
const older = existsSync(new URL('cache/df20/older-names.json', ROOT)) ? read<Record<string, string[]>>('cache/df20/older-names.json') : {};
for (const s of ours) for (const o of older[s.name] ?? []) if (!byName.has(o)) byName.set(o, s.name);
const oursOf = (s: Suggestion): string | null =>
  (s.details?.inaturalist_id != null ? byInat.get(s.details.inaturalist_id) : undefined) ?? byName.get(s.name) ?? null;

function key(): string {
  if (!existsSync(KEY_FILE)) throw new Error(`no key: ${KEY_FILE} does not exist (Stefan's step — see the hand-over)`);
  const k = readFileSync(KEY_FILE, 'utf8').trim();
  if (!/^[A-Za-z0-9_-]{16,}$/.test(k)) throw new Error(`${KEY_FILE} does not look like a key (one line, letters and digits) — not sent anywhere`);
  return k;
}

async function usage(k: string): Promise<Usage> {
  const res = await fetch(`${API}/usage_info`, { headers: { 'Api-Key': k } });
  if (!res.ok) throw new Error(`usage_info: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as Usage;
}

async function identify(k: string, e: TestEntry): Promise<Answer> {
  const images = e.files.map((f) => `data:image/jpeg;base64,${readFileSync(new URL(`cache/test-photos/${f}`, ROOT)).toString('base64')}`);
  const body = { images, ...UK_CENTRE, similar_images: false, datetime: `2025-${String(e.month).padStart(2, '0')}-15` };
  const res = await fetch(`${API}/identification?details=inaturalist_id,rank`, {
    method: 'POST', headers: { 'Api-Key': k, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`identification for observation ${e.obsId}: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as { result: Answer['result']; status: string };
  if (json.status !== 'COMPLETED') throw new Error(`identification for observation ${e.obsId}: status ${json.status}`);
  return { obsId: e.obsId, asked: new Date().toISOString(), photos: images.length, result: json.result };
}

const saved = (e: TestEntry) => new URL(`${e.obsId}.json`, CACHE);
const answerOf = (e: TestEntry): Answer | null => (existsSync(saved(e)) ? JSON.parse(readFileSync(saved(e), 'utf8')) as Answer : null);

async function ask(sample: TestEntry[]) {
  mkdirSync(CACHE, { recursive: true });
  const todo = sample.filter((e) => !answerOf(e));
  const done = sample.length - todo.length;
  if (todo.length === 0) { console.log('every observation of the sample already has its answer'); return; }
  if (done + todo.length > MAX_CALLS) throw new Error(`${done + todo.length} identifications would pass the cap of ${MAX_CALLS}`);
  const k = key();
  let u = await usage(k);
  console.log(`key: active ${u.active}, credits used so far ${u.used.total}, remaining ${u.remaining.total ?? 'not limited'}, can spend ${u.can_use_credits.value}`);
  if (!u.active || !u.can_use_credits.value) throw new Error(`the key cannot spend credits now (${u.can_use_credits.reason ?? 'no reason given'})`);
  if (u.remaining.total !== null && u.remaining.total < todo.length) throw new Error(`${todo.length} to ask, only ${u.remaining.total} credits left — stopped before spending any`);
  for (let i = 0; i < todo.length; i++) {
    const before = u.used.total;
    const answer = await identify(k, todo[i]);
    writeFileSync(saved(todo[i]), JSON.stringify(answer));
    if (i === 0 || (i + 1) % 20 === 0 || i === todo.length - 1) {
      u = await usage(k);
      // After the first call `before` is exact, so the difference is what ONE identification of up to three photos cost.
      if (i === 0 && u.used.total - before > 1) {
        throw new Error(`one identification of ${answer.photos} photos cost ${u.used.total - before} credits — stopped; nothing more was asked`);
      }
      console.log(`${done + i + 1}/${sample.length} asked; credits used ${u.used.total}, remaining ${u.remaining.total ?? 'not limited'}`);
    }
  }
}

// ---- the comparison --------------------------------------------------------------------------------------------------
type Tally = { cases: number; rightFirst: number; onList: number; anywhere: number; dangerCases: number; dangerOnList: number;
  dangerAnywhere: number; safeCases: number; dangerNamedWhenSafe: number; notMushroom: number };
function kindwiseTally(sample: TestEntry[]): { t: Tally; rows: string[] } {
  const t: Tally = { cases: 0, rightFirst: 0, onList: 0, anywhere: 0, dangerCases: 0, dangerOnList: 0, dangerAnywhere: 0,
    safeCases: 0, dangerNamedWhenSafe: 0, notMushroom: 0 };
  const rows: string[] = [];
  for (const e of sample) {
    const a = answerOf(e);
    if (!a) continue;
    const names = a.result.classification.suggestions.map(oursOf);
    const top = names.slice(0, TOP);
    t.cases++;
    if (names[0] === e.species) t.rightFirst++;
    if (top.includes(e.species)) t.onList++;
    if (names.includes(e.species)) t.anywhere++;
    if (a.result.is_mushroom && !a.result.is_mushroom.binary) t.notMushroom++;
    if (danger.has(e.species)) {
      t.dangerCases++;
      if (top.includes(e.species)) t.dangerOnList++;
      if (names.includes(e.species)) t.dangerAnywhere++;
    } else {
      t.safeCases++;
      if (top.some((n) => n !== null && danger.has(n))) t.dangerNamedWhenSafe++;
    }
    const first = a.result.classification.suggestions[0];
    rows.push(`| ${english.get(e.species)}${danger.has(e.species) ? ` (**${danger.get(e.species)}**)` : ''} | ${e.files.length} | ` +
      `${first ? `${first.name} ${(first.probability * 100).toFixed(0)}%` : '–'} | ${names[0] === e.species ? 'yes' : top.includes(e.species) ? 'on list' : names.includes(e.species) ? 'further down' : 'no'} |`);
  }
  return { t, rows };
}

/** Our scanner as the app runs it (the model, file and thresholds in content/model/scan-settings.json). */
function oursOn(sample: TestEntry[]): { m: Measures; label: string } | null {
  const settings = read<{ passed: boolean; model: string; file: string; norm: string; fit: string; thresholds: Thresholds }>('content/model/scan-settings.json');
  if (!settings.passed) return null;
  const classes = withPageDanger(read<{ classes: ClassInfo[] }>('content/model/df20-classes.json').classes, PAGES);
  const name = `${settings.model.split('/')[1]}${settings.norm === 'half' ? '' : '.imagenet'}${settings.fit === 'squash' ? '' : `.${settings.fit}`}.phone`;
  const wanted = new Set(sample.map((e) => e.obsId));
  const cases: Case[] = readScoreCases(ROOT, name, classes.length, index).cases.filter((c) => wanted.has(c.obsId));
  const lookalikes = new Map<string, string[]>();
  for (const p of read<CoreLists>('tools/config/core-lists.json').pairs) {
    lookalikes.set(p.edible, [...(lookalikes.get(p.edible) ?? []), p.dangerous]);
    lookalikes.set(p.dangerous, [...(lookalikes.get(p.dangerous) ?? []), p.edible]);
  }
  return { m: measure(cases, classes, danger, lookalikes, settings.thresholds, 3), label: `our scanner (${settings.file})` };
}

const pct = (n: number, d: number) => (d === 0 ? '–' : `${((100 * n) / d).toFixed(0)}% (${n}/${d})`);

async function main() {
  const sample = pickSample();
  const nDanger = sample.filter((e) => danger.has(e.species)).length;
  if (mode === 'plan') {
    console.log(`${sample.length} observations (${nDanger} of dangerous species), ${sample.reduce((n, e) => n + e.files.length, 0)} photos`);
    for (const e of sample) console.log(`${e.obsId}  ${english.get(e.species)}${danger.has(e.species) ? ` [${danger.get(e.species)}]` : ''}  ${e.files.length} photo(s)`);
    return;
  }
  if (mode === 'run') await ask(sample);
  const { t, rows } = kindwiseTally(sample);
  if (t.cases === 0) { console.log('no Kindwise answers saved yet — nothing to report'); return; }
  const o = oursOn(sample.filter((e) => answerOf(e)));
  const L: string[] = [];
  L.push('# Our scanner against Kindwise', '');
  L.push(`Built ${new Date().toISOString().slice(0, 10)} by \`tools/kindwise-test.ts\`. ${t.cases} UK observations from the scan test's ` +
    `checking half (photos neither side was tuned on): one for each of the ${nDanger} dangerous species that has one, the rest one ` +
    'per other species, in a fixed order nobody chose. Both sides saw the same photos (up to three per observation), the ' +
    'month, and "UK" (Kindwise as a point in central England — the exact spots are not kept).', '');
  L.push('| | Kindwise | ' + (o ? o.label : 'our scanner') + ' |', '|---|---|---|');
  if (o) {
    const m = o.m;
    const dAll = m.dangerKnown + m.dangerUnknown;
    L.push(`| Right first | ${pct(t.rightFirst, t.cases)} | ${pct(m.rightFirst, m.cases)} |`);
    L.push(`| Right species on the list (Kindwise: top ${TOP}; ours: the shortlist as the app shows it) | ${pct(t.onList, t.cases)} | ${pct(m.onList, m.cases)} |`);
    L.push(`| Dangerous species on the list when it is the answer | ${pct(t.dangerOnList, t.dangerCases)} | ${pct(m.dangerOnList, dAll)} |`);
    L.push(`| A dangerous species named when the answer is safe | ${pct(t.dangerNamedWhenSafe, t.safeCases)} | ${pct(m.falseAlarms, m.safeCases)} (red banner) |`);
  } else {
    L.push(`| Right first | ${pct(t.rightFirst, t.cases)} | – |`, `| Right species in the top ${TOP} | ${pct(t.onList, t.cases)} | – |`,
      `| Dangerous species in the top ${TOP} when it is the answer | ${pct(t.dangerOnList, t.dangerCases)} | – |`);
  }
  L.push('', `Kindwise also: right species anywhere in its list ${pct(t.anywhere, t.cases)}; dangerous species anywhere in its list ` +
    `${pct(t.dangerAnywhere, t.dangerCases)}; said "probably not a mushroom" ${t.notMushroom} times.`, '');
  L.push('A species our model cannot name counts as a miss for ours; one Kindwise names under a name we do not hold counts as a miss for Kindwise.', '');
  L.push('## Observation by observation (Kindwise)', '');
  L.push('| Species (the answer) | Photos | Kindwise first | Right? |', '|---|---|---|---|', ...rows);
  writeFileSync(new URL('reports/kindwise-test.md', ROOT), L.join('\n') + '\n');
  console.log(`reports/kindwise-test.md written (${t.cases} observations)`);
}

await main();
