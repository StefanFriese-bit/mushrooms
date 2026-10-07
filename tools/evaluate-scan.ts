import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import type { ClassInfo, Thresholds } from '../src/scan/rules.ts';
import type { CoreLists } from './lib/core-lists.ts';
import { pageEdibility, readScoreCases, type ScoreMeta, type TestEntry } from './lib/scan-scores.ts';
import { dangerousSpecies, withPageDanger } from '../src/scan/danger.ts';
import {
  PASS_MARK, checkingHalf, chooseGroup, chooseNotSure, chooseSafety, measure, tuningHalf, type Case, type Measures,
} from './lib/scan-metrics.ts';

// The scan test (spec 6.3): every candidate's scores (cache/scores/) put through the app's own rules, the two
// thresholds chosen on the tuning half, every measure on the checking half → reports/scan-test.md and, for the best
// phone-sized model that passes AS THE 8-BIT FILE THE PHONE RUNS, content/model/scan-settings.json.
// Score files from a sample of the tuning half (`.sampleK`, for choosing how photos are prepared) are listed apart.
// `--quick` prints "right first" (one photo) per score file only.
const ROOT = new URL('../', import.meta.url);
const read = <T>(rel: string): T => JSON.parse(readFileSync(new URL(rel, ROOT), 'utf8')) as T;
const quick = process.argv.includes('--quick');

/** A model family = one species list: DF20 (1,604 classes, what the app runs) or FungiTastic (2,829). */
type Family = 'df20' | 'fungitastic';
/** The family the app reads its class list from (src/screens/scan.tsx imports df20-classes.json). Only a model of this
 * family can be written into scan-settings.json; another family's winner is reported, and the app is changed by hand. */
const APP_FAMILY: Family = 'df20';
const FAMILY_FILES: Record<Family, { file: string; label: string }> = {
  df20: { file: 'content/model/df20-classes.json', label: 'DF20' },
  fungitastic: { file: 'content/model/fungitastic-classes.json', label: 'FungiTastic' },
};
/** What each candidate weighs (millions of weights, its own species head included); only phone-sized ones can be chosen. */
const CANDIDATES: Record<string, { label: string; millions: number; phone: boolean; family: Family }> = {
  'BVRA/mobilenetv2_100.in1k_ft_df20_299': { label: 'MobileNetV2', millions: 4.3, phone: true, family: 'df20' },
  'BVRA/tf_efficientnet_b0.in1k_ft_df20_299': { label: 'EfficientNet-B0', millions: 6.1, phone: true, family: 'df20' },
  'BVRA/resnet18.in1k_ft_df20_299': { label: 'ResNet-18', millions: 12, phone: true, family: 'df20' },
  'BVRA/tf_efficientnet_b3.in1k_ft_df20_299': { label: 'EfficientNet-B3', millions: 13.2, phone: true, family: 'df20' },
  'BVRA/vit_base_patch16_224.ft_df20_224': { label: 'ViT-Base (ceiling only)', millions: 87, phone: false, family: 'df20' },
  'BVRA/tf_efficientnetv2_b3.in1k_ft_fungitastic_384': { label: 'FungiTastic EfficientNetV2-B3', millions: 17.2, phone: true, family: 'fungitastic' },
  'BVRA/tf_efficientnet_b3.in1k_ft_fungitastic_384': { label: 'FungiTastic EfficientNet-B3', millions: 15.0, phone: true, family: 'fungitastic' },
  'BVRA/resnet50.in1k_ft_fungitastic_224': { label: 'FungiTastic ResNet-50', millions: 29.3, phone: true, family: 'fungitastic' },
  'BVRA/vit_base_patch16_384.in1k_ft_fungitastic_384': { label: 'FungiTastic ViT-Base (ceiling only)', millions: 88.3, phone: false, family: 'fungitastic' },
};
const familyOf = (model: string): Family => CANDIDATES[model]?.family ?? (model.includes('fungitastic') ? 'fungitastic' : 'df20');
/** The most "right first" the file the phone runs (8-bit or full size, scored through the file itself) may lose against
 * the same model run in PyTorch (plan 2d-1, task 7). */
const MAX_FILE_LOSS = 0.01;

type Ours = { name: string; english: string | null; dangerLevel: 'deadly' | 'poisonous' | null };

const classLists = new Map<Family, ClassInfo[]>();
function classesOf(family: Family): ClassInfo[] {
  let list = classLists.get(family);
  if (!list) {
    list = read<{ classes: ClassInfo[] }>(FAMILY_FILES[family].file).classes;
    if (list.some((c, i) => c.id !== i)) throw new Error(`${FAMILY_FILES[family].file} is not in model order (class i at position i)`);
    list = withPageDanger(list, PAGES); // the danger the app's rules use (src/scan/danger.ts)
    classLists.set(family, list);
  }
  return list;
}
const knownBy = (classes: ClassInfo[]) => new Set(classes.filter((c) => c.ours).map((c) => c.ours as string));
const index = read<TestEntry[]>('cache/test-photos/index.json');
const ours = read<{ species: Ours[] }>('content/species-list.json').species;
const english = new Map(ours.map((s) => [s.name, s.english ?? s.name]));
const PAGES = pageEdibility(ROOT);
/** Dangerous = the worse of the approved list's level and the page's, exactly as the app decides it (src/scan/danger.ts). */
const danger = dangerousSpecies(ours, PAGES);
const onSafetyList = ours.filter((s) => s.dangerLevel).length;
const lookalikes = new Map<string, string[]>();
for (const p of read<CoreLists>('tools/config/core-lists.json').pairs) {
  lookalikes.set(p.edible, [...(lookalikes.get(p.edible) ?? []), p.dangerous]);
  lookalikes.set(p.dangerous, [...(lookalikes.get(p.dangerous) ?? []), p.edible]);
}

function casesFor(name: string): { meta: ScoreMeta; cases: Case[]; classes: ClassInfo[] } {
  const meta = read<ScoreMeta>(`cache/scores/${name}.json`);
  const classes = classesOf(familyOf(meta.model));
  return { ...readScoreCases(ROOT, name, classes.length, index), classes };
}

const pct = (n: number, d: number) => (d === 0 ? '–' : `${((100 * n) / d).toFixed(1)}%`);
const share = (n: number, d: number) => (d === 0 ? 0 : n / d);
const scoreFiles = readdirSync(new URL('cache/scores/', ROOT)).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort();
const isSample = (name: string) => /\.sample\d+$/.test(name);
/** A group line no scan reaches: no headline. */
const NO_GROUP = 2;
const quickMeasure = (cases: Case[], classes: ClassInfo[]) => measure(cases, classes, danger, lookalikes, { safety: 1, notSure: 0, offSeason: 1, group: NO_GROUP }, 1);
const fitOf = (m: ScoreMeta) => m.fit ?? 'squash';
const prepared = (m: ScoreMeta) => `${fitOf(m)}, ${m.norm === 'half' ? '0.5/0.5' : 'ImageNet'} colours`;

if (quick) {
  for (const name of scoreFiles) {
    const { cases, classes } = casesFor(name);
    const m = quickMeasure(cases, classes);
    console.log(`${name.padEnd(60)} ${String(m.known).padStart(5)} observations  right first ${pct(m.rightFirst, m.known)}`);
  }
  process.exit(0);
}

type Result = { name: string; meta: ScoreMeta; classes: ClassInfo[]; known: Set<string>; t: Thresholds; safetyFound: boolean; one: Measures; three: Measures;
  meetsMark: boolean; loss: number | null; passed: boolean;
  perDanger: Array<{ species: string; onList: number; cases: number; caught?: number }> };
const results: Result[] = [];
for (const name of scoreFiles.filter((n) => !isSample(n))) {
  const { meta, cases, classes } = casesFor(name);
  const known = knownBy(classes);
  const tuning = tuningHalf(cases);
  const checking = checkingHalf(cases);
  let offSeason = 1;
  let best = -1;
  for (const f of [1, 0.7, 0.5, 0.3]) {
    const m = measure(tuning, classes, danger, lookalikes, { safety: 1, notSure: 0, offSeason: f, group: NO_GROUP }, 3);
    if (m.rightFirst > best) { best = m.rightFirst; offSeason = f; }
  }
  const safety = chooseSafety(tuning, classes, danger, lookalikes, { safety: 1, notSure: 0, offSeason, group: NO_GROUP });
  const notSure = chooseNotSure(tuning, classes, danger, lookalikes, { safety: safety ?? 1, notSure: 0, offSeason, group: NO_GROUP });
  const group = chooseGroup(tuning, classes, danger, lookalikes, { safety: safety ?? 1, notSure, offSeason, group: NO_GROUP });
  const t: Thresholds = { safety: safety ?? 0, notSure, offSeason, group: group ?? NO_GROUP };
  const one = measure(checking, classes, danger, lookalikes, t, 1);
  const three = measure(checking, classes, danger, lookalikes, t, 3);
  const perDanger = [...danger.keys()].map((sp) => {
    const m = measure(checking.filter((c) => c.species === sp), classes, danger, lookalikes, t, 3);
    return known.has(sp) ? { species: sp, onList: m.dangerOnList, cases: m.dangerKnown }
      : { species: sp, onList: 0, cases: m.dangerUnknown, caught: m.dangerCaughtByCheck };
  });
  const meetsMark = safety !== null && three.dangerKnown > 0 && three.dangerOnList / three.dangerKnown >= PASS_MARK;
  results.push({ name, meta, classes, known, t, safetyFound: safety !== null, one, three, meetsMark, loss: null, passed: meetsMark, perDanger });
}
// A file the phone runs must also keep its model's record: at most one point of "right first" lost.
for (const r of results.filter((x) => x.meta.onnx)) {
  const full = results.find((x) => !x.meta.onnx && x.meta.model === r.meta.model && x.meta.norm === r.meta.norm && fitOf(x.meta) === fitOf(r.meta));
  if (!full) continue;
  r.loss = share(full.three.rightFirst, full.three.known) - share(r.three.rightFirst, r.three.known);
  r.passed = r.meetsMark && r.loss <= MAX_FILE_LOSS;
}
for (const r of results) {
  console.log(`${r.name}: right first ${pct(r.three.rightFirst, r.three.known)}, dangerous on the list ` +
    `${pct(r.three.dangerOnList, r.three.dangerKnown)}, ${r.passed ? 'PASSES' : 'does not pass'}`);
}

const fileKind = (m: ScoreMeta) => (m.onnx ? (m.onnx.includes('int8') ? ' (8-bit)' : ' (phone file)') : '');
const label = (r: Result) => `${CANDIDATES[r.meta.model]?.label ?? r.meta.model}${fileKind(r.meta)}`;
// Ranked over ALL our species with photos: a species the model does not know counts as a miss, so a model that knows
// more species is never flattered or punished by being tested on a different set.
const byRightFirst = (a: Result, b: Result) => share(b.three.rightFirst, b.three.cases) - share(a.three.rightFirst, a.three.cases);
const isPhone = (r: Result) => CANDIDATES[r.meta.model]?.phone === true;
const phonePassing = results.filter((r) => r.passed && isPhone(r) && familyOf(r.meta.model) === APP_FAMILY).sort(byRightFirst);
const chosen = phonePassing.find((r) => r.meta.onnx);
const fullOnly = chosen ? undefined : phonePassing[0];
/** The best phone-sized model of another family — reported beside the choice; switching to it is changed by hand. */
const contender = results.filter((r) => isPhone(r) && familyOf(r.meta.model) !== APP_FAMILY)
  .sort((a, b) => Number(b.passed) - Number(a.passed) || byRightFirst(a, b))[0];
const allDanger = (m: Measures) => m.dangerKnown + m.dangerUnknown;

const lines: string[] = [];
lines.push('# The scan test', '');
lines.push(`Built ${new Date().toISOString().slice(0, 10)} by \`tools/evaluate-scan.ts\` from ${index.length} UK observations ` +
  `(${index.reduce((n, e) => n + e.files.length, 0)} photos) of our species — none of them the guide's own photos. ` +
  'Every choice (how photos are prepared, the thresholds) was made on half the observations (even numbers); every ' +
  'figure below is measured on the other half.', '');
lines.push(`**Pass mark (spec 6.3):** dangerous species on the shortlist at least ${PASS_MARK * 100} times in 100 when they are the answer. ` +
  `The file the phone runs (8-bit, or full size as a phone file) is scored through that file itself and must also lose at most ${MAX_FILE_LOSS * 100} point of "right first" against the same model run in PyTorch.`, '');
lines.push(`**Dangerous** here means the ${danger.size} species the app treats as dangerous: the ${onSafetyList} on the approved list's ` +
  `safety list (Deadly, or a dangerous lookalike of an edible) and ${danger.size - onSafetyList} more whose guide page says poisonous or ` +
  'deadly (the Fly Agaric, the White Fibrecap …) — the worse of the two levels, as the app decides it (src/scan/danger.ts). ' +
  'Until 07/10/2026 the test and the app\'s red banner counted only the safety list.', '');
lines.push(`**Two species lists.** ${Object.values(FAMILY_FILES).map((f) => f.label).join(' and ')} models know different species. ` +
  '"Right first", "on the shortlist" and "dangerous on the shortlist" are given twice: over the species the model knows (the ' +
  'pass mark uses this one, as the spec says) and over ALL our species with test photos, where a species the model cannot ' +
  'name counts as a miss — the fair way to compare the two lists.', '');

const samples = scoreFiles.filter(isSample);
if (samples.length > 0) {
  lines.push('## How photos are prepared', '');
  lines.push('Each model scored the same sample of the tuning half in each way; the best way is used for every figure below and in the app.', '');
  lines.push('| Model | Prepared as | Observations | Right first (1 photo) |', '|---|---|---|---|');
  for (const name of samples) {
    const { meta, cases, classes } = casesFor(name);
    const m = quickMeasure(cases, classes);
    lines.push(`| ${CANDIDATES[meta.model]?.label ?? meta.model}${fileKind(meta)} | ${prepared(meta)} | ${m.known} | ${pct(m.rightFirst, m.known)} |`);
  }
  lines.push('', 'squash = the whole photo scaled to a square; square = the centre square; timm = the centre 87.5% square (the models\' own evaluation crop).', '');
}

lines.push('## The candidates', '');
lines.push('Over the species each model knows (up to three photos unless said):', '');
lines.push('| Model | Size | Knows (of 300) | Prepared as | Right first (1 photo) | Right first | On the shortlist | Dangerous on the shortlist | False alarms | "Not sure" | Passes |');
lines.push('|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of results) {
  const c = CANDIDATES[r.meta.model];
  lines.push(`| ${label(r)} | ${c ? `${c.millions} M` : '?'} | ${r.known.size} | ${prepared(r.meta)} | ${pct(r.one.rightFirst, r.one.known)} | ` +
    `${pct(r.three.rightFirst, r.three.known)} | ${pct(r.three.onList, r.three.known)} | ` +
    `${pct(r.three.dangerOnList, r.three.dangerKnown)} (${r.three.dangerOnList}/${r.three.dangerKnown}) | ` +
    `${pct(r.three.falseAlarms, r.three.safeCases)} | ${pct(r.three.cases - r.three.sure, r.three.cases)} | ${r.passed ? 'yes' : 'no'} |`);
}
lines.push('', `Over ALL our species with test photos (${results[0]?.three.cases ?? 0} observations, ${results[0] ? allDanger(results[0].three) : 0} of them dangerous species; up to three photos):`, '');
lines.push('| Model | Right first | On the shortlist | Dangerous on the shortlist | Dangerous the model cannot name |', '|---|---|---|---|---|');
for (const r of [...results].sort(byRightFirst)) {
  lines.push(`| ${label(r)} | ${pct(r.three.rightFirst, r.three.cases)} | ${pct(r.three.onList, r.three.cases)} | ` +
    `${pct(r.three.dangerOnList, allDanger(r.three))} (${r.three.dangerOnList}/${allDanger(r.three)}) | ${r.three.dangerUnknown} |`);
}
lines.push('', 'Thresholds per model (from the tuning half): safety = the highest score at which a dangerous species is still added; ' +
  '"not sure" = the lowest top score above which the first answer is right 90 times in 100; off-season = the mark-down factor; ' +
  'group = the lowest score of a genus\'s species added up above which the group headline ("most likely a brittlegill") is right ' +
  '90 times in 100, with one photo and with three.', '');
for (const r of results) {
  lines.push(`- ${label(r)}: safety ${r.safetyFound ? r.t.safety : 'none reaches the pass mark'}, not sure ${r.t.notSure}, off-season ×${r.t.offSeason}, ` +
    `group ${r.t.group === NO_GROUP ? 'none reaches 90 in 100' : r.t.group}` +
    (r.loss === null ? '' : `; against the same model in PyTorch ${r.loss <= 0 ? 'no "right first" lost' : `${(r.loss * 100).toFixed(1)} points of "right first" lost`}`));
}
lines.push('', '## What the models know', '');
for (const family of Object.keys(FAMILY_FILES) as Family[]) {
  if (!results.some((r) => familyOf(r.meta.model) === family)) continue;
  const classes = classesOf(family);
  const known = knownBy(classes);
  lines.push(`**${FAMILY_FILES[family].label}** (${classes.length.toLocaleString('en-GB')} classes${family === APP_FAMILY ? ', the list the app runs today' : ''}): ` +
    `${known.size} of our ${ours.length} species. The ${ours.length - known.size} it cannot recognise:`, '');
  lines.push(ours.filter((s) => !known.has(s.name)).map((s) => `${english.get(s.name)} (*${s.name}*)${s.dangerLevel ? ` — **${s.dangerLevel}**` : ''}`).join(' · '), '');
  const viaOlder = classes.filter((c) => c.ours && c.ours !== c.name);
  lines.push(`${viaOlder.length} of its species carry an older name of one of ours (as iNaturalist files them), e.g. ` +
    viaOlder.slice(0, 3).map((c) => `*${c.name}* = ${english.get(c.ours as string)}`).join(', ') + '. ' +
    (viaOlder.some((c) => c.name === 'Amanita gemmata') ? 'One of them looks different: the Jewelled Amanita (*Amanita gemmata*) counts as the ' +
      'Fly Agaric, because iNaturalist files it there; on a scan it shows as the Fly Agaric, a poisonous Amanita.' : ''), '');
}
const show = [chosen ?? fullOnly ?? [...results].filter((r) => familyOf(r.meta.model) === APP_FAMILY).sort(byRightFirst)[0], contender]
  .filter((r): r is Result => r !== undefined);
if (show.length > 0) {
  lines.push(`## The group headline and "not sure"`, '');
  lines.push(`| | ${show.map((r) => `${label(r)}, 1 photo | ${label(r)}, up to 3`).join(' | ')} |`, `|---|${show.map(() => '---|---|').join('')}`);
  const row = (title: string, f: (m: Measures) => string) => lines.push(`| ${title} | ${show.map((r) => `${f(r.one)} | ${f(r.three)}`).join(' | ')} |`);
  row('Group headline shown', (m) => pct(m.groupShown, m.groupKnown));
  row('…right when shown', (m) => pct(m.groupRight, m.groupShown));
  row('"Not sure" shown', (m) => pct(m.notSureKnown, m.known));
  row('…right species still on the list', (m) => pct(m.onListNotSure, m.notSureKnown));
  lines.push('');
  lines.push(`## Dangerous species, one by one (up to three photos)`, '');
  lines.push(`| Species | Danger | ${show.map((r) => label(r)).join(' | ')} |`, `|---|---|${show.map(() => '---|').join('')}`);
  for (const sp of danger.keys()) {
    const cell = (r: Result) => {
      const d = r.perDanger.find((x) => x.species === sp)!;
      return d.caught === undefined ? `${d.onList}/${d.cases}` : `cannot name it (Check catches ${d.caught}/${d.cases})`;
    };
    lines.push(`| ${english.get(sp)} | ${danger.get(sp)} | ${show.map(cell).join(' | ')} |`);
  }
}
lines.push('', '## The choice', '');
lines.push(chosen
  ? `**${label(chosen)}** passes and is the best phone-sized model of the ${FAMILY_FILES[APP_FAMILY].label} list, the one the app runs. Its speed on Stefan's iPhone decides (spec 6.1): ` +
    'a three-photo scan in about 3 seconds.'
  : fullOnly
    ? `**${label(fullOnly)}** passes in PyTorch. It must now pass again as the file the phone will run.`
    : '**No phone-sized model passes.** The scan stays switched off (spec 6.3); everything else works.', '');
if (contender) {
  lines.push(`**Best ${FAMILY_FILES[familyOf(contender.meta.model)].label} model: ${label(contender)}** — ` +
    `${contender.passed ? 'passes' : 'does not pass'}; right first ${pct(contender.three.rightFirst, contender.three.cases)} of all our species ` +
    `(${chosen ? `${label(chosen)}: ${pct(chosen.three.rightFirst, chosen.three.cases)}` : 'no app model to compare'}). ` +
    'Moving the app to it is a decision for Stefan and needs app work (its own class list, names and phone file); this test never switches it by itself.', '');
}
writeFileSync(new URL('reports/scan-test.md', ROOT), lines.join('\n') + '\n');

const today = new Date().toISOString().slice(0, 10);
const settings = chosen ? {
  passed: true, model: chosen.meta.model, file: (chosen.meta.onnx as string).replace(/^public\//, ''),
  size: chosen.meta.size, norm: chosen.meta.norm, fit: fitOf(chosen.meta), thresholds: chosen.t,
  record: { rightFirst: share(chosen.three.rightFirst, chosen.three.known), onList: share(chosen.three.onList, chosen.three.known),
    dangerOnList: share(chosen.three.dangerOnList, chosen.three.dangerKnown), observations: chosen.three.cases,
    groupRight: share(chosen.three.groupRight, chosen.three.groupShown),
    onListNotSure: share(chosen.three.onListNotSure, chosen.three.notSureKnown) },
} : { passed: false, reason: fullOnly ? 'no phone file has passed yet' : 'no phone-sized model passes' };
// The app shows its one-time "how good is the scan" page again whenever `tested` changes (src/screens/scan.tsx), so a
// re-run that changes nothing he would see keeps the date it had.
const SETTINGS_FILE = new URL('content/model/scan-settings.json', ROOT);
const before = (() => { try { return JSON.parse(readFileSync(SETTINGS_FILE, 'utf8')) as { tested?: string }; } catch { return null; } })();
const unchanged = before !== null && JSON.stringify({ ...before, tested: undefined }) === JSON.stringify({ ...settings, tested: undefined });
const tested = unchanged && before?.tested ? before.tested : today;
writeFileSync(SETTINGS_FILE, JSON.stringify({ ...settings, tested }, null, 2) + '\n');
console.log(`reports/scan-test.md and content/model/scan-settings.json written${chosen ? ` (${label(chosen)} chosen)` : ''}` +
  (unchanged ? ` — settings unchanged, test date kept (${tested})` : ` — settings changed, test date ${tested}`));
