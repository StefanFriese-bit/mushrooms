import { useEffect, useState } from 'preact/hooks';
import { hrefFor } from '../router';
import { getFind, photosOf, photoAddress, type Find } from '../finds/store';
import { followHere } from '../finds/device';
import { appleMapsLink, bearingDeg, compassWord, distanceM, isThere, sayAccuracy, sayDistance, type Fix } from '../finds/geo';
import { allowCompass, arrowTurn, followHeading, type Heading } from '../finds/compass';
import { FindsMap } from './finds-map';
import { findLabel, useNames } from './finds';

// Back to a find (spec 7), the way a geocaching app does it: how far, which way (an arrow that follows the phone's
// compass), and — once he is as close as GPS can tell — "look around here" with the find's own photos. Everything works
// with no signal: GPS needs only the sky, and the compass needs nothing. The screen is kept awake while it is open.
type CompassState = 'off' | 'asking' | 'on' | 'denied' | 'none';

export function FindGo({ id }: { id: string }) {
  const [find, setFind] = useState<Find | null | undefined>(undefined);
  const [here, setHere] = useState<Fix | null>(null);
  const [gpsProblem, setGpsProblem] = useState<string | null>(null);
  const [heading, setHeading] = useState<Heading | null>(null);
  const [compass, setCompass] = useState<CompassState>('off');
  const [srcs, setSrcs] = useState<string[]>([]);
  const names = useNames();
  useEffect(() => { getFind(id).then((f) => setFind(f ?? null), () => setFind(null)); }, [id]);
  useEffect(() => followHere((f) => { setHere(f); setGpsProblem(null); }, setGpsProblem), []);
  useEffect(() => {
    if (compass !== 'on') return;
    let heard = false;
    const stop = followHeading((h) => { if (h) heard = true; setHeading(h); });
    // A phone that allows the compass but never sends a heading has none: say so rather than wait for ever.
    const quiet = setTimeout(() => { if (!heard) setCompass('none'); }, 3000);
    return () => { stop(); clearTimeout(quiet); };
  }, [compass]);
  // Keep the screen on while walking back (phones that cannot simply let it sleep as usual).
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    let gone = false;
    const wake = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock;
    wake?.request('screen').then((l) => { if (gone) void l.release(); else lock = l; }, () => {});
    return () => { gone = true; void lock?.release().catch(() => {}); };
  }, []);
  useEffect(() => {
    if (!find) return;
    let urls: string[] = [];
    let gone = false;
    photosOf(find).then((ps) => { if (!gone) { urls = ps.map(photoAddress); setSrcs(urls); } });
    return () => { gone = true; urls.forEach((u) => URL.revokeObjectURL(u)); };
  }, [find?.id]);

  if (find === undefined) return <p class="muted">Loading…</p>;
  if (find === null) return <><h1>Not found</h1><p>That find is not on this phone. <a href={hrefFor({ name: 'finds' })}>Back to your finds</a></p></>;
  const label = findLabel(find, names);
  if (!find.spot) {
    return <><h1>Back to: {label}</h1><p>No spot was saved with this find, so there is nothing to walk back to.</p>
      <p><a href={hrefFor({ name: 'find', id: find.id })}>Back to the find</a></p></>;
  }
  const spot = find.spot;
  const distance = here ? distanceM(here, spot) : null;
  const bearing = here ? bearingDeg(here, spot) : null;
  const there = here && distance !== null ? isThere(distance, here.accuracy, spot.accuracy) : false;
  // With the compass on, the arrow points the way to walk from where the top of the phone points; without it, the dial is
  // a little map with north at the top.
  const turn = bearing === null ? null : compass === 'on' && heading ? arrowTurn(bearing, heading.deg) : bearing;
  const northAt = compass === 'on' && heading ? (360 - heading.deg) % 360 : 0;
  const turnOn = async () => {
    setCompass('asking');
    const answer = await allowCompass();
    setCompass(answer === 'granted' ? 'on' : answer === 'denied' ? 'denied' : 'none');
  };

  return (
    <>
      <h1>Back to: {label}</h1>
      <div class="go" data-test="find-go">
        <svg class="go-dial" viewBox="-100 -100 200 200" role="img"
          aria-label={bearing === null ? 'Waiting for your position' : `Head ${compassWord(bearing)}`}>
          <circle r="94" class="go-ring" />
          <g transform={`rotate(${northAt})`}><text y="-72" class="go-north">N</text></g>
          {turn !== null && !there && (
            <g transform={`rotate(${turn})`} data-test="go-arrow">
              <path d="M0 -70 L26 10 L8 2 L8 60 L-8 60 L-8 2 L-26 10 Z" class="go-arrow" />
            </g>
          )}
          {there && <circle r="40" class="go-there" />}
        </svg>
        <p class="go-distance" data-test="go-distance">
          {distance === null ? 'Finding your position…' : there ? 'You are there' : sayDistance(distance)}
        </p>
        {bearing !== null && !there && <p class="go-way">Head {compassWord(bearing)}{compass === 'on' && heading ? ': follow the arrow' : ''}</p>}
        {gpsProblem && <p class="card" role="alert">{gpsProblem}</p>}
        <p class="muted small">
          {here ? <>Your position: {sayAccuracy(here.accuracy)}. </> : null}
          The find was saved {spot.accuracy === null ? 'by placing a pin by hand' : sayAccuracy(spot.accuracy)}.
        </p>
        {compass === 'off' && <p><button type="button" class="small-button" onClick={turnOn}>Use the compass</button></p>}
        {compass === 'asking' && <p class="muted small">Asking for the compass…</p>}
        {compass === 'denied' && <p class="muted small">The compass is not allowed, so the dial shows north at the top, like a map.</p>}
        {compass === 'none' && <p class="muted small">This phone gives no compass, so the dial shows north at the top, like a map.</p>}
        {compass === 'on' && !heading && <p class="muted small">Waiting for the compass… Hold the phone flat, top pointing ahead.</p>}
        {compass === 'on' && heading?.accuracy !== null && heading?.accuracy !== undefined && heading.accuracy > 25 && (
          <p class="muted small">The compass is unsure (±{Math.round(heading.accuracy)}°): move the phone in a figure of eight.</p>
        )}
      </div>
      {there && (
        <div class="card" data-test="go-there">
          <p><strong>You are as close as GPS can tell</strong> ({sayAccuracy(Math.max(5, (here?.accuracy ?? 0) + (spot.accuracy ?? 0)))}).
            Look around here — these are your photos of it:</p>
          {srcs.length > 0 && (
            <div class="photos">{srcs.map((s, i) => <figure key={s}><img src={s} alt={`Photo ${i + 1}`} /></figure>)}</div>
          )}
        </div>
      )}
      <FindsMap pins={[{ id: find.id, lat: spot.lat, lon: spot.lon, label, href: hrefFor({ name: 'find', id: find.id }), accuracy: spot.accuracy }]}
        here={here} />
      <p class="muted small">Under trees GPS is less exact than in the open, and the find may be anywhere inside its
        circle. Paths in Apple Maps: <a href={appleMapsLink(spot)}>directions</a> (needs signal).</p>
      <p><a href={hrefFor({ name: 'find', id: find.id })}>Back to the find</a></p>
    </>
  );
}
