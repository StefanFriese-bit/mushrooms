import type { Sourced, SpeciesRecord } from '../types';
import { ALL_SPECIES, photoUrl } from '../content';
import { hrefFor } from '../router';
import { EDIBILITY_WORDS, KIND_WORDS, bySlug, tagClass } from '../species';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function Refs({ rec, fact }: { rec: SpeciesRecord; fact: { sources: string[] } }) {
  const n = fact.sources.map((id) => rec.sources.findIndex((s) => s.id === id) + 1).filter((i) => i > 0);
  return <sup class="muted"> [{n.join(', ')}]</sup>;
}

export function SpeciesPage({ slug }: { slug: string }) {
  const s = bySlug(ALL_SPECIES, slug);
  if (!s) return <><h1>Not in the guide</h1><p><a href={hrefFor({ name: 'guide', query: '' })}>Back to the guide</a></p></>;
  const line = (label: string, f: Sourced<string>) => <p><strong>{label}:</strong> {f.value}<Refs rec={s} fact={f} /></p>;
  return (
    <>
      <div class="photos">
        {s.photos.map((p, i) => (
          <figure key={p.file}>
            <img src={photoUrl(p.file)} alt={`${s.english}, photo ${i + 1}`} />
            <figcaption>{p.credit} · <a href={p.link}>iNaturalist</a></figcaption>
          </figure>
        ))}
      </div>
      <h1>{s.english}</h1>
      <p class="sci">{s.scientific}{s.olderNames.length ? ` (formerly ${s.olderNames.join(', ')})` : ''}</p>
      {s.otherNames && <p class="muted" data-test="other-names">Also called: {s.otherNames.value.join(', ')}<Refs rec={s} fact={s.otherNames} /></p>}
      <p>
        <span class={`tag ${tagClass(s.edibility.value)}`}>{EDIBILITY_WORDS[s.edibility.value]}</span>
        <Refs rec={s} fact={s.edibility} />
        {s.protectedInUk.value && <> <span class="tag plain">Protected in the UK — do not pick</span></>}
      </p>
      {s.edibilityNote && <p class="card">{s.edibilityNote.value}<Refs rec={s} fact={s.edibilityNote} /></p>}

      <h2>Top points</h2>
      <ul>{s.topPoints.map((t) => <li key={t.value}>{t.value}<Refs rec={s} fact={t} /></li>)}</ul>

      <h2>{tagClass(s.edibility.value) === 'edible' ? 'Dangerous lookalikes' : 'Edible species it is mistaken for'}</h2>
      {s.noDangerousLookalike && <p>The trusted sites name no dangerous lookalike<Refs rec={s} fact={s.noDangerousLookalike} /></p>}
      {s.lookalikes.map((l) => (
        <div class="card" key={l.scientific}>
          <h3>
            {l.slug && bySlug(ALL_SPECIES, l.slug) ? <a href={hrefFor({ name: 'species', slug: l.slug })}>{l.english}</a> : l.english}{' '}
            <span class={`tag ${tagClass(l.kind)}`}>{KIND_WORDS[l.kind]}</span>
          </h3>
          <p class="sci">{l.scientific}</p>
          <table class="apart">
            <thead><tr><th></th><th>{s.english}</th><th>{l.english}</th></tr></thead>
            <tbody>
              {l.tellApart.map((r) => (
                <tr key={r.feature}><th>{r.feature}</th><td>{r.thisOne}</td><td>{r.thatOne}<Refs rec={s} fact={r} /></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      {s.lookalikes.length > 0 && (
        <p><a class="small-button" href={hrefFor({ name: 'check', slug: s.slug })}>Check a mushroom against this one</a></p>
      )}

      <h2>Where and when</h2>
      {line('Habitat', s.habitat)}
      <p><strong>Season:</strong> {s.seasonMonths.value.map((m) => MONTHS[m - 1]).join(', ')}<Refs rec={s} fact={s.seasonMonths} /></p>
      {line('Spore print', s.sporePrint)}

      <h2>Sources</h2>
      <ol class="sources">{s.sources.map((src) => <li key={src.id}><a href={src.url}>{src.title}</a></li>)}</ol>
      <p class="muted">Facts checked {s.checked}. Photos: iNaturalist, each credited above.</p>
    </>
  );
}
