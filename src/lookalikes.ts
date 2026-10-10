import type { Lookalike, SpeciesRecord } from './types';

// The lookalike screen (Stefan 10/10/2026, after his own spreadsheet: "it'll give me the first one and say these are
// the points to look out for … very clear pointers … in the forest with dirt on their hands in the rain"): a species'
// lookalikes one at a time, the dangerous ones first, each with the page's own tell-apart facts (two trusted sites each)
// in the order a forager checks them. Pure: what to show and in which order; src/screens/lookalikes.tsx draws it.
const DANGER_RANK: Record<Lookalike['kind'], number> = { deadly: 0, poisonous: 1, 'not-edible': 2, edible: 3 };

/** The lookalikes in the order they are shown: Deadly, then Poisonous, then the rest, each group as the page lists it. */
export const orderedLookalikes = (s: SpeciesRecord): Lookalike[] =>
  s.lookalikes.map((l, i) => ({ l, i })).sort((a, b) => DANGER_RANK[a.l.kind] - DANGER_RANK[b.l.kind] || a.i - b.i).map((x) => x.l);

export const isDangerous = (kind: string) => kind === 'deadly' || kind === 'poisonous';

/** What the screen is called for this species: for an edible one, its dangerous lookalikes; for a dangerous one, what
 * it is mistaken for. */
export function lookalikeTitle(s: SpeciesRecord): string {
  if (isDangerous(s.edibility.value)) return 'Mistaken for';
  return s.lookalikes.some((l) => isDangerous(l.kind)) ? 'Poisonous lookalikes' : 'Lookalikes';
}

/** The order the tell-apart facts are shown in — the checks that settle it fastest first: a ring, the bag at the base,
 * under the cap, the spore print, the stem, the flesh, the smell, the cap, where it grows, its size, its season. */
const FEATURE_ORDER: Array<[RegExp, number]> = [
  [/\bring\b/i, 0], [/\bbag\b|volva|stem base|\bbase\b/i, 1], [/gill|\bpores?\b|underneath|spine|tooth|teeth|tube/i, 2],
  [/spore/i, 3], [/\bstem\b/i, 4], [/flesh|\bcut\b|bruis|milk|inside|blacken|stain/i, 5], [/smell|odou?r/i, 6],
  [/\bcap\b|colou?r|surface|skin|shape|edge|feel|patch/i, 7], [/grow|tree|wood|habitat|where/i, 8], [/size/i, 9],
  [/season|month/i, 10],
];
export const featureRank = (feature: string) => FEATURE_ORDER.find(([re]) => re.test(feature))?.[1] ?? 11;

/** One pair's tell-apart facts in that order (a stable sort: two of the same kind keep the page's order). */
export const apartRows = (l: Lookalike) =>
  l.tellApart.map((r, i) => ({ r, i })).sort((a, b) => featureRank(a.r.feature) - featureRank(b.r.feature) || a.i - b.i).map((x) => x.r);
