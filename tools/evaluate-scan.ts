import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import type { ClassInfo, Thresholds } from '../src/scan/rules.ts';
import type { CoreLists } from './lib/core-lists.ts';
import {
  PASS_MARK, checkingHalf, chooseNotSure, chooseSafety, measure, tuningHalf, type Case, type Measures,
} from './lib/scan-metrics.ts';

// The scan test (spec 6.3): every candidate's scores (cache/scores/) put through the app's own rules, the two
// thresholds chosen on the tuning half, every measure on the checking half → reports/scan-test.md and, for the best
// phone-sized model that passes AS THE 8-BIT FILE THE PHONE RUNS, content/model/scan-settings.json.
// Score files from a sample of the tuning half (`.sampleK`, for choosing how photos are prepared) are listed apart.
// `--quick` prints "right first" (one photo) per score file only.
const ROOT = new URL('../', import.meta.url);
const read = <T>(rel: string): T => JSON.parse(readFileSync(new URL(rel, ROOT), 'utf8')) as T;
const quick = process.argv.includes('--quick');

/** What each candidate weighs; only phone-sized ones can be chosen for the app. */
const CANDIDATES: Record<string, { label: string; millions: number; phone: boolean }> = {
  'BVRA/mobilenetv2_100.in1k_ft_df20_299': { label: 'MobileNetV2', millions: 4.3, phone: true },
  'BVRA/tf_efficientnet_b0.in1k_ft_df20_299': { label: 'EfficientNet-B0', millions: 6.1, phone: true },
  'BVRA/resnet18.in1k_ft_df20_299': { label: 'ResNet-18', millions: 12, phone: true },
  'BVRA/tf_efficientnet_b3.in1k_ft_df20_299': { label: 'EfficientNet-B3', millions: 13.2, phone: true },
  'BVRA/vit_base_patch16_224.ft_df20_224': { label: 'ViT-Base (ceiling only)', millions: 87, phone: false },
};
/** The most "right first" an 8-bit file may lose against its full-size model (plan 2d-1, task 7). */
const MAX_8BIT_LOSS = 0.01;

type Entry = { species: string; inatId: number; obsId: number; month: number; files: string[] };
type Ours = { name: string; english: string | null; dangerLevel: 'deadly' | 'poisonous' | null };
type ScoreMeta = { model: string; size: number; norm: string; fit?: string; onnx?: string | null; classes: number; files: string[] };

const classes = read<{ classes: ClassInfo[] }>('content/model/df20-classes.json').classes;
if (classes.some((c, i) => c.id !== i)) throw new Error('df20-classes.json is not in model order (class i at position i)');
const index = read<Entry[]>('cache/test-photos/index.json');
const ours = read<{ species: Ours[] }>('content/species-list.json').species;
const english = new Map(ours.map((s) => [s.name, s.english ?? s.name]));
const danger = new Map(ours.filter((s) => s.dangerLevel).map((s) => [s.name, s.dangerLevel as 'deadly' | 'poisonous']));
const lookalikes = new Map<string, string[]>();
for (const p of read<CoreLists>('tools/config/core-lists.json').pairs) {
  lookalikes.set(p.edible, [...(lookalikes.get(p.edible) ?? []), p.dangerous]);
  lookalikes.set(p.dangerous, [...(lookalikes.get(p.dangerous) ?? []), p.edible]);
}
const known = new Set(classes.filter((c) => c.ours).map((c) => c.ours as string));

function casesFor(name: string): { meta: ScoreMeta; cases: Case[] } {
  const meta = read<ScoreMeta>(`cache/scores/${name}.json`);
  const bytes = readFileSync(new URL(`cache/scores/${name}.f32`, ROOT));
  const data = new Float32Array(new Uint8Array(bytes).buffer);
  if (data.length !== meta.files.length * meta.classes) throw new Error(`${name}: scores do not fit ${meta.files.length} photos`);
  if (meta.classes !== classes.length) throw new Error(`${name}: ${meta.classes} classes, the class list has ${classes.length}`);
  const row = new Map(meta.files.map((f, i) => [f, i]));
  const cases: Case[] = [];
  for (const e of index) {
    if (!e.files.every((f) => row.has(f))) continue;
    cases.push({ obsId: e.obsId, species: e.species, month: e.month,
      photos: e.files.map((f) => data.subarray(row.get(f)! * meta.classes, (row.get(f)! + 1) * meta.classes)) });
  }
  return { meta, cases };
}

const pct = (n: number, d: number) => (d === 0 ? '–' : `${((100 * n) / d).toFixed(1)}%`);
const share = (n: number, d: number) => (d === 0 ? 0 : n / d);
const scoreFiles = readdirSync(new URL('cache/scores/', ROOT)).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort();
const isSample = (name: string) => /\.sample\d+$/.test(name);
const quickMeasure = (cases: Case[]) => measure(cases, classes, danger, lookalikes, { safety: 1, notSure: 0, offSeason: 1 }, 1);
const fitOf = (m: ScoreMeta) => m.fit ?? 'squash';
const prepared = (m: ScoreMeta) => `${fitOf(m)}, ${m.norm === 'half' ? '0.5/0.5' : 'ImageNet'} colours`;

if (quick) {
  for (const name of scoreFiles) {
    const m = quickMeasure(casesFor(name).cases);
    console.log(`${name.padEnd(60)} ${String(m.known).padStart(5)} observations  right first ${pct(m.rightFirst, m.known)}`);
  }
  process.exit(0);
}

type Result = { name: string; meta: ScoreMeta; t: Thresholds; safetyFound: boolean; one: Measures; three: Measures;
  meetsMark: boolean; loss: number | null; passed: boolean;
  perDanger: Array<{ species: string; onList: number; cases: number; caught?: number }> };
const results: Result[] = [];
for (const name of scoreFiles.filter((n) => !isSample(n))) {
  const { meta, cases } = casesFor(name);
  const tuning = tuningHalf(cases);
  const checking = checkingHalf(cases);
  let offSeason = 1;
  let best = -1;
  for (const f of [1, 0.7, 0.5, 0.3]) {
    const m = measure(tuning, classes, danger, lookalikes, { safety: 1, notSure: 0, offSeason: f }, 3);
    if (m.rightFirst > best) { best = m.rightFirst; offSeason = f; }
  }
  const safety = chooseSafety(tuning, classes, danger, lookalikes, { safety: 1, notSure: 0, offSeason });
  const notSure = chooseNotSure(tuning, classes, danger, lookalikes, { safety: safety ?? 1, notSure: 0, offSeason });
  const t: Thresholds = { safety: safety ?? 0, notSure, offSeason };
  const one = measure(checking, classes, danger, lookalikes, t, 1);
  const three = measure(checking, classes, danger, lookalikes, t, 3);
  const perDanger = [...danger.keys()].map((sp) => {
    const m = measure(checking.filter((c) => c.species === sp), classes, danger, lookalikes, t, 3);
    return known.has(sp) ? { species: sp, onList: m.dangerOnList, cases: m.dangerKnown }
      : { species: sp, onList: 0, cases: m.dangerUnknown, caught: m.dangerCaughtByCheck };
  });
  const meetsMark = safety !== null && three.dangerKnown > 0 && three.dangerOnList / three.dangerKnown >= PASS_MARK;
  results.push({ name, meta, t, safetyFound: safety !== null, one, three, meetsMark, loss: null, passed: meetsMark, perDanger });
}
// An 8-bit file must also keep its full-size model's record: at most one point of "right first" lost.
for (const r of results.filter((x) => x.meta.onnx)) {
  const full = results.find((x) => !x.meta.onnx && x.meta.model === r.meta.model && x.meta.norm === r.meta.norm && fitOf(x.meta) === fitOf(r.meta));
  if (!full) continue;
  r.loss = share(full.three.rightFirst, full.three.known) - share(r.three.rightFirst, r.three.known);
  r.passed = r.meetsMark && r.loss <= MAX_8BIT_LOSS;
}
for (const r of results) {
  console.log(`${r.name}: right first ${pct(r.three.rightFirst, r.three.known)}, dangerous on the list ` +
    `${pct(r.three.dangerOnList, r.three.dangerKnown)}, ${r.passed ? 'PASSES' : 'does not pass'}`);
}

const label = (r: Result) => `${CANDIDATES[r.meta.model]?.label ?? r.meta.model}${r.meta.onnx ? ' (8-bit)' : ''}`;
const byRightFirst = (a: Result, b: Result) => share(b.three.rightFirst, b.three.known) - share(a.three.rightFirst, a.three.known);
const phonePassing = results.filter((r) => r.passed && CANDIDATES[r.meta.model]?.phone).sort(byRightFirst);
const chosen = phonePassing.find((r) => r.meta.onnx);
const fullOnly = chosen ? undefined : phonePassing[0];

const lines: string[] = [];
lines.push('# The scan test', '');
lines.push(`Built ${new Date().toISOString().slice(0, 10)} by \`tools/evaluate-scan.ts\` from ${index.length} UK observations ` +
  `(${index.reduce((n, e) => n + e.files.length, 0)} photos) of our species — none of them the guide's own photos. ` +
  'Every choice (how photos are prepared, the thresholds) was made on half the observations (even numbers); every ' +
  'figure below is measured on the other half.', '');
lines.push(`**Pass mark (spec 6.3):** dangerous species on the shortlist at least ${PASS_MARK * 100} times in 100 when they are the answer. ` +
  `An 8-bit file (what the phone runs) must also lose at most ${MAX_8BIT_LOSS * 100} point of "right first" against its full-size model.`, '');
lines.push(`**Dangerous** here means the ${danger.size} species on the approved list's safety list (Deadly, or a dangerous lookalike of ` +
  'an edible). Other poisonous species among the 300 (the Fly Agaric, for one) count once their pages are written, and the ' +
  'test is run again then.', '');

const samples = scoreFiles.filter(isSample);
if (samples.length > 0) {
  lines.push('## How photos are prepared', '');
  lines.push('Each model scored the same sample of the tuning half in each way; the best way is used for every figure below and in the app.', '');
  lines.push('| Model | Prepared as | Observations | Right first (1 photo) |', '|---|---|---|---|');
  for (const name of samples) {
    const { meta, cases } = casesFor(name);
    const m = quickMeasure(cases);
    lines.push(`| ${CANDIDATES[meta.model]?.label ?? meta.model}${meta.onnx ? ' (8-bit)' : ''} | ${prepared(meta)} | ${m.known} | ${pct(m.rightFirst, m.known)} |`);
  }
  lines.push('', 'squash = the whole photo scaled to a square; square = the centre square; timm = the centre 87.5% square (the models\' own evaluation crop).', '');
}

lines.push('## The candidates', '');
lines.push('| Model | Size | Prepared as | Right first (1 photo) | Right first (up to 3) | On the shortlist | Dangerous on the shortlist | False alarms | "Not sure" | Passes |');
lines.push('|---|---|---|---|---|---|---|---|---|---|');
for (const r of results) {
  const c = CANDIDATES[r.meta.model];
  lines.push(`| ${label(r)} | ${c ? `${c.millions} M` : '?'} | ${prepared(r.meta)} | ${pct(r.one.rightFirst, r.one.known)} | ` +
    `${pct(r.three.rightFirst, r.three.known)} | ${pct(r.three.onList, r.three.known)} | ` +
    `${pct(r.three.dangerOnList, r.three.dangerKnown)} (${r.three.dangerOnList}/${r.three.dangerKnown}) | ` +
    `${pct(r.three.falseAlarms, r.three.safeCases)} | ${pct(r.three.cases - r.three.sure, r.three.cases)} | ${r.passed ? 'yes' : 'no'} |`);
}
lines.push('', 'Thresholds per model (from the tuning half): safety = the highest score at which a dangerous species is still added; ' +
  '"not sure" = the lowest top score above which the first answer is right 90 times in 100; off-season = the mark-down factor.', '');
for (const r of results) {
  lines.push(`- ${label(r)}: safety ${r.safetyFound ? r.t.safety : 'none reaches the pass mark'}, not sure ${r.t.notSure}, off-season ×${r.t.offSeason}` +
    (r.loss === null ? '' : `; against the full-size model ${r.loss <= 0 ? 'no "right first" lost' : `${(r.loss * 100).toFixed(1)} points of "right first" lost`}`));
}
lines.push('', '## What the model knows', '');
lines.push(`${known.size} of our ${ours.length} species are among its 1,604 classes. The ${ours.length - known.size} it cannot recognise ` +
  '(their pages will say so):', '');
lines.push(ours.filter((s) => !known.has(s.name)).map((s) => `${english.get(s.name)} (*${s.name}*)${s.dangerLevel ? ` — **${s.dangerLevel}**` : ''}`).join(' · '), '');
const viaOlder = classes.filter((c) => c.ours && c.ours !== c.name);
lines.push(`${viaOlder.length} of its species carry an older name of one of ours (as iNaturalist files them), e.g. ` +
  viaOlder.slice(0, 3).map((c) => `*${c.name}* = ${english.get(c.ours as string)}`).join(', ') + '. ' +
  (viaOlder.some((c) => c.name === 'Amanita gemmata') ? 'One of them looks different: the Jewelled Amanita (*Amanita gemmata*) counts as the ' +
    'Fly Agaric, because iNaturalist files it there; on a scan it shows as the Fly Agaric, a poisonous Amanita.' : ''), '');
const show = chosen ?? fullOnly ?? [...results].sort(byRightFirst)[0];
if (show) {
  lines.push(`## Dangerous species, one by one (${label(show)}, up to three photos)`, '');
  lines.push('| Species | Danger | On the shortlist | Caught by Check (the model does not know it) |', '|---|---|---|---|');
  for (const d of show.perDanger) {
    lines.push(`| ${english.get(d.species)} | ${danger.get(d.species)} | ${d.caught === undefined ? `${d.onList}/${d.cases}` : '–'} | ` +
      `${d.caught === undefined ? '' : `${d.caught}/${d.cases}`} |`);
  }
}
lines.push('', '## The choice', '');
lines.push(chosen
  ? `**${label(chosen)}** passes and is the best phone-sized model. Its speed on Stefan's iPhone decides (spec 6.1): ` +
    'a three-photo scan in about 3 seconds.'
  : fullOnly
    ? `**${label(fullOnly)}** passes at full size. It must now pass again as the 8-bit file the phone will run.`
    : '**No phone-sized model passes.** The scan stays switched off (spec 6.3); everything else works.', '');
writeFileSync(new URL('reports/scan-test.md', ROOT), lines.join('\n') + '\n');

const tested = new Date().toISOString().slice(0, 10);
writeFileSync(new URL('content/model/scan-settings.json', ROOT), JSON.stringify(chosen ? {
  passed: true, model: chosen.meta.model, file: (chosen.meta.onnx as string).replace(/^public\//, ''),
  size: chosen.meta.size, norm: chosen.meta.norm, fit: fitOf(chosen.meta), thresholds: chosen.t,
  record: { rightFirst: share(chosen.three.rightFirst, chosen.three.known), onList: share(chosen.three.onList, chosen.three.known),
    dangerOnList: share(chosen.three.dangerOnList, chosen.three.dangerKnown), observations: chosen.three.cases },
  tested,
} : { passed: false, reason: fullOnly ? 'no 8-bit file has passed yet' : 'no phone-sized model passes', tested }, null, 2) + '\n');
console.log(`reports/scan-test.md and content/model/scan-settings.json written${chosen ? ` (${label(chosen)} chosen)` : ''}`);
