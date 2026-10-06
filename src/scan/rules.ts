export type Danger = 'deadly' | 'poisonous' | null;
export type ClassInfo = { id: number; name: string; ours: string | null; danger: Danger; uk: boolean; months: number[] };
export type Thresholds = { safety: number; notSure: number; offSeason: number; group: number };
export type ShortlistItem = { id: number; name: string; ours: string | null; danger: Danger; score: number; forSafety: boolean };
/** The genus whose UK species together score highest, named when it reaches the group line ("most likely a brittlegill"). */
export type Group = { genus: string; score: number };
export type ScanResult = { items: ShortlistItem[]; notSure: boolean; dangerous: boolean; group: Group | null };

export const SHORTLIST = 5;

/** Rule 1: the scores of up to three photos are averaged. */
export function combine(photos: ArrayLike<number>[]): number[] {
  if (photos.length === 0) throw new Error('combine needs at least one photo');
  const n = photos[0].length;
  const out = new Array<number>(n).fill(0);
  for (const p of photos) {
    if (p.length !== n) throw new Error('the photos were scored by different models');
    for (let i = 0; i < n; i++) out[i] += p[i] / photos.length;
  }
  return out;
}

/** Out of season = no UK records in that month or in the months either side (January follows December). */
export function outOfSeason(months: number[], month: number): boolean {
  const at = (m: number) => months[(m - 1 + 12) % 12] ?? 0;
  return at(month - 1) + at(month) + at(month + 1) === 0;
}

/** The genus of a class: the first word of the model's own name for it. */
export const genusOf = (name: string): string => name.split(' ')[0];

/**
 * Rules 2–6 of spec 6.2. Species never recorded in the UK are removed; out of season, marked down; classes that are
 * the same species of ours are added up; the top five are the shortlist; a Poisonous or Deadly species whose score
 * BEFORE the season mark-down is at or above the safety threshold is added however low it ranks; below the "not sure"
 * threshold the scan says so. Its species added up by genus give the group headline, at or above the group line. All
 * the thresholds come from the test, never by hand.
 */
export function shortlist(scores: ArrayLike<number>, classes: ClassInfo[], month: number, t: Thresholds): ScanResult {
  if (scores.length !== classes.length) throw new Error(`scores for ${scores.length} classes, the class list has ${classes.length}`);
  type Entry = { first: ClassInfo; score: number; raw: number };
  const bySpecies = new Map<string, Entry>();
  const byGenus = new Map<string, number>();
  classes.forEach((c, i) => {
    if (!c.uk) return;
    const raw = scores[i];
    const score = outOfSeason(c.months, month) ? raw * t.offSeason : raw;
    byGenus.set(genusOf(c.name), (byGenus.get(genusOf(c.name)) ?? 0) + score);
    const key = c.ours ?? `class ${c.id}`;
    const e = bySpecies.get(key);
    if (e) { e.score += score; e.raw += raw; } else bySpecies.set(key, { first: c, score, raw });
  });
  const ranked = [...bySpecies.values()].filter((e) => e.score > 0).sort((a, b) => b.score - a.score);
  const item = (e: Entry, forSafety: boolean): ShortlistItem =>
    ({ id: e.first.id, name: e.first.name, ours: e.first.ours, danger: e.first.danger, score: e.score, forSafety });
  const items = ranked.slice(0, SHORTLIST).map((e) => item(e, false));
  for (const e of ranked.slice(SHORTLIST)) if (e.first.danger && e.raw >= t.safety) items.push(item(e, true));
  const [genus, mass] = [...byGenus.entries()].reduce((a, b) => (b[1] > a[1] ? b : a), ['', 0]);
  const group = genus && mass >= t.group ? { genus, score: mass } : null;
  return { items, notSure: (items[0]?.score ?? 0) < t.notSure, dangerous: items.some((i) => i.danger !== null), group };
}
