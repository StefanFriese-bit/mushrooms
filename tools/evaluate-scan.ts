import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import type { ClassInfo, Thresholds } from '../src/scan/rules.ts';
import type { CoreLists } from './lib/core-lists.ts';
import {
  PASS_MARK, checkingHalf, chooseNotSure, chooseSafety, measure, tuningHalf, type Case, type Measures,
} from './lib/scan-metrics.ts';

// The scan test (spec 6.3): every candidate's scores (cache/scores/) put through the app's own rules, the two
// thresholds chosen on the tuning half, every measure on the checking half → reports/scan-test.md and, for the best
// phone-sized model that passes, content/model/scan-settings.json. `--quick` prints "right first" per score file only.
const ROOT = new URL('../', import.meta.url);
const read = <T>(rel: string): T => JSON.parse(readFileSync(new URL(rel, ROOT), 'utf8')) as T;
const quick = process.argv.includes('--quick');

/** What each candidate weighs; only phone-sized ones can be chosen for the app. */
const CANDIDATES: Record<string, { label: string; millions: number; phone: boolean }> = {
  'BVRA/mobilenetv2_100.in1k_ft_df20_299': { label: 'MobileNetV2', millions: 3.5, phone: true },
  'BVRA/tf_efficientnet_b0.in1k_ft_df20_299': { label: 'EfficientNet-B0', millions: 6.1, phone: true },
  'BVRA/resnet18.in1k_ft_df20_299': { label: 'ResNet-18', millions: 11.7, phone: true },
  'BVRA/tf_efficientnet_b3.in1k_ft_df20_299': { label: 'EfficientNet-B3', millions: 12, phone: true },
  'BVRA/vit_base_patch16_224.ft_df20_224': { label: 'ViT-Base (ceiling only)', millions: 86, phone: false },
};

type Entry = { species: string; inatId: number; obsId: number; month: number; files: string[] };
type Ours = { name: string; english: string | null; dangerLevel: 'deadly' | 'poisonous' | null };
type ScoreMeta = { model: string; size: number; norm: string; classes: number; files: string[] };

const classes = read<{ classes: ClassInfo[] }>('content/model/df20-classes.json').classes;
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
const scoreFiles = readdirSync(new URL('cache/scores/', ROOT)).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort();

if (quick) {
  for (const name of scoreFiles) {
    const { cases } = casesFor(name);
    const m = measure(cases, classes, danger, lookalikes, { safety: 1, notSure: 0, offSeason: 1 }, 1);
    console.log(`${name.padEnd(56)} ${String(m.known).padStart(5)} observations  right first ${pct(m.rightFirst, m.known)}`);
  }
  process.exit(0);
}

type Result = { name: string; meta: ScoreMeta; t: Thresholds; safetyFound: boolean; one: Measures; three: Measures;
  passed: boolean; perDanger: Array<{ species: string; onList: number; cases: number; caught?: number }> };
const results: Result[] = [];
for (const name of scoreFiles.filter((n) => !n.includes('.first'))) {
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
    const own = checking.filter((c) => c.species === sp);
    const m = measure(own, classes, danger, lookalikes, t, 3);
    return known.has(sp) ? { species: sp, onList: m.dangerOnList, cases: m.dangerKnown }
      : { species: sp, onList: 0, cases: m.dangerUnknown, caught: m.dangerCaughtByCheck };
  });
  const passed = safety !== null && three.dangerKnown > 0 && three.dangerOnList / three.dangerKnown >= PASS_MARK;
  results.push({ name, meta, t, safetyFound: safety !== null, one, three, passed, perDanger });
  console.log(`${name}: right first ${pct(three.rightFirst, three.known)}, dangerous on the list ${pct(three.dangerOnList, three.dangerKnown)}, ${passed ? 'PASSES' : 'does not pass'}`);
}

const label = (r: Result) => CANDIDATES[r.meta.model]?.label ?? r.meta.model;
const chosen = results
  .filter((r) => r.passed && CANDIDATES[r.meta.model]?.phone)
  .sort((a, b) => b.three.rightFirst / b.three.known - a.three.rightFirst / a.three.known)[0];

const lines: string[] = [];
lines.push('# The scan test', '');
lines.push(`Built ${new Date().toISOString().slice(0, 10)} by \`tools/evaluate-scan.ts\` from ${index.length} UK observations ` +
  `(${index.reduce((n, e) => n + e.files.length, 0)} photos) of our species — none of them the guide's own photos. ` +
  'Thresholds were chosen on half the observations (even numbers) and every figure below is measured on the other half.', '');
lines.push(`**Pass mark (spec 6.3):** dangerous species on the shortlist at least ${PASS_MARK * 100} times in 100 when they are the answer.`, '');
lines.push('## The candidates', '');
lines.push('| Model | Size | Right first (1 photo) | Right first (up to 3) | On the shortlist | Dangerous on the shortlist | False alarms | "Not sure" | Passes |');
lines.push('|---|---|---|---|---|---|---|---|---|');
for (const r of results) {
  const c = CANDIDATES[r.meta.model];
  lines.push(`| ${label(r)} | ${c ? `${c.millions} M` : '?'} | ${pct(r.one.rightFirst, r.one.known)} | ${pct(r.three.rightFirst, r.three.known)} | ` +
    `${pct(r.three.onList, r.three.known)} | ${pct(r.three.dangerOnList, r.three.dangerKnown)} (${r.three.dangerOnList}/${r.three.dangerKnown}) | ` +
    `${pct(r.three.falseAlarms, r.three.safeCases)} | ${pct(r.three.cases - r.three.sure, r.three.cases)} | ${r.passed ? 'yes' : 'no'} |`);
}
lines.push('', 'Thresholds per model (from the tuning half): safety = the highest score at which a dangerous species is still added; ' +
  '"not sure" = the lowest top score above which the first answer is right 90 times in 100; off-season = the mark-down factor.', '');
for (const r of results) lines.push(`- ${label(r)}: safety ${r.safetyFound ? r.t.safety : 'none reaches the pass mark'}, not sure ${r.t.notSure}, off-season ×${r.t.offSeason}`);
lines.push('', '## What the model knows', '');
lines.push(`${known.size} of our ${ours.length} species are among its 1,604 classes. The ${ours.length - known.size} it cannot recognise ` +
  '(their pages will say so):', '');
lines.push(ours.filter((s) => !known.has(s.name)).map((s) => `${english.get(s.name)} (*${s.name}*)${s.dangerLevel ? ` — **${s.dangerLevel}**` : ''}`).join(' · '), '');
const show = chosen ?? results[0];
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
  : '**No phone-sized model passes.** The scan stays switched off (spec 6.3); everything else works.', '');
writeFileSync(new URL('reports/scan-test.md', ROOT), lines.join('\n') + '\n');
writeFileSync(new URL('content/model/scan-settings.json', ROOT), JSON.stringify(chosen ? {
  passed: true, model: chosen.meta.model, size: chosen.meta.size, norm: chosen.meta.norm, thresholds: chosen.t,
  record: { rightFirst: chosen.three.rightFirst / chosen.three.known, onList: chosen.three.onList / chosen.three.known,
    dangerOnList: chosen.three.dangerOnList / chosen.three.dangerKnown, observations: chosen.three.cases },
  tested: new Date().toISOString().slice(0, 10),
} : { passed: false, tested: new Date().toISOString().slice(0, 10) }, null, 2) + '\n');
console.log(`reports/scan-test.md written${existsSync(new URL('content/model/scan-settings.json', ROOT)) ? ' (and scan-settings.json)' : ''}`);
