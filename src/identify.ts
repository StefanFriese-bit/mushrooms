import type { LookalikeKind, SpeciesRecord } from './types';
import { sporeGroups, type SporeGroup } from './spore';

// Identify (spec 8): simple questions one at a time; the list narrows; "Not sure" is always allowed and never
// narrows. A Deadly or Poisonous lookalike of a species that still fits is never dropped by an answer: rings fall
// off and the Deathcap's bag hides under the soil, so a wrong "no" must not quietly remove it. Nothing here says
// anything about eating: only the danger of a species is shown.
export type QuestionId = 'underside' | 'growsOn' | 'ring' | 'bag' | 'cap' | 'spore';
export type Option = { value: string; label: string; drawing: string };
export type Question = { id: QuestionId; title: string; hint: string; options: Option[]; unsureLabel: string };
export type Answers = Partial<Record<QuestionId, string>>;
/** The answer "Not sure": recorded, so the next question comes, but it never narrows the list. */
export const UNSURE = 'unsure';

export const QUESTIONS: Question[] = [
  {
    id: 'underside', title: 'What is under the cap?',
    hint: 'Look at the underside: thin blades, a sponge, spines, or blunt folds that run down the stem.',
    unsureLabel: 'Not sure',
    options: [
      { value: 'gills', label: 'Gills (thin blades)', drawing: 'gills' },
      { value: 'pores', label: 'Pores (a sponge)', drawing: 'pores' },
      { value: 'teeth', label: 'Teeth (spines)', drawing: 'teeth' },
      { value: 'ridges', label: 'Ridges (blunt, forked folds)', drawing: 'ridges' },
      { value: 'smooth', label: 'Smooth', drawing: 'smooth' },
      { value: 'other', label: 'Something else (no cap: a ball, a cup, a crust)', drawing: 'other' },
    ],
  },
  {
    id: 'growsOn', title: 'What is it growing on?',
    hint: 'If it might be growing from buried wood or roots, choose Not sure.',
    unsureLabel: 'Not sure',
    options: [
      { value: 'ground', label: 'The ground (soil, grass, leaves)', drawing: 'ground' },
      { value: 'wood', label: 'Wood (a tree, stump, log or branch)', drawing: 'wood' },
      { value: 'other-fungi', label: 'Another mushroom', drawing: 'other-fungi' },
      { value: 'dung', label: 'Dung', drawing: 'dung' },
    ],
  },
  {
    id: 'ring', title: 'Is there a ring on the stem?',
    hint: 'A ring is a skirt of tissue around the stem. Rings can fall off or be washed away: if there might have been one, choose Not sure.',
    unsureLabel: 'Not sure',
    options: [
      { value: 'yes', label: 'Yes, a ring', drawing: 'ring' },
      { value: 'no', label: 'No ring, and no trace of one', drawing: 'no-ring' },
    ],
  },
  {
    id: 'bag', title: 'Is there a bag at the base of the stem?',
    hint: 'Deadly Amanitas hide a cup-like bag under the soil. Dig gently around the base to see it; never cut the stem.',
    unsureLabel: 'Not sure: I did not dig out the base',
    options: [
      { value: 'yes', label: 'Yes, a bag or cup', drawing: 'bag' },
      { value: 'no', label: 'No bag: I dug out the whole base', drawing: 'no-bag' },
    ],
  },
  {
    id: 'cap', title: 'How wide is the cap?', hint: 'Across the top, at its widest.', unsureLabel: 'Not sure',
    options: [
      { value: 'small', label: 'Under 5 cm', drawing: 'cap-small' },
      { value: 'medium', label: '5 to 10 cm', drawing: 'cap-medium' },
      { value: 'large', label: 'Over 10 cm', drawing: 'cap-large' },
    ],
  },
  {
    id: 'spore', title: 'What colour is its spore print?',
    hint: 'Leave the cap gills-down on white and dark paper for a few hours (see Learn).',
    unsureLabel: 'I have not made one',
    options: [
      { value: 'white', label: 'White, cream or pale yellow', drawing: 'spore-white' },
      { value: 'pink', label: 'Pink', drawing: 'spore-pink' },
      { value: 'brown', label: 'Brown (rusty, ochre)', drawing: 'spore-brown' },
      { value: 'dark', label: 'Dark (chocolate, purple-brown, black)', drawing: 'spore-dark' },
    ],
  },
];

const BANDS: Record<string, [number, number]> = { small: [0, 5], medium: [5, 10], large: [10, Infinity] };

/** Does one species fit one answer? "Not sure" and no answer always fit. */
export function fits(s: SpeciesRecord, q: QuestionId, answer: string | undefined): boolean {
  if (answer === undefined || answer === UNSURE) return true;
  const f = s.features;
  switch (q) {
    case 'underside': return f.underside.value === answer;
    case 'growsOn': return f.growsOn.value === answer;
    case 'ring': return f.ring.value === answer || f.ring.value === 'sometimes';
    case 'bag': return f.bagAtBase.value === answer;
    case 'cap': {
      if (!f.capCm.value) return true; // a crust with no set size fits any size
      const [lo, hi] = BANDS[answer] ?? [0, Infinity];
      const [a, b] = f.capCm.value;
      return a <= hi && b >= lo;
    }
    case 'spore': return sporeGroups(s.sporePrint.value).includes(answer as SporeGroup);
  }
}

export type Listed = {
  slug: string | null; english: string; scientific: string; danger: 'deadly' | 'poisonous' | null;
  differsOn?: QuestionId; keptFor?: string[];
};
export type Narrowed = { matches: Listed[]; kept: Listed[]; nearMisses: Listed[] };

const dangerOf = (e: string): Listed['danger'] => (e === 'deadly' ? 'deadly' : e === 'poisonous' ? 'poisonous' : null);
const DANGEROUS: LookalikeKind[] = ['deadly', 'poisonous'];

/** The species that fit every answer; every dangerous lookalike of those, kept; and the near misses (all but one). */
export function narrow(all: SpeciesRecord[], answers: Answers): Narrowed {
  const listed = (s: SpeciesRecord): Listed =>
    ({ slug: s.slug, english: s.english, scientific: s.scientific, danger: dangerOf(s.edibility.value) });
  const matches: Listed[] = [];
  const nearMisses: Listed[] = [];
  const matched: SpeciesRecord[] = [];
  for (const s of all) {
    const wrong = QUESTIONS.map((q) => q.id).filter((q) => !fits(s, q, answers[q]));
    if (wrong.length === 0) { matches.push(listed(s)); matched.push(s); }
    else if (wrong.length === 1) nearMisses.push({ ...listed(s), differsOn: wrong[0] });
  }
  const kept = new Map<string, Listed>();
  for (const s of matched) {
    for (const l of s.lookalikes) {
      if (!DANGEROUS.includes(l.kind) || matches.some((m) => m.scientific === l.scientific)) continue;
      const page = l.slug ? all.find((x) => x.slug === l.slug) : undefined;
      const k = kept.get(l.scientific) ?? { slug: page ? page.slug : null, english: l.english, scientific: l.scientific,
        danger: l.kind as 'deadly' | 'poisonous', keptFor: [] };
      k.keptFor!.push(s.english);
      kept.set(l.scientific, k);
    }
  }
  return { matches, kept: [...kept.values()], nearMisses: nearMisses.filter((n) => !kept.has(n.scientific)) };
}

/** The answers in the address (`#/identify?underside=gills&ring=unsure`); anything unknown is dropped. */
export function answersFromQuery(qs: URLSearchParams): Answers {
  const out: Answers = {};
  for (const q of QUESTIONS) {
    const v = qs.get(q.id);
    if (v && (v === UNSURE || q.options.some((o) => o.value === v))) out[q.id] = v;
  }
  return out;
}

export function queryFromAnswers(a: Answers): string {
  return new URLSearchParams(QUESTIONS.filter((q) => a[q.id]).map((q) => [q.id, a[q.id] as string])).toString();
}

/** The first question not answered yet, or null when all are. */
export const nextQuestion = (a: Answers): Question | null => QUESTIONS.find((q) => a[q.id] === undefined) ?? null;
