import { useState } from 'preact/hooks';
import { ALL_SPECIES } from '../content';
import { hrefFor } from '../router';
import { bySlug } from '../species';
import { checkTable, verdict, type Column } from '../check';

// Check (spec 8): the species side by side with its lookalikes, one card per feature (a phone is too narrow for a
// table of four species). He taps the words that match his mushroom; a tap on a lookalike's words turns the card
// red. It always ends with "get it confirmed". No word about eating it, ever: only the danger tags.
const DANGER_WORDS: Record<string, string> = { deadly: 'Deadly', poisonous: 'Poisonous' };
const INAT_UPLOAD = 'https://www.inaturalist.org/observations/upload';

function Name({ c }: { c: Column }) {
  const has = c.slug && bySlug(ALL_SPECIES, c.slug);
  return (
    <>
      {has ? <a href={hrefFor({ name: 'species', slug: c.slug! })}>{c.english}</a> : c.english}
      {c.kind && DANGER_WORDS[c.kind] && <> <span class={`tag ${c.kind}`}>{DANGER_WORDS[c.kind]}</span></>}
    </>
  );
}

const names = (cols: Column[]) => {
  const n = [...new Set(cols.map((c) => c.english))];
  return n.length > 1 ? `${n.slice(0, -1).join(', ')} or ${n.at(-1)}` : n[0];
};

export function Check({ slug }: { slug: string }) {
  const [ticks, setTicks] = useState(() => new Map<number, number>());
  const s = bySlug(ALL_SPECIES, slug);
  if (!s) return <><h1>Not in the guide</h1><p><a href={hrefFor({ name: 'guide', query: '' })}>Back to the guide</a></p></>;
  const t = checkTable(s);
  const v = verdict(t, ticks);
  const own = t.columns[0];
  const ownDanger = DANGER_WORDS[s.edibility.value];
  const tick = (row: number, col: number) => setTicks((m) => {
    const next = new Map(m);
    if (next.get(row) === col) next.delete(row); else next.set(row, col);
    return next;
  });
  const red = [...new Set(v.fitsLookalike.flatMap((f) => f.lookalikes))];
  return (
    <>
      <h1>Check: {s.english} {ownDanger && <span class={`tag ${s.edibility.value}`}>{ownDanger}</span>}</h1>
      {t.rows.length === 0 ? (
        <p class="card">This page names no lookalikes to compare yet.</p>
      ) : (
        <>
          <p>Compare your mushroom with the {s.english} and the species it is mistaken for:{' '}
            {t.columns.slice(1).map((c, i) => <span key={c.scientific}>{i > 0 && ' · '}<Name c={c} /></span>)}.</p>
          <p class="muted">For each feature, tap the words that match what you see. Skip what you cannot see.</p>
          {t.rows.map((r, ri) => {
            const picked = ticks.get(ri);
            const flagged = picked !== undefined && picked > 0;
            return (
              <div class={`check-row${flagged ? ' red' : picked === 0 ? ' fits' : ''}`} key={r.feature} data-test="check-row">
                <h3>{r.feature}</h3>
                {r.cells.map((words, ci) => words !== null && (
                  <button type="button" class="pick" aria-pressed={picked === ci} onClick={() => tick(ri, ci)} key={ci}>
                    <span class="who">{t.columns[ci].english}</span>
                    <span>{words}</span>
                  </button>
                ))}
                {flagged && <p class="flag" role="alert">This fits {names(v.fitsLookalike.find((f) => f.feature === r.feature)!.lookalikes)} better.</p>}
              </div>
            );
          })}
          <div aria-live="polite">
            {red.length > 0 ? (
              <p class="card verdict red" data-test="verdict">Some features fit {names(red)} better than the {own.english}.
                Treat your mushroom as {names(red)}: do not eat it.</p>
            ) : v.ticked > 0 ? (
              <p class="card verdict" data-test="verdict">The {v.ticked} {v.ticked === 1 ? 'feature' : 'features'} you ticked
                {v.ticked === 1 ? ' fits' : ' fit'} the {own.english}. That is not proof.</p>
            ) : null}
            {v.ticked > 0 && <p><button type="button" class="small-button" onClick={() => setTicks(new Map())}>Clear my ticks</button></p>}
          </div>
        </>
      )}
      <div class="card confirm">
        <h2>Before eating any wild mushroom</h2>
        <p>Get it confirmed by someone who knows mushrooms, in person — or post your photos to iNaturalist and wait for
          the community's identification. If in any doubt, leave it.</p>
        <p><a href={INAT_UPLOAD}>Open iNaturalist</a></p>
      </div>
    </>
  );
}
