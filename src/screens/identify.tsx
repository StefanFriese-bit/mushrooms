import { ALL_SPECIES, photoUrl } from '../content';
import { hrefFor } from '../router';
import { bySlug } from '../species';
import {
  QUESTIONS, UNSURE, answersFromQuery, narrow, nextQuestion, queryFromAnswers, type Answers, type Listed, type Question,
} from '../identify';
import { Drawing } from './drawings';

// Identify (spec 8): one question at a time, the list narrowing; the answers live in the address, so Back and a
// reload keep them. No word about eating anywhere on this screen: only the danger tags.
const link = (a: Answers, show = false) => {
  const q = queryFromAnswers(a);
  return hrefFor({ name: 'identify', query: show ? (q ? `${q}&show=1` : 'show=1') : q });
};
const said = (q: Question, v: string) => (v === UNSURE ? q.unsureLabel : q.options.find((o) => o.value === v)?.label ?? v);
const DANGER_WORDS = { deadly: 'Deadly', poisonous: 'Poisonous' } as const;

function Row({ s, note }: { s: Listed; note?: string }) {
  const page = s.slug ? bySlug(ALL_SPECIES, s.slug) : undefined;
  return (
    <div class={`row${s.keptFor ? ' kept' : ''}`} data-test="identify-row">
      {page?.photos[0] ? <img src={photoUrl(page.photos[0].file)} alt="" loading="lazy" /> : <span class="no-photo" />}
      <div class="grow">
        <div>{page ? <a href={hrefFor({ name: 'species', slug: page.slug })}>{s.english}</a> : s.english}{' '}
          {s.danger && <span class={`tag ${s.danger}`}>{DANGER_WORDS[s.danger]}</span>}</div>
        <div class="sci">{s.scientific}</div>
        {note && <div class="note">{note}</div>}
      </div>
      {page && page.lookalikes.length > 0 && <a class="small-button" href={hrefFor({ name: 'check', slug: page.slug })}>Check</a>}
    </div>
  );
}

function Results({ answers }: { answers: Answers }) {
  const r = narrow(ALL_SPECIES, answers);
  const differs = (s: Listed) => {
    const q = QUESTIONS.find((x) => x.id === s.differsOn)!;
    return `Differs on: ${q.title.replace(/\?$/, '').toLowerCase()} (you said "${said(q, answers[q.id]!)}")`;
  };
  return (
    <>
      <h2>Fit every answer ({r.matches.length})</h2>
      {r.matches.length === 0 && (
        <p class="card">Nothing in the guide fits every answer. Look again at your answers, or answer “Not sure” where you
          are unsure. The guide has {ALL_SPECIES.length} species so far.</p>
      )}
      {r.matches.map((s) => <Row s={s} key={s.scientific} />)}
      {r.kept.length > 0 && (
        <>
          <h2>Kept on the list: dangerous lookalikes ({r.kept.length})</h2>
          <p class="muted">These stay whatever you answered: a ring can fall off and a bag can hide under the soil.
            Compare your mushroom with each one.</p>
          {r.kept.map((s) => (
            <Row s={s} key={s.scientific}
              note={`Mistaken for ${s.keptFor!.join(', ')}${s.slug ? '' : ' · not in the guide yet'}`} />
          ))}
        </>
      )}
      {r.nearMisses.length > 0 && (
        <>
          <h2>Fit all but one answer ({r.nearMisses.length})</h2>
          {r.nearMisses.map((s) => <Row s={s} key={s.scientific} note={differs(s)} />)}
        </>
      )}
      <p class="card">A list is not an identification. Open “Check” on a species to compare your mushroom with it and its
        lookalikes, feature by feature.</p>
    </>
  );
}

export function Identify({ query }: { query: string }) {
  const answers = answersFromQuery(new URLSearchParams(query));
  const show = new URLSearchParams(query).get('show') === '1';
  const q = nextQuestion(answers);
  const answered = QUESTIONS.filter((x) => answers[x.id] !== undefined);
  const r = narrow(ALL_SPECIES, answers);
  return (
    <>
      <h1>Identify</h1>
      {answered.length === 0 && <p class="muted">Answer what you can see. “Not sure” never rules anything out.</p>}
      {answered.length > 0 && (
        <ol class="answers" data-test="answers">
          {answered.map((x) => (
            <li key={x.id}>{x.title} <strong>{said(x, answers[x.id]!)}</strong>{' '}
              <a href={link(Object.fromEntries(QUESTIONS.slice(0, QUESTIONS.indexOf(x)).map((y) => [y.id, answers[y.id]])))}>change</a>
            </li>
          ))}
        </ol>
      )}
      {q && !show ? (
        <section>
          <p class="muted" data-test="count"><strong>{r.matches.length}</strong> of {ALL_SPECIES.length} species fit
            {r.kept.length > 0 && <>, and {r.kept.length} dangerous {r.kept.length === 1 ? 'lookalike stays' : 'lookalikes stay'} on
              the list</>} · <a href={link(answers, true)}>show them</a></p>
          <h2>{q.title}</h2>
          <p>{q.hint}</p>
          <div class="choices">
            {q.options.map((o) => (
              <a class="choice" href={link({ ...answers, [q.id]: o.value })} key={o.value}>
                <Drawing name={o.drawing} /><span>{o.label}</span>
              </a>
            ))}
            <a class="choice unsure" href={link({ ...answers, [q.id]: UNSURE })}><span>{q.unsureLabel}</span></a>
          </div>
        </section>
      ) : (
        <>
          {q && <p><a href={link(answers)}>Go on with the questions</a></p>}
          <Results answers={answers} />
          <p><a href={hrefFor({ name: 'identify', query: '' })}>Start again</a></p>
        </>
      )}
    </>
  );
}
