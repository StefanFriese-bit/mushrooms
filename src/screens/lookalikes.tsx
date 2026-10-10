import { ALL_SPECIES, photoUrl } from '../content';
import { hrefFor } from '../router';
import { EDIBILITY_WORDS, KIND_WORDS, bySlug, siteNames, tagClass } from '../species';
import { apartRows, isDangerous, lookalikeHeading, orderedLookalikes } from '../lookalikes';
import { BackLink } from './back-link';
import { Icon } from './icons';

// A species' lookalikes one at a time (src/lookalikes.ts, after Stefan's spreadsheet of 10/10/2026): the two side by
// side with a photo each, then the points that tell them apart, one card per feature, short enough to read in the rain.
// The dangerous one's words are red. Every point is the species page's own (two trusted sites each).
function Side({ name, file, tag, cls, href }: { name: string; file?: string; tag: string; cls: string; href?: string }) {
  const body = (
    <>
      {file ? <img src={photoUrl(file)} alt="" /> : <span class="pair-nophoto">No photo in the guide</span>}
      <span class="pair-name">{name}</span>
      <span class={`tag ${cls}`}>{tag}</span>
    </>
  );
  return href ? <a class="pair-side" href={href}>{body}</a> : <div class="pair-side">{body}</div>;
}

export function Lookalikes({ slug, n }: { slug: string; n: number }) {
  const s = bySlug(ALL_SPECIES, slug);
  if (!s) return <><h1>Not in the guide</h1><p><a href={hrefFor({ name: 'guide', query: '' })}>Back to the guide</a></p></>;
  const all = orderedLookalikes(s);
  const back = <BackLink href={hrefFor({ name: 'species', slug })} label={s.english} />;
  if (all.length === 0) {
    return <>{back}<h1>Lookalikes</h1><p class="card">{s.noDangerousLookalike ? `${siteNames(s, s.noDangerousLookalike.sources)} name no dangerous lookalike.`
      : 'This page names no lookalikes yet.'}</p></>;
  }
  const i = Math.min(Math.max(0, n), all.length - 1);
  const l = all[i];
  const other = l.slug ? bySlug(ALL_SPECIES, l.slug) : undefined;
  const ownDanger = isDangerous(s.edibility.value);
  const itsDanger = isDangerous(l.kind);
  return (
    <>
      {back}
      <h1>{lookalikeHeading(s, l)}</h1>
      <p class="muted" data-test="lookalike-count">{s.english} · {i + 1} of {all.length}</p>
      <div class="pair" data-test="pair">
        <Side name={s.english} file={s.photos[0]?.file} tag={EDIBILITY_WORDS[s.edibility.value]} cls={tagClass(s.edibility.value)} />
        <Side name={l.english} file={other?.photos[0]?.file} tag={KIND_WORDS[l.kind]} cls={tagClass(l.kind)}
          href={other ? hrefFor({ name: 'species', slug: other.slug }) : undefined} />
      </div>
      <h2>Tell them apart</h2>
      {apartRows(l).map((r) => (
        <div class="apart-row" key={r.feature} data-test="apart-row">
          <div class="apart-feature">{r.feature}</div>
          <div class={`apart-line${ownDanger ? ' danger' : ''}`}><span class="apart-who">{s.english}</span>{r.thisOne}</div>
          <div class={`apart-line${itsDanger ? ' danger' : ''}`}><span class="apart-who">{l.english}</span>{r.thatOne}</div>
        </div>
      ))}
      <div class="pager">
        {i > 0 ? <a class="small-button" href={hrefFor({ name: 'lookalikes', slug, n: i - 1 })}><Icon name="back" size={18} />Previous</a> : <span />}
        {i < all.length - 1 && (
          <a class="big-button" href={hrefFor({ name: 'lookalikes', slug, n: i + 1 })} data-test="next-lookalike">Next lookalike<Icon name="chevron" size={18} /></a>
        )}
      </div>
      <p><a class="small-button" href={hrefFor({ name: 'check', slug })}>Check yours against them, feature by feature</a></p>
      <p class="card muted small">Never eat a mushroom on this app's word. Get it confirmed by someone who knows mushrooms,
        in person.</p>
    </>
  );
}
