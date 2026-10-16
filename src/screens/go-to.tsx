import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Spot } from '../finds/store';
import { followHere } from '../finds/device';
import { appleMapsLink, bearingDeg, compassWord, distanceM, isThere, sayAccuracy, sayDistance, type Fix } from '../finds/geo';
import { allowCompass, arrowTurn, compassAsked, followHeading, mapTurnsWithMe, rememberMapTurns, type CompassAnswer, type Heading } from '../finds/compass';
import { FindsMap } from './finds-map';
import { BackLink } from './back-link';
import { Icon } from './icons';
import type { BadgeKey } from '../finds/badges';

// The walk back to a spot (spec 7), the way a geocaching app does it: how far, which way (an arrow that follows the
// phone's compass), and — once he is as close as GPS can tell — "you are there". Everything works with no signal: GPS
// needs only the sky, and the compass needs nothing. The screen is kept awake while it is open. ONE screen for a saved
// location (Take me there) and for the dogs (Stefan 13/10/2026: "it'll work the same as logging location of a mushroom").
type CompassState = 'off' | 'asking' | 'on' | 'denied' | 'none';
const stateOf = (a: CompassAnswer): CompassState => (a === 'granted' ? 'on' : a === 'denied' ? 'denied' : 'none');

type Props = {
  title: string;
  /** A line under the title, e.g. when the spot was saved. */
  subtitle?: string;
  spot: Spot;
  back: { href: string; label: string };
  /** The spot's pin on the map, and the page its pin opens. */
  pin: { id: string; label: string; href: string; badge?: BadgeKey };
  /** Said after "You are as close as GPS can tell (…)." */
  thereText: string;
  /** Shown under that sentence, in the same card (the find's description and photos; for the dogs, "Got them"). */
  thereExtra?: ComponentChildren;
  /** The last word on how exact GPS is, under the map. */
  circleNote: string;
  /** Links at the foot of the screen. */
  children?: ComponentChildren;
};

export function GoTo({ title, subtitle, spot, back, pin, thereText, thereExtra, circleNote, children }: Props) {
  const [here, setHere] = useState<Fix | null>(null);
  const [gpsProblem, setGpsProblem] = useState<string | null>(null);
  const [heading, setHeading] = useState<Heading | null>(null);
  /** Whether this screen has ever had a reading out of the compass. */
  const heardOne = useRef(false);
  // The map turned the way he points the phone (Stefan 13/10/2026) — on unless he locked it to north last time.
  const [turnMap, setTurnMap] = useState(mapTurnsWithMe);
  // The tap that opened this screen asked for the compass (askForCompassOnTap): it is on as soon as he allows it.
  const [compass, setCompass] = useState<CompassState>(() => {
    const asked = compassAsked();
    return !asked ? 'off' : asked.answer ? stateOf(asked.answer) : 'asking';
  });
  useEffect(() => followHere((f) => { setHere(f); setGpsProblem(null); }, setGpsProblem), []);
  useEffect(() => {
    const asked = compassAsked();
    if (!asked) return;
    let gone = false;
    void asked.reply.then((a) => { if (!gone) setCompass((c) => (c === 'asking' ? stateOf(a) : c)); });
    return () => { gone = true; };
  }, []);
  useEffect(() => {
    // It keeps listening after saying the phone gives none: a compass can be slow to wake (cold, under trees), and
    // before 13/10/2026 the first three quiet seconds switched it off for the rest of the walk, with no way back.
    if (compass !== 'on' && compass !== 'none') return;
    const stop = followHeading((h) => {
      if (!h) return; // an event carrying no heading: the last one still stands, rather than the arrow blinking away
      heardOne.current = true;
      setHeading(h);
      setCompass((c) => (c === 'none' ? 'on' : c)); // it has one after all
    });
    // A phone that allows the compass but never sends a heading has none: say so rather than wait for ever. Once one
    // has been heard it is never unsaid — a gap between readings is not the same as having no compass.
    const quiet = setTimeout(() => { if (!heardOne.current) setCompass((c) => (c === 'on' ? 'none' : c)); }, 3000);
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

  const distance = here ? distanceM(here, spot) : null;
  const bearing = here ? bearingDeg(here, spot) : null;
  const there = here && distance !== null ? isThere(distance, here.accuracy, spot.accuracy) : false;
  // With the compass on, the arrow points the way to walk from where the top of the phone points; without it, the dial is
  // a little map with north at the top.
  const turn = bearing === null ? null : compass === 'on' && heading ? arrowTurn(bearing, heading.deg) : bearing;
  const northAt = compass === 'on' && heading ? (360 - heading.deg) % 360 : 0;
  const turnOn = async () => {
    setCompass('asking');
    setCompass(stateOf(await allowCompass()));
  };
  // Which way the map is held: the way he is facing while the compass is on and he has not locked it to north.
  const facing = compass === 'on' && heading && turnMap ? heading.deg : null;
  const turnMapTo = (on: boolean) => { setTurnMap(on); rememberMapTurns(on); };

  return (
    <>
      <BackLink href={back.href} label={back.label} />
      <h1 class="go-title">{title}</h1>
      {subtitle && <p class="muted small go-subtitle">{subtitle}</p>}
      <div class="go" data-test="find-go">
        <div class="go-top">
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
        <div class="go-read">
          <p class="go-distance" data-test="go-distance">
            {distance === null ? 'Finding your position…' : there ? 'You are there' : sayDistance(distance)}
          </p>
          {bearing !== null && !there && <p class="go-way">Head {compassWord(bearing)}{compass === 'on' && heading ? ': follow the arrow' : ''}</p>}
          <p class="muted small">
            {here ? <><span class="nowrap">You: {sayAccuracy(here.accuracy)}.</span> </> : null}
            <span class="nowrap">Saved {spot.accuracy === null ? 'by placing a pin by hand' : sayAccuracy(spot.accuracy)}.</span>
          </p>
        </div>
        </div>
        {gpsProblem && <p class="card" role="alert">{gpsProblem}</p>}
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
            {' '}{thereText}</p>
          {thereExtra}
        </div>
      )}
      {/* The map lying the way the wood lies in front of him, or held with north at the top to read it. Only worth
          offering once the compass is on: without it there is nothing to turn the map by. */}
      {compass === 'on' && heading && (
        <p class="go-turn">
          <button type="button" class="small-button" onClick={() => turnMapTo(!turnMap)} data-test="map-turn">
            <Icon name={turnMap ? 'map' : 'navigate'} size={18} />{turnMap ? 'North at the top' : 'Turn the map with me'}
          </button>
          <span class="muted small">{turnMap ? 'The map turns the way you point the phone.' : 'The map is held with north at the top.'}</span>
        </p>
      )}
      <FindsMap pins={[{ id: pin.id, lat: spot.lat, lon: spot.lon, label: pin.label, href: pin.href, accuracy: spot.accuracy, badge: pin.badge }]}
        here={here} short facing={facing} />
      <p class="go-paths"><a class="small-button" href={appleMapsLink(spot)} data-test="go-directions">
        <Icon name="map" size={18} />Walking directions</a> <span class="muted small">in Apple Maps (needs a signal)</span></p>
      <p class="muted small">{circleNote}</p>
      {children}
    </>
  );
}
