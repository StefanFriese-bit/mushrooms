import { useState } from 'preact/hooks';
import { ALL_SPECIES } from '../content';
import { hrefFor } from '../router';
import { bySlug } from '../species';
import type { Answers, QuestionId } from '../identify';
import { ABOUT, checksFor, differences, standing, type Candidate, type Danger, type Placed } from '../scan/next-checks';
import type { ScanRow } from '../scan/rows';
import type { SpeciesRecord } from '../types';

// What to check next (src/scan/next-checks.ts), under the shortlist: the checks that tell its species apart — and,
// when the scan names a group ("most likely one of the brittlegills"), the guide's other species of that group — best
// first, each answer showing which species have it. A tap narrows the list at once; a tap on the same answer takes it
// back. A dangerous species stays whatever he answers. No word about eating anywhere on this card.
const DANGER_WORDS = { deadly: 'Deadly', poisonous: 'Poisonous' } as const;
const named = (c: Candidate) => c.s.english + (c.danger ? ` (${DANGER_WORDS[c.danger]})` : '');
const and = (words: string[]) => (words.length > 1 ? `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}` : words[0] ?? '');
const about = (ids: QuestionId[]) => and(ids.map((id) => ABOUT[id]));
/** Species that do not fit the same answers, together: one line per reason. */
function byReason(placed: Placed[]): Array<[string, Candidate[]]> {
  const m = new Map<string, Candidate[]>();
  for (const p of placed) m.set(about(p.against), [...(m.get(about(p.against)) ?? []), p.c]);
  return [...m.entries()];
}

/** Which species the checks cover: those on the list with a page, and the guide's others of the group the scan named. */
function covered(onList: number, extra: number, label: string | undefined): string {
  const list = onList === 0 ? '' : onList === 1 ? 'the one species on the list with a page in the guide'
    : `the ${onList} species on the list with a page in the guide`;
  const group = extra === 0 || !label ? '' : onList === 0 ? `the guide's ${label}, the group the scan named`
    : `the guide's other ${label} (the group the scan named)`;
  return [list, group].filter(Boolean).join(', and ');
}

function Name({ c }: { c: Candidate }) {
  return <>{c.s.english}{c.danger && <> <span class={`tag ${c.danger}`}>{DANGER_WORDS[c.danger]}</span></>}</>;
}

export function NextChecks({ rows, group, dangerOf }: {
  rows: ScanRow[];
  /** The guide's species in the group the scan named, and what the group is called ("brittlegills"). */
  group: { label: string; species: SpeciesRecord[] } | null;
  /** How dangerous a species is: the worse of the approved list's level and its page (src/scan/danger.ts). */
  dangerOf: (s: SpeciesRecord) => Danger;
}) {
  const [answers, setAnswers] = useState<Answers>({});
  const onList: Candidate[] = rows.flatMap((r) => {
    const s = r.slug ? bySlug(ALL_SPECIES, r.slug) : undefined;
    return s ? [{ s, danger: r.danger }] : [];
  });
  const extra: Candidate[] = (group?.species ?? [])
    .filter((s) => !onList.some((c) => c.s.slug === s.slug)).map((s) => ({ s, danger: dangerOf(s) }));
  const cands = [...onList, ...extra];
  if (cands.length < 2) return null;
  const uncovered = rows.filter((r) => !r.slug || !bySlug(ALL_SPECIES, r.slug)).map((r) => r.english);
  const checks = checksFor(cands);
  const st = standing(cands, answers);
  const still = [...st.fit, ...st.kept.map((p) => p.c)];
  const facts = differences(still);
  const answered = Object.keys(answers).length > 0;
  const pick = (id: QuestionId, value: string) => setAnswers((a) => {
    const next = { ...a };
    if (next[id] === value) delete next[id]; else next[id] = value;
    return next;
  });
  const only = answered && st.fit.length === 1 ? st.fit[0].s : null;
  return (
    <section class="next-checks" data-test="next-checks">
      <h2>What to check next</h2>
      <p>These checks tell apart {covered(onList.length, extra.length, group?.label)}. Tap what you see on your mushroom;
        skip what you cannot see. Dangerous species stay on the list whatever you answer: a ring can fall off, a bag can
        hide under the soil, and an answer can be wrong.</p>
      {uncovered.length > 0 && (
        <p class="note">Not in these checks, as the guide has no page for {uncovered.length === 1 ? 'it' : 'them'}:{' '}
          {and(uncovered)}. Treat {uncovered.length === 1 ? 'it' : 'them'} as unknown.</p>
      )}

      <div class="card still" aria-live="polite" data-test="still">
        {!answered && <p>Possible: {cands.map((c, i) => <span key={c.s.slug}>{i > 0 && ' · '}<Name c={c} /></span>)}</p>}
        {answered && st.fit.length > 0 && (
          <p data-test="still-fit"><strong>Fit your answers:</strong>{' '}
            {st.fit.map((c, i) => <span key={c.s.slug}>{i > 0 && ' · '}<Name c={c} /></span>)}</p>
        )}
        {answered && st.fit.length === 0 && (
          <p data-test="none-fit"><strong>None of the {st.kept.length > 0 ? 'other species' : 'species'} here fits your
            answers.</strong> It may be one the scan did not list: treat it as unknown, or <a
            href={hrefFor({ name: 'identify', query: '' })}>identify it by questions</a>.</p>
        )}
        {byReason(st.kept).map(([why, cs]) => (
          <p key={why} class="kept-line" data-test="still-kept">Kept on the list, though {cs.length === 1 ? 'it does' : 'they do'} not
            fit what you said about {why}: {cs.map((c, i) => <span key={c.s.slug}>{i > 0 && ' · '}<Name c={c} /></span>)}</p>
        ))}
        {byReason(st.out).map(([why, cs]) => (
          <p key={why} class="muted" data-test="ruled-out">Ruled out by what you said about {why}: {and(cs.map(named))}.</p>
        ))}
        {only && only.lookalikes.length > 0 && (
          <p><a class="big-button" href={hrefFor({ name: 'check', slug: only.slug })}>Check {only.english} against its lookalikes</a></p>
        )}
        {answered && <p><button type="button" class="small-button" onClick={() => setAnswers({})}>Clear my answers</button></p>}
      </div>

      {checks.length === 0 && <p>The questions cannot tell these apart: compare the details below, then use Check.</p>}
      {checks.map((ch) => (
        <div class="check-row" key={ch.question.id} data-test="next-check">
          <h3>{ch.question.title}</h3>
          <p class="note">{ch.question.hint}</p>
          {ch.options.map((o) => (
            <button type="button" class="pick" key={o.option.value} aria-pressed={answers[ch.question.id] === o.option.value}
              onClick={() => pick(ch.question.id, o.option.value)}>
              {o.option.label}<span class="who">{o.fit.map(named).join(', ')}</span>
            </button>
          ))}
        </div>
      ))}
      {checks.length > 0 && <p class="note">If what you see is none of these answers, it is none of these species: treat it
        as unknown.</p>}

      {facts.length > 0 && (
        // Open when there are few species to read about; with many it would bury the shortlist's end, so one tap opens it.
        <details class="compare" open={still.length <= 4} data-test="next-facts">
          <summary><strong>Also compare</strong>: {and(facts.map((d) => d.label.toLowerCase()))}</summary>
          <p class="note">Each species' own words, from its page in the guide{answered ? ', for the species still on the list' : ''}.</p>
          {facts.map((d) => (
            <div class="check-row" key={d.label} data-test="next-fact">
              <h3>{d.label}</h3>
              <ul class="fact-list">
                {d.words.map((w) => <li key={w.c.s.slug}><strong>{w.c.s.english}</strong>: {w.text}</li>)}
              </ul>
            </div>
          ))}
        </details>
      )}
    </section>
  );
}
