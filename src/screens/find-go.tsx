import { useEffect, useState } from 'preact/hooks';
import { hrefFor } from '../router';
import { getFind, photosOf, photoAddress, type Find } from '../finds/store';
import { BackLink } from './back-link';
import { findLabel, useNames } from './finds';
import { GoTo } from './go-to';

// Take me there (spec 7): back to a saved location — the walk-back screen (./go-to.tsx), and once he is there, the
// find's own description and photos to recognise it by.
export function FindGo({ id }: { id: string }) {
  const [find, setFind] = useState<Find | null | undefined>(undefined);
  const [srcs, setSrcs] = useState<string[]>([]);
  const names = useNames();
  useEffect(() => { getFind(id).then((f) => setFind(f ?? null), () => setFind(null)); }, [id]);
  useEffect(() => {
    if (!find) return;
    let urls: string[] = [];
    let gone = false;
    photosOf(find).then((ps) => { if (!gone) { urls = ps.map(photoAddress); setSrcs(urls); } });
    return () => { gone = true; urls.forEach((u) => URL.revokeObjectURL(u)); };
  }, [find?.id]);

  if (find === undefined) return <p class="muted">Loading…</p>;
  if (find === null) return <><h1>Not found</h1><p>That location is not on this phone. <a href={hrefFor({ name: 'finds' })}>Back to the map</a></p></>;
  const label = findLabel(find, names);
  if (!find.spot) {
    return <><BackLink href={hrefFor({ name: 'finds' })} label="Map" /><h1>Back to: {label}</h1><p>No position was saved with this location, so there is nothing to walk back to.</p>
      <p><a href={hrefFor({ name: 'find', id: find.id })}>Back to the location</a></p></>;
  }
  return (
    <GoTo title={`Back to: ${label}`} spot={find.spot} back={{ href: hrefFor({ name: 'finds' }), label: 'Map' }}
      pin={{ id: find.id, label, href: hrefFor({ name: 'find', id: find.id }) }}
      thereText={`Look around here${srcs.length > 0 ? ' — these are your photos of it:' : '.'}`}
      thereExtra={<>
        {find.notes && <p class="description">{find.notes}</p>}
        {srcs.length > 0 && (
          <div class="photos">{srcs.map((s, i) => <figure key={s}><img src={s} alt={`Photo ${i + 1}`} /></figure>)}</div>
        )}
      </>}
      circleNote="Under trees GPS is less exact than in the open, and the mushroom may be anywhere inside its circle.">
      <p><a href={hrefFor({ name: 'find', id: find.id })}>Back to the location</a></p>
    </GoTo>
  );
}
