import { ALL_SPECIES, photoUrl } from '../content';
import { hrefFor } from '../router';
import { EDIBILITY_WORDS, searchSpecies, tagClass } from '../species';

export function Guide({ query }: { query: string }) {
  const shown = searchSpecies(ALL_SPECIES, query);
  return (
    <>
      <h1>Guide</h1>
      <input class="search" type="search" placeholder="Search by name" value={query} aria-label="Search the guide"
        onInput={(e) => { location.hash = hrefFor({ name: 'guide', query: (e.target as HTMLInputElement).value }); }} />
      <p class="muted">{shown.length} of {ALL_SPECIES.length} species</p>
      {shown.map((s) => (
        <a class="row" data-test="species-row" href={hrefFor({ name: 'species', slug: s.slug })} key={s.slug}>
          <img src={s.photos[0] ? photoUrl(s.photos[0].file) : ''} alt="" loading="lazy" />
          <div>
            <div>{s.english}</div>
            <div class="sci">{s.scientific}</div>
            <span class={`tag ${tagClass(s.edibility.value)}`}>{EDIBILITY_WORDS[s.edibility.value]}</span>
          </div>
        </a>
      ))}
    </>
  );
}
