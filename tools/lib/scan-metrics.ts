import { combine, genusOf, shortlist, type ClassInfo, type Thresholds } from '../../src/scan/rules.ts';

export type Case = { obsId: number; species: string; month: number; photos: ArrayLike<number>[] };
export type Measures = {
  cases: number; known: number; rightFirst: number; onList: number;
  dangerKnown: number; dangerOnList: number; dangerUnknown: number; dangerCaughtByCheck: number;
  safeCases: number; falseAlarms: number; sure: number; rightWhenSure: number;
  /** The group headline over species the model knows: shown, and right when shown. */
  groupKnown: number; groupShown: number; groupRight: number;
  /** Scans of species the model knows that said "not sure", and of those, the right species still on the list. */
  notSureKnown: number; onListNotSure: number;
};
/** Safety thresholds tried, highest first. Never 0: a line of 0 adds every dangerous species to every scan — a red
 * banner on every photo, which teaches him to ignore it. A model that needs 0 to reach the pass mark does not pass. */
export const SAFETY_GRID = [0.5, 0.3, 0.2, 0.1, 0.05, 0.03, 0.02, 0.01, 0.005, 0.002, 0.001, 0.0005, 0.0002, 0.0001,
  0.00005, 0.00002, 0.00001, 0.000005, 0.000002, 0.000001];
export const NOT_SURE_GRID = [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
export const PASS_MARK = 0.98;
export const SURE_TARGET = 0.9;
/** Group lines tried, lowest first; the headline must be right as often as a "sure" first answer (90 in 100). */
export const GROUP_GRID = [0.3, 0.4, 0.5, 0.6, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95];
export const GROUP_TARGET = 0.9;

export const tuningHalf = (cases: Case[]) => cases.filter((c) => c.obsId % 2 === 0);
export const checkingHalf = (cases: Case[]) => cases.filter((c) => c.obsId % 2 === 1);

/** Spec 6.3 measured on `cases` with up to `photos` photos each; `lookalikes` = our pairs, both ways. */
export function measure(cases: Case[], classes: ClassInfo[], danger: Map<string, 'deadly' | 'poisonous'>,
  lookalikes: Map<string, string[]>, t: Thresholds, photos: 1 | 3): Measures {
  const knownSpecies = new Set(classes.filter((c) => c.ours).map((c) => c.ours as string));
  const genusOfSpecies = new Map<string, string>();
  for (const c of classes) if (c.ours && !genusOfSpecies.has(c.ours)) genusOfSpecies.set(c.ours, genusOf(c.name));
  const m: Measures = { cases: 0, known: 0, rightFirst: 0, onList: 0, dangerKnown: 0, dangerOnList: 0, dangerUnknown: 0,
    dangerCaughtByCheck: 0, safeCases: 0, falseAlarms: 0, sure: 0, rightWhenSure: 0, groupKnown: 0, groupShown: 0, groupRight: 0,
    notSureKnown: 0, onListNotSure: 0 };
  for (const c of cases) {
    const r = shortlist(combine(c.photos.slice(0, photos)), classes, c.month, t);
    const top = r.items[0]?.ours ?? null;
    const onList = r.items.some((i) => i.ours === c.species);
    m.cases++;
    if (!r.notSure) { m.sure++; if (top === c.species) m.rightWhenSure++; }
    if (danger.has(c.species)) {
      if (knownSpecies.has(c.species)) { m.dangerKnown++; if (onList) m.dangerOnList++; }
      else { m.dangerUnknown++; if (top && (lookalikes.get(top) ?? []).includes(c.species)) m.dangerCaughtByCheck++; }
    } else {
      m.safeCases++;
      if (r.items.some((i) => i.forSafety)) m.falseAlarms++;
    }
    if (!knownSpecies.has(c.species)) continue;
    m.known++;
    if (top === c.species) m.rightFirst++;
    if (onList) m.onList++;
    m.groupKnown++;
    if (r.group) { m.groupShown++; if (r.group.genus === genusOfSpecies.get(c.species)) m.groupRight++; }
    if (r.notSure) { m.notSureKnown++; if (onList) m.onListNotSure++; }
  }
  return m;
}

/** The highest safety threshold that keeps known dangerous species on the shortlist at least 98 in 100, or null. */
export function chooseSafety(cases: Case[], classes: ClassInfo[], danger: Map<string, 'deadly' | 'poisonous'>,
  lookalikes: Map<string, string[]>, base: Thresholds): number | null {
  for (const safety of SAFETY_GRID) {
    const m = measure(cases, classes, danger, lookalikes, { ...base, safety }, 3);
    if (m.dangerKnown > 0 && m.dangerOnList / m.dangerKnown >= PASS_MARK) return safety;
  }
  return null;
}

/** The lowest "not sure" threshold above which the first answer is right at least 90 in 100. */
export function chooseNotSure(cases: Case[], classes: ClassInfo[], danger: Map<string, 'deadly' | 'poisonous'>,
  lookalikes: Map<string, string[]>, base: Thresholds): number {
  for (const notSure of NOT_SURE_GRID) {
    const m = measure(cases, classes, danger, lookalikes, { ...base, notSure }, 3);
    if (m.sure > 0 && m.rightWhenSure / m.sure >= SURE_TARGET) return notSure;
  }
  return NOT_SURE_GRID.at(-1) as number;
}

/** The lowest group line above which the headline is right at least 90 in 100 — with one photo and with three, as the
 * app takes either — or null when none is. */
export function chooseGroup(cases: Case[], classes: ClassInfo[], danger: Map<string, 'deadly' | 'poisonous'>,
  lookalikes: Map<string, string[]>, base: Thresholds): number | null {
  for (const group of GROUP_GRID) {
    const ok = ([1, 3] as const).every((photos) => {
      const m = measure(cases, classes, danger, lookalikes, { ...base, group }, photos);
      return m.groupShown > 0 && m.groupRight / m.groupShown >= GROUP_TARGET;
    });
    if (ok) return group;
  }
  return null;
}
