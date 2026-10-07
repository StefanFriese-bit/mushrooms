import type { ClassInfo, Danger } from './rules';
import type { Edibility } from '../types';

// How dangerous a species is, everywhere the scan needs it — the red banner, the safety rule that keeps a dangerous
// species on the shortlist, the shortlist rows, and the scan test that measures all of them: the worse of the approved
// list's level and its page's edibility. Until 07/10/2026 the banner and the safety rule read the approved list only (28
// species), while the rows also read the pages; batch 2's pages made 28 more species poisonous or deadly (White
// Fibrecap, Fly Agaric, Sulphur Tuft …), which then showed a red tag but never the banner, and were never kept on the list.

export const worse = (a: Danger, b: Danger): Danger => (a === 'deadly' || b === 'deadly' ? 'deadly' : a ?? b);
export const dangerOfPage = (e: Edibility | undefined): Danger => (e === 'deadly' ? 'deadly' : e === 'poisonous' ? 'poisonous' : null);

/** The model's classes, each of ours carrying the worse of its two levels. `pageEdibility`: scientific name → edibility. */
export function withPageDanger(classes: ClassInfo[], pageEdibility: Map<string, Edibility>): ClassInfo[] {
  return classes.map((c) => (c.ours ? { ...c, danger: worse(c.danger, dangerOfPage(pageEdibility.get(c.ours))) } : c));
}

/** Our dangerous species and their level: the approved list's, made worse by the page's. */
export function dangerousSpecies(list: Array<{ name: string; dangerLevel: Danger }>, pageEdibility: Map<string, Edibility>):
  Map<string, 'deadly' | 'poisonous'> {
  const out = new Map<string, 'deadly' | 'poisonous'>();
  for (const s of list) {
    const level = worse(s.dangerLevel, dangerOfPage(pageEdibility.get(s.name)));
    if (level) out.set(s.name, level);
  }
  return out;
}
