import type { Sourced, SpeciesRecord } from '../types';
import { ALL_SPECIES, photoUrl } from '../content';
import { hrefFor } from '../router';
import { EDIBILITY_WORDS, KIND_WORDS, bySlug, siteNames, tagClass } from '../species';
import { isDangerous, lookalikeTitle } from '../lookalikes';
import { Icon } from './icons';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function Refs({ rec, fact }: { rec: SpeciesRecord; fact: { sources: string[] } }) {
  const n = fact.sources.map((id) => rec.sources.findIndex((s) => s.id === id) + 1).filter((i) => i > 0);
  return <sup class="muted"> [{n.join(', ')}]</sup>;
}

/** One lookalike: its name and danger, and the features that tell the two apart, side by side. */
function Lookalike({ s, l }: { s: SpeciesRecord; l: SpeciesRecord['lookalikes'][number] }) {
  return (
    <div class="card">
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
  );
}

export function SpeciesPage({ slug }: { slug: string }) {
  const s = bySlug(ALL_SPECIES, slug);
  if (!s) return <><h1>Not in the guide</h1><p><a href={hrefFor({ name: 'guide', query: '' })}>Back to the guide</a></p></>;
  const line = (label: string, f: Sourced<string>) => <p><strong>{label}:</strong> {f.value}<Refs rec={s} fact={f} /></p>;
  const ownEdible = tagClass(s.edibility.value) === 'edible';
  const first = s.lookalikes.filter((l) => (ownEdible ? isDangerous(l.kind) : l.kind === 'edible'));
  const rest = s.lookalikes.filter((l) => !first.includes(l));
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
      {s.lookalikes.length > 0 && (
        // His spreadsheet's "possible confusion", one tap away (Stefan 10/10/2026).
        <p><a class={`big-button wide${!isDangerous(s.edibility.value) && s.lookalikes.some((l) => isDangerous(l.kind)) ? ' warn-button' : ''}`}
          href={hrefFor({ name: 'lookalikes', slug: s.slug, n: 0 })} data-test="lookalikes-button">
          <Icon name="alert" size={20} />{lookalikeTitle(s)} ({s.lookalikes.length})</a></p>
      )}

      <h2>Top points</h2>
      <ul>{s.topPoints.map((t) => <li key={t.value}>{t.value}<Refs rec={s} fact={t} /></li>)}</ul>

      {/* An edible species: its dangerous lookalikes first, then the rest; a dangerous or inedible one: the edible species
          it is mistaken for first. Each under its own heading (10/10/2026: the lookalike audit added harmless lookalikes,
          which a single "Dangerous lookalikes" heading would have called dangerous). */}
      {(ownEdible || first.length > 0) && (
        <h2 data-test="lookalikes-first">{ownEdible ? 'Dangerous lookalikes' : 'Edible species it is mistaken for'}</h2>
      )}
      {s.noDangerousLookalike && <p data-test="no-dangerous">{siteNames(s, s.noDangerousLookalike.sources)} name no dangerous
        lookalike<Refs rec={s} fact={s.noDangerousLookalike} /></p>}
      {first.map((l) => <Lookalike key={l.scientific} s={s} l={l} />)}
      {rest.length > 0 && <h2 data-test="lookalikes-rest">{ownEdible || first.length > 0 ? 'Other lookalikes' : 'Lookalikes'}</h2>}
      {rest.map((l) => <Lookalike key={l.scientific} s={s} l={l} />)}
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
