import { ALL_SPECIES } from '../content';
import { combine, combineMax, type ClassInfo } from './rules';
import { withPageDanger } from './danger';
import { decode, loadEngine } from './engine';
import { SETTINGS } from './settings';

// From photos to scores (spec 6.2), the ONE way — Scan and Identify's photos both call it: the model on the phone scores
// each photo, the scores are averaged (rule 1), and with more photos than the scan's test measured, the safety rule
// also reads each photo on its own (combineMax), so a dangerous species any one photo could be stays on the list.

/** The scan's test measured up to three photos of a mushroom (tools/evaluate-scan.ts). */
export const TESTED_PHOTOS = 3;
/** Each page's edibility by scientific name: part of how dangerous a species is (src/scan/danger.ts). */
export const PAGE_EDIBILITY = new Map(ALL_SPECIES.map((s) => [s.scientific, s.edibility.value]));

export type Scored = {
  averaged: number[];
  /** Each class's best single photo, when there are more photos than the test measured; else undefined. */
  safety: number[] | undefined;
  /** The model's classes, each with the worse of the approved list's danger and its page's. */
  classes: ClassInfo[];
  count: number;
};

export async function scorePhotos(photos: Blob[], onStage: (stage: 'loading' | 'scanning') => void = () => {}): Promise<Scored> {
  const S = SETTINGS;
  if (!S.passed) throw new Error('the scan is off: it did not pass its test');
  onStage('loading');
  const engine = await loadEngine(S.file, S.size, S.fit);
  onStage('scanning');
  const scores: Float32Array[] = [];
  for (const f of photos) {
    const p = await decode(f);
    try { scores.push(await engine.score(p)); } finally { URL.revokeObjectURL(p.url); }
  }
  const classes = withPageDanger((await import('../../content/model/df20-classes.json')).default.classes as ClassInfo[], PAGE_EDIBILITY);
  return { averaged: combine(scores), safety: scores.length > TESTED_PHOTOS ? combineMax(scores) : undefined, classes, count: scores.length };
}
