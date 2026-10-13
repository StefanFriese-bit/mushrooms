import { useEffect, useRef, useState } from 'preact/hooks';
import { hrefFor } from '../router';
import type { Spot } from '../finds/store';
import { followSpot } from '../finds/device';
import { sayAccuracy } from '../finds/geo';
import { askForCompassOnTap } from '../finds/compass';
import { forgetDogs, freshDogs, readDogs, saveDogs, sayDogsWhen, type DogsSpot } from '../finds/dogs';
import { FindsMap } from './finds-map';
import { BackLink } from './back-link';
import { GoTo } from './go-to';
import { Icon } from './icons';

// The dogs (Stefan 13/10/2026: "I tie the dogs … to a tree while I walk around in the area and yesterday I almost lost
// them … when I'm finished walking around I can click that and it'll guide me back to where they are"). Save the spot
// where he tied them — the same steady GPS as Save a location, or a pin placed by hand — then forage; the Dogs button
// then walks him back with the arrow, the distance and the map (./go-to.tsx). One spot at a time (src/finds/dogs.ts).
const JUST_SAVED = 'dogs-just-saved';
const PIN = { id: 'dogs', label: 'The dogs', href: hrefFor({ name: 'dogs' }) };

function forget() {
  if (!confirm('Forget where the dogs are? Do this once they are with you again.')) return;
  forgetDogs();
  location.hash = hrefFor({ name: 'home' });
}

/** Saving the spot. `old`: a spot already saved, which this one replaces. */
function DogsSave({ old, onSaved }: { old: DogsSpot | null; onSaved: (d: DogsSpot) => void }) {
  const [spot, setSpot] = useState<Spot | null>(null);
  const [where, setWhere] = useState('Finding your position…');
  const placed = useRef(false);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => followSpot(
    (s, readings) => {
      if (placed.current) return;
      setSpot(s);
      setWhere(`Your position, ${sayAccuracy(s.accuracy)}${readings > 1 ? `, steadied over ${readings} readings` : ''}` +
        (s.accuracy !== null && s.accuracy > 15 ? '. Under trees, standing still for half a minute usually makes it more exact.' : ''));
    },
    (message) => { if (!placed.current) setWhere(message); },
  ), []);
  const place = (lat: number, lon: number) => {
    placed.current = true;
    setSpot({ lat, lon, accuracy: null });
    setWhere('Placed by hand on the map');
  };
  const save = () => {
    if (!spot) return;
    let d: DogsSpot;
    try { d = saveDogs(spot, new Date()); } catch {
      setProblem('The spot could not be saved on this phone. Nothing was stored; please try again.');
      return;
    }
    onSaved(d);
  };
  return (
    <>
      <h1>Where the dogs are</h1>
      <p data-test="where">{where}</p>
      {/* The button on the first screen, above the map: he is holding the leads. */}
      <p><button type="button" class="big-button wide" disabled={!spot} onClick={save} data-test="dogs-save">
        <Icon name="paw" size={20} />Save the dogs' spot</button></p>
      {!spot && <p class="muted small">The button works once there is a position — or place the pin on the map.</p>}
      {problem && <p class="card alert" role="alert">{problem}</p>}
      {old && <p class="muted small" data-test="dogs-replaces">The spot saved {sayDogsWhen(old.at)} is replaced when you save.
        {' '}<a href={hrefFor({ name: 'dogs-go' })} onClick={askForCompassOnTap}>Take me to that one</a></p>}
      <section class="card">
        <FindsMap pick={{ spot, onPick: place }} />
        <p class="muted small">Not quite right? Tap the map or drag the pin, then save.</p>
      </section>
      <p class="muted small">Then go foraging. When you are done, tap Dogs and it walks you back to them: the arrow, the
        distance and the map, no signal needed.</p>
    </>
  );
}

/** This walk's spot, saved: the way back to it first. */
function DogsSaved({ d, justSaved }: { d: DogsSpot; justSaved: boolean }) {
  return (
    <>
      {justSaved && <p class="card saved-note" role="status" data-test="saved-note"><Icon name="check" size={20} />The dogs' spot is saved on this phone.</p>}
      <h1>The dogs</h1>
      <p class="muted" data-test="dogs-saved">Saved {sayDogsWhen(d.at)} · {sayAccuracy(d.accuracy)}</p>
      <p><a class="big-button wide" href={hrefFor({ name: 'dogs-go' })} data-test="dogs-go" onClick={askForCompassOnTap}>
        <Icon name="navigate" size={20} />Take me to the dogs</a></p>
      <p class="muted small">Go and forage. When you are done, tap Dogs — on the home page or at the foot of any page — and it
        walks you straight back here.</p>
      <FindsMap pins={[{ ...PIN, lat: d.lat, lon: d.lon, accuracy: d.accuracy }]} />
      <p><a class="small-button" href={hrefFor({ name: 'dogs-new' })} data-test="dogs-new">Tied them somewhere else? Save a new spot</a></p>
      <p><button type="button" class="small-button" onClick={forget} data-test="dogs-forget">Got them — forget the spot</button></p>
    </>
  );
}

/** #/dogs: this walk's spot, or — when there is none — the screen that saves it. */
export function Dogs() {
  const [d, setD] = useState<DogsSpot | null>(() => freshDogs());
  const [justSaved, setJustSaved] = useState(() => {
    try { const yes = sessionStorage.getItem(JUST_SAVED) === '1'; sessionStorage.removeItem(JUST_SAVED); return yes; } catch { return false; }
  });
  if (d) return <DogsSaved d={d} justSaved={justSaved} />;
  return <DogsSave old={readDogs()} onSaved={(saved) => { setJustSaved(true); setD(saved); window.scrollTo(0, 0); }} />;
}

/** #/dogs/new: a new spot, replacing the saved one. */
export function DogsNew() {
  return (
    <>
      <BackLink href={hrefFor({ name: 'dogs' })} label="Dogs" />
      <DogsSave old={readDogs()} onSaved={() => {
        try { sessionStorage.setItem(JUST_SAVED, '1'); } catch { /* the page simply does not say "saved" */ }
        location.hash = hrefFor({ name: 'dogs' });
      }} />
    </>
  );
}

/** #/dogs/go: the walk back to the dogs. */
export function DogsGo() {
  const [d] = useState(() => readDogs());
  if (!d) {
    return <><BackLink href={hrefFor({ name: 'dogs' })} label="Dogs" /><h1>Back to the dogs</h1>
      <p>No spot is saved for the dogs on this phone.</p>
      <p><a class="big-button wide" href={hrefFor({ name: 'dogs' })}><Icon name="paw" size={20} />Save where the dogs are</a></p></>;
  }
  return (
    <GoTo title="Back to the dogs" subtitle={`Saved ${sayDogsWhen(d.at)}`} spot={d} back={{ href: hrefFor({ name: 'dogs' }), label: 'Dogs' }}
      pin={PIN} thereText="The dogs should be right here."
      thereExtra={<p><button type="button" class="small-button primary" onClick={forget} data-test="dogs-forget">Got them — forget the spot</button></p>}
      circleNote="Under trees GPS is less exact than in the open: the dogs are somewhere inside the circle." />
  );
}
