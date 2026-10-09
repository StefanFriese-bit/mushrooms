import { QUESTIONS, fits, type Answers, type Option, type Question, type QuestionId } from '../identify';
import type { SpeciesRecord } from '../types';

// What to check next, after a scan (Stefan 09/10/2026: a photo search on Google gives "a very good overview of
// possibilities and what I should check for next"). The species on the shortlist that have a page in the guide are
// compared feature by feature: Identify's own questions — `fits` stays the one rule for whether a species fits an
// answer — and the pages' own words for where each grows, its smell, flesh, cap width and spore print. It needs no
// signal and no paid service, and every word comes from the guide's pages. Two rules carried over from Identify: a
// question left unanswered never rules anything out, and a Deadly or Poisonous species is never dropped by an answer
// (a ring can fall off, a bag can hide under the soil, an answer can be wrong): it stays, with what does not fit.

export type Danger = 'deadly' | 'poisonous' | null;
/** A species on the shortlist with a page, and how dangerous the shortlist says it is. */
export type Candidate = { s: SpeciesRecord; danger: Danger };

const DANGER_RANK = { deadly: 0, poisonous: 1 } as const;
const dangerRank = (c: Candidate) => (c.danger ? DANGER_RANK[c.danger] : 2);
/** Deadly first, then Poisonous, then the rest — each group in the order the scan listed them. */
export const dangerFirst = (list: Candidate[]): Candidate[] =>
  list.map((c, i) => ({ c, i })).sort((a, b) => dangerRank(a.c) - dangerRank(b.c) || a.i - b.i).map((x) => x.c);

/** The checks done on the spot, in this order when two narrow the list as well as each other. */
const ON_THE_SPOT: QuestionId[] = ['underside', 'growsOn', 'ring', 'cap', 'bag'];
/** A spore print takes hours, so it is always offered last. */
const TAKES_HOURS: QuestionId = 'spore';

export type CheckOption = { option: Option; fit: Candidate[] };
/** One question that tells the candidates apart; `left` = how many are expected to still fit once it is answered. */
export type NextCheck = { question: Question; options: CheckOption[]; left: number };

/**
 * The questions whose answers tell these candidates apart (some answer fits some of them and not others), the one
 * expected to leave the fewest first; ties in the order a forager can check them; the spore print always last. Only
 * answers that at least one candidate fits are offered: an answer none fits means none of them is the mushroom.
 */
export function checksFor(candidates: Candidate[]): NextCheck[] {
  const cands = dangerFirst(candidates);
  const out: NextCheck[] = [];
  for (const question of QUESTIONS) {
    const options = question.options
      .map((option) => ({ option, fit: cands.filter((c) => fits(c.s, question.id, option.value)) }))
      .filter((o) => o.fit.length > 0);
    if (!options.some((o) => o.fit.length < cands.length)) continue;
    // If each candidate in turn were the real one: the most species any answer it fits would leave, on average.
    const left = cands.reduce((sum, c) => {
      const its = options.filter((o) => o.fit.includes(c)).map((o) => o.fit.length);
      return sum + (its.length ? Math.max(...its) : cands.length);
    }, 0) / cands.length;
    out.push({ question, options, left });
  }
  const order = (id: QuestionId) => (id === TAKES_HOURS ? ON_THE_SPOT.length : ON_THE_SPOT.indexOf(id));
  return out.sort((a, b) => Number(a.question.id === TAKES_HOURS) - Number(b.question.id === TAKES_HOURS)
    || a.left - b.left || order(a.question.id) - order(b.question.id));
}

/** A candidate and the questions whose answers it does not fit. */
export type Placed = { c: Candidate; against: QuestionId[] };
/** Fits every answer; dangerous and kept although an answer does not fit; ruled out by an answer. */
export type Standing = { fit: Candidate[]; kept: Placed[]; out: Placed[] };

export function standing(candidates: Candidate[], answers: Answers): Standing {
  const st: Standing = { fit: [], kept: [], out: [] };
  for (const c of dangerFirst(candidates)) {
    const against = QUESTIONS.map((q) => q.id).filter((q) => !fits(c.s, q, answers[q]));
    if (against.length === 0) st.fit.push(c);
    else if (c.danger) st.kept.push({ c, against });
    else st.out.push({ c, against });
  }
  return st;
}

/** What each question is about, as a few words for "does not fit: …". */
export const ABOUT: Record<QuestionId, string> = {
  underside: 'under the cap', growsOn: 'what it grows on', ring: 'the ring', bag: 'the bag at the base',
  cap: 'the cap width', spore: 'the spore print',
};

const capWords = (cm: [number, number] | null) => (cm ? `${cm[0]}–${cm[1]} cm` : 'No set size');
const FACTS: Array<{ label: string; text: (s: SpeciesRecord) => string }> = [
  { label: 'Where it grows', text: (s) => s.habitat.value },
  { label: 'Smell', text: (s) => s.features.smell.value },
  { label: 'Flesh', text: (s) => s.features.fleshChange.value },
  { label: 'Cap width', text: (s) => capWords(s.features.capCm.value) },
  { label: 'Spore print', text: (s) => s.sporePrint.value },
];
export type Difference = { label: string; words: Array<{ c: Candidate; text: string }> };
const same = (t: string) => t.trim().toLowerCase().replace(/[\s.;,]+$/, '').replace(/\s+/g, ' ');

/** The pages' own words on each fact, only where the candidates' words differ; quickest to check first. */
export function differences(candidates: Candidate[]): Difference[] {
  if (candidates.length < 2) return [];
  const cands = dangerFirst(candidates);
  return FACTS.map((f) => ({ label: f.label, words: cands.map((c) => ({ c, text: f.text(c.s).trim() })) }))
    .filter((d) => new Set(d.words.map((w) => same(w.text))).size > 1);
}
