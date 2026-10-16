import { useEffect, useState } from 'preact/hooks';
import { hrefFor } from '../router';
import { getFind, photosOf, photoAddress, type Find } from '../finds/store';
import { BackLink } from './back-link';
import { findLabel, useNames } from './finds';
import { GoTo } from './go-to';
import { Icon } from './icons';
import { askForCompassOnTap } from '../finds/compass';
import { nextStop, stopNumber } from '../finds/walk';
import { walkOf } from '../finds/walk-store';
import { badgesOfFind } from '../finds/badges';

// Take me there (spec 7): back to a saved location — the walk-back screen (./go-to.tsx), and once he is there, the
// find's own description and photos to recognise it by.
export function FindGo({ id }: { id: string }) {
  const [find, setFind] = useState<Find | null | undefined>(undefined);
  const [srcs, setSrcs] = useState<string[]>([]);
  const names = useNames();
  // The walk he is on, if this location is one of its stops (src/finds/walk.ts).
  const [walk] = useState(() => walkOf());
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
  // Walking a planned round: which stop this is, and the one after it, offered the moment he is standing on this one.
  const stop = walk ? stopNumber(walk, find.id) : 0;
  const after = walk && stop > 0 ? nextStop(walk, find.id) : null;
  return (
    <GoTo title={`Back to: ${label}`} spot={find.spot} back={{ href: hrefFor({ name: 'finds' }), label: 'Map' }}
      subtitle={stop > 0 ? `Stop ${stop} of ${walk!.order.length} on your walk` : undefined}
      pin={{ id: find.id, label, href: hrefFor({ name: 'find', id: find.id }), badges: badgesOfFind(find).map((b) => b.key) }}
      thereText={`Look around here${srcs.length > 0 ? ' — these are your photos of it:' : '.'}`}
      thereExtra={<>
        {find.notes && <p class="description">{find.notes}</p>}
        {srcs.length > 0 && (
          <div class="photos">{srcs.map((s, i) => <figure key={s}><img src={s} alt={`Photo ${i + 1}`} /></figure>)}</div>
        )}
        {after && (
          <p><a class="small-button primary" href={hrefFor({ name: 'find-go', id: after.id })} onClick={askForCompassOnTap}
            data-test="walk-next"><Icon name="navigate" size={16} />Next: stop {stop + 1} of {walk!.order.length}</a></p>
        )}
        {stop > 0 && !after && <p class="muted small" data-test="walk-done">That is the last stop on your walk.</p>}
      </>}
      circleNote="Under trees GPS is less exact than in the open, and the mushroom may be anywhere inside its circle.">
      <p><a href={hrefFor({ name: 'find', id: find.id })}>Back to the location</a></p>
    </GoTo>
  );
}
