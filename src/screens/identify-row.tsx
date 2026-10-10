import { ALL_SPECIES, photoUrl } from '../content';
import { hrefFor } from '../router';
import { bySlug } from '../species';
import type { Listed } from '../identify';

// One species in Identify's lists, and in the order his photos put them: its photo, its name and danger, and Check.
// No word about eating: only the danger of a species is shown.
export const DANGER_WORDS = { deadly: 'Deadly', poisonous: 'Poisonous' } as const;

export function Row({ s, note }: { s: Listed; note?: string }) {
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
