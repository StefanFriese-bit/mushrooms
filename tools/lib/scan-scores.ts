import { readFileSync } from 'node:fs';
import type { Case } from './scan-metrics.ts';

/** One test observation (cache/test-photos/index.json): our species, its photos (up to three) and the month seen. */
export type TestEntry = { species: string; inatId: number; obsId: number; month: number; files: string[] };
/** What tools/scan-test/score.py wrote beside a score file. */
export type ScoreMeta = { model: string; size: number; norm: string; fit?: string; onnx?: string | null; classes: number; files: string[] };

/**
 * A model's scores (cache/scores/<name>.f32: photos × classes, float32) turned into one Case per test observation whose
 * photos were all scored. `classCount` is the length of the class list the scores are read against — a mismatch means the
 * scores belong to another species list, and every name would be wrong, so it stops.
 */
export function readScoreCases(root: URL, name: string, classCount: number, index: TestEntry[]): { meta: ScoreMeta; cases: Case[] } {
  const meta = JSON.parse(readFileSync(new URL(`cache/scores/${name}.json`, root), 'utf8')) as ScoreMeta;
  const bytes = readFileSync(new URL(`cache/scores/${name}.f32`, root));
  const data = new Float32Array(new Uint8Array(bytes).buffer);
  if (data.length !== meta.files.length * meta.classes) throw new Error(`${name}: scores do not fit ${meta.files.length} photos`);
  if (meta.classes !== classCount) throw new Error(`${name}: ${meta.classes} classes, the class list has ${classCount}`);
  const row = new Map(meta.files.map((f, i) => [f, i]));
  const cases: Case[] = [];
  for (const e of index) {
    if (!e.files.every((f) => row.has(f))) continue;
    cases.push({ obsId: e.obsId, species: e.species, month: e.month,
      photos: e.files.map((f) => data.subarray(row.get(f)! * meta.classes, (row.get(f)! + 1) * meta.classes)) });
  }
  return { meta, cases };
}
