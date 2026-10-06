import { describe, expect, it } from 'vitest';
import { checkingHalf, chooseNotSure, chooseSafety, measure, tuningHalf, type Case } from '../tools/lib/scan-metrics.ts';
import type { ClassInfo } from '../src/scan/rules.ts';

const ALL_YEAR = Array(12).fill(5);
const names = ['A', 'B', 'C', 'E', 'F', 'G', 'H', 'D'];
const classes: ClassInfo[] = [
  ...names.map((n, id): ClassInfo => ({ id, name: n, ours: n, danger: n === 'D' ? 'deadly' : null, uk: true, months: ALL_YEAR })),
  { id: 8, name: 'Elsewhere', ours: null, danger: null, uk: false, months: Array(12).fill(0) },
];
const danger = new Map<string, 'deadly' | 'poisonous'>([['D', 'deadly'], ['U', 'deadly']]);
const lookalikes = new Map<string, string[]>([['A', ['D', 'U']], ['D', ['A']], ['U', ['A']]]);
const T = { safety: 0.05, notSure: 0.05, offSeason: 0.5 };
/** Scores over the nine classes from a {name: score} map. */
const sc = (m: Record<string, number>) => [...names, 'Elsewhere'].map((n) => m[n] ?? 0);
const kase = (obsId: number, species: string, m: Record<string, number>): Case => ({ obsId, species, month: 10, photos: [sc(m)] });

const rightA = kase(2, 'A', { A: 0.9, B: 0.05 });
const wrongB = kase(4, 'B', { C: 0.3, B: 0.25, A: 0.1 });
const deadlyLow = kase(6, 'D', { A: 0.3, B: 0.2, C: 0.15, E: 0.1, F: 0.08, G: 0.07, H: 0.06, D: 0.03 });
const unknownDeadly = kase(8, 'U', { A: 0.6, B: 0.2 });
const alarm = kase(10, 'B', { B: 0.5, A: 0.2, C: 0.1, E: 0.09, F: 0.08, G: 0.07, D: 0.06 }); // D is 7th: added for safety only

describe('measure', () => {
  const m = measure([rightA, wrongB, deadlyLow, unknownDeadly, alarm], classes, danger, lookalikes, T, 1);
  it('counts right first and on the shortlist over species the model knows', () => {
    expect(m).toMatchObject({ cases: 5, known: 4, rightFirst: 2, onList: 3 });
  });
  it('counts a dangerous species only when it is on the list, added for safety or not', () => {
    expect(m).toMatchObject({ dangerKnown: 1, dangerOnList: 0 });
    const lower = measure([deadlyLow], classes, danger, lookalikes, { ...T, safety: 0.02 }, 1);
    expect(lower).toMatchObject({ dangerKnown: 1, dangerOnList: 1 });
  });
  it('counts an unknown dangerous species as caught when it is a lookalike of the top match', () => {
    expect(m).toMatchObject({ dangerUnknown: 1, dangerCaughtByCheck: 1 });
  });
  it('counts a false alarm when a dangerous species is added to a harmless photo', () => {
    expect(m).toMatchObject({ safeCases: 3, falseAlarms: 1 });
  });
});

describe('the thresholds', () => {
  it('takes the highest safety threshold that keeps dangerous species on the list, or none', () => {
    expect(chooseSafety([deadlyLow], classes, danger, lookalikes, T)).toBe(0.03);
    expect(chooseSafety([kase(12, 'D', { A: 0.9 })], classes, danger, lookalikes, T)).toBeNull();
  });
  it('takes the lowest not-sure threshold above which the first answer is right 90 in 100', () => {
    expect(chooseNotSure([rightA, wrongB], classes, danger, lookalikes, T)).toBe(0.35);
  });
  it('splits observations into a tuning and a checking half by number', () => {
    const all = [rightA, kase(3, 'A', { A: 1 })];
    expect(tuningHalf(all).map((c) => c.obsId)).toEqual([2]);
    expect(checkingHalf(all).map((c) => c.obsId)).toEqual([3]);
  });
});
