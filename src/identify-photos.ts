import type { Listed, Narrowed } from './identify';
import { SHORTLIST, type Danger, type SpeciesScore, type Thresholds } from './scan/rules';

// Identify, then photos (Stefan 10/10/2026: "at the end of the identifier section someone could add photos of the item
// that they've taken and that could narrow down the search results of what they might be looking at"). The photos are
// scored into species exactly as for the Scan's own shortlist (src/scan/rules.ts speciesScores), and the species that
// fit his answers are put in that order: the five most like his photos first, the rest folded away.
//
// What it never does — the same rules as Identify and the Scan — is hide a dangerous species. One that fits his answers
// or is kept as a lookalike stays in sight whatever the photos say. One the photos could be (the scan's safety line) is
// shown although his answers ruled it out, since an answer can be wrong. And a species the scan cannot recognise is
// listed apart, never ranked low: the photos say nothing about it either way.

export type Ranked = Listed & { score: number };
/** A dangerous species the photos could be although his answers ruled it out: the model's name, ours when the guide has it. */
export type PhotoWarning = { name: string; ours: string | null; danger: Exclude<Danger, null> };
export type ByPhotos = {
  /** Fit every answer, the scan recognises them: the five most like the photos, best first. */
  top: Ranked[];
  /** The others that fit every answer, are not dangerous and the scan recognises, in the same order. */
  rest: Ranked[];
  /** Dangerous, fit every answer or kept as a lookalike, and not in `top`: in sight whatever the photos say. */
  dangerous: Listed[];
  /** Fit every answer, but the scan cannot recognise them, so the photos say nothing about them. */
  unknown: Listed[];
  /** Dangerous species the photos could be although the answers ruled them out, the likeliest first. */
  warnings: PhotoWarning[];
  /** The best of them is under the scan's "not sure" line: the photos do not point clearly to any of them. */
  notSure: boolean;
};

export function byPhotos(n: Narrowed, scores: Map<string, SpeciesScore>, t: Thresholds): ByPhotos {
  const ranked = n.matches
    .filter((m) => scores.has(m.scientific))
    .map((m, i) => ({ m: { ...m, score: scores.get(m.scientific)!.score }, i }))
    .sort((a, b) => b.m.score - a.m.score || a.i - b.i)
    .map((x) => x.m);
  const top = ranked.slice(0, SHORTLIST);
  const below = ranked.slice(SHORTLIST);
  const onTheList = new Set([...n.matches, ...n.kept].map((l) => l.scientific));
  const warnings = [...scores.entries()]
    .filter(([key, e]) => e.first.danger && e.safe >= t.safety && !onTheList.has(e.first.ours ?? key))
    .sort((a, b) => b[1].safe - a[1].safe)
    .map(([, e]) => ({ name: e.first.name, ours: e.first.ours, danger: e.first.danger as Exclude<Danger, null> }));
  return {
    top,
    rest: below.filter((m) => !m.danger),
    dangerous: [...below.filter((m) => m.danger), ...n.kept],
    unknown: n.matches.filter((m) => !scores.has(m.scientific)),
    warnings,
    notSure: top.length === 0 || top[0].score < t.notSure,
  };
}
