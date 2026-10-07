import { readFileSync } from 'node:fs';
import type { ClassInfo } from '../src/scan/rules.ts';
import type { CoreLists } from './lib/core-lists.ts';
import { SAFETY_GRID, checkingHalf, measure, tuningHalf } from './lib/scan-metrics.ts';
import { pageEdibility, readScoreCases, type TestEntry } from './lib/scan-scores.ts';
import { dangerousSpecies, withPageDanger } from '../src/scan/danger.ts';

// For one score file: every safety line of the grid, measured on both halves — how many dangerous species stay on the
// shortlist (of those the model knows; of all) and how many safe scans get the red banner. The other thresholds are the
// ones evaluate-scan chose for that model (passed in). Usage: tsx tools/safety-curve.ts <score name> <classes file> <notSure> <offSeason> <group>
const ROOT = new URL('../', import.meta.url);
const read = <T>(rel: string): T => JSON.parse(readFileSync(new URL(rel, ROOT), 'utf8')) as T;
const [name, classFile, notSure, offSeason, group] = process.argv.slice(2);
const PAGES = pageEdibility(ROOT);
const classes = withPageDanger(read<{ classes: ClassInfo[] }>(classFile).classes, PAGES); // as the app (src/scan/danger.ts)
const index = read<TestEntry[]>('cache/test-photos/index.json');
const ours = read<{ species: Array<{ name: string; dangerLevel: 'deadly' | 'poisonous' | null }> }>('content/species-list.json').species;
const danger = dangerousSpecies(ours, PAGES);
const lookalikes = new Map<string, string[]>();
for (const p of read<CoreLists>('tools/config/core-lists.json').pairs) {
  lookalikes.set(p.edible, [...(lookalikes.get(p.edible) ?? []), p.dangerous]);
  lookalikes.set(p.dangerous, [...(lookalikes.get(p.dangerous) ?? []), p.edible]);
}
const { cases } = readScoreCases(ROOT, name, classes.length, index);
const pc = (n: number, d: number) => (d ? `${(100 * n / d).toFixed(1)}%` : '–');
console.log('safety line | tuning: dangerous on list (known) | checking: known | checking: all | checking: red banner on safe scans');
for (const safety of SAFETY_GRID) {
  const t = { safety, notSure: Number(notSure), offSeason: Number(offSeason), group: Number(group) };
  const a = measure(tuningHalf(cases), classes, danger, lookalikes, t, 3);
  const b = measure(checkingHalf(cases), classes, danger, lookalikes, t, 3);
  console.log(`${safety} | ${pc(a.dangerOnList, a.dangerKnown)} | ${pc(b.dangerOnList, b.dangerKnown)} (${b.dangerOnList}/${b.dangerKnown}) | ` +
    `${pc(b.dangerOnList, b.dangerKnown + b.dangerUnknown)} | ${pc(b.falseAlarms, b.safeCases)}`);
}
