import type { ScanResult } from './rules';
import { dangerOfPage, worse } from './danger';
import type { Edibility } from '../types';

// What the Scan screen shows for each species on the shortlist (spec 6.2): the English name — ours, or for a species
// the guide does not cover the British Mycological Society's or iNaturalist's (content/model/df20-names.json) — or the
// scientific name when it has none, its page in the guide when there is one, its danger — the higher of the approved list's level
// and its page's edibility — and why it is there. No percentages and no word about eating.
export type Danger = 'deadly' | 'poisonous' | null;
export type ScanRow = {
  english: string;
  scientific: string;
  slug: string | null; // its page in the guide
  inList: boolean; // one of our 300 (false = a species the model knows that the guide does not cover)
  danger: Danger;
  forSafety: boolean; // added because it is dangerous, not for its score
};
export type Page = { slug: string; edibility: Edibility };


export function scanRows(r: ScanResult, english: Map<string, string>, pages: Map<string, Page>): ScanRow[] {
  const rows = r.items.map((i) => {
    if (!i.ours) return { english: english.get(i.name) ?? i.name, scientific: i.name, slug: null, inList: false, danger: null, forSafety: i.forSafety };
    const page = pages.get(i.ours);
    return {
      english: english.get(i.ours) ?? i.ours, scientific: i.ours, slug: page?.slug ?? null, inList: true,
      danger: worse(i.danger, dangerOfPage(page?.edibility)), forSafety: i.forSafety,
    };
  });
  // iNaturalist files a few of the model's species as one (both Russula undulata and R. depallens are its Purple
  // Brittlegill): a species the guide does not cover is listed once under its English name.
  const seen = new Set<string>();
  return rows.filter((row) => row.inList || row.english === row.scientific || !seen.has(row.english) && !!seen.add(row.english));
}

/** The measured record, in words (rule 7), from the settings the test wrote — never typed by hand. */
export function recordWords(rec: { rightFirst: number; onList: number; dangerOnList: number; observations: number }): string {
  const pc = (x: number) => `${Math.round(x * 1000) / 10}%`;
  return `Tested on ${rec.observations.toLocaleString('en-GB')} UK finds it had never seen: the first name was right ${pc(rec.rightFirst)} ` +
    `of the time, the right species was on the list ${pc(rec.onList)}, and a dangerous species was on the list ${pc(rec.dangerOnList)} ` +
    'of the times it was the answer.';
}
