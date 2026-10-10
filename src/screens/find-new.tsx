import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { hrefFor } from '../router';
import { addFind, type Spot } from '../finds/store';
import { followSpot, shrinkPhoto, takeHandOver } from '../finds/device';
import { sayAccuracy } from '../finds/geo';
import { FindsMap } from './finds-map';
import { Icon } from './icons';
import { BackLink } from './back-link';

// Save a location (Stefan 10/10/2026): the exact spot where he is standing — the GPS position, getting better while
// the screen is open, or a pin he places by hand — with a description and a photo, both optional. Saves with no
// signal. Photos handed over by a scan arrive already filled in. What the mushroom is can be added later, on the saved
// location's own page.
const JUST_SAVED = 'just-saved';
/** The saved location's page says "saved" once, straight after this screen. */
export function wasJustSaved(id: string): boolean {
  try {
    if (sessionStorage.getItem(JUST_SAVED) !== id) return false;
    sessionStorage.removeItem(JUST_SAVED);
    return true;
  } catch { return false; }
}

export function FindNew() {
  const handed = useMemo(() => takeHandOver(), []);
  const [spot, setSpot] = useState<Spot | null>(null);
  const [where, setWhere] = useState('Finding your position…');
  const placed = useRef(false);
  const [photos, setPhotos] = useState<Blob[]>(handed?.photos ?? []);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const previews = useMemo(() => photos.map((p) => URL.createObjectURL(p)), [photos]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);
  useEffect(() => followSpot(
    (s, readings) => {
      if (placed.current) return;
      setSpot(s);
      // Readings taken while the screen is open are averaged (src/finds/geo.ts steadySpot): standing still helps.
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
  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy('Preparing the photo…');
    try {
      const small = await Promise.all([...files].map((f) => shrinkPhoto(f)));
      setPhotos((ps) => [...ps, ...small]);
    } catch {
      setProblem('A photo could not be read.');
    } finally {
      setBusy(null);
    }
  };
  const save = async () => {
    if (!spot && !confirm('There is no position yet. Save the location without one?')) return;
    setBusy('Saving…');
    try {
      const f = await addFind({ at: new Date().toISOString(), spot, species: handed?.species ?? null, notes: notes.trim() }, photos);
      try { sessionStorage.setItem(JUST_SAVED, f.id); } catch { /* the page simply does not say "saved" */ }
      location.hash = hrefFor({ name: 'find', id: f.id });
    } catch {
      setBusy(null);
      setProblem('The location could not be saved on this phone. Nothing was stored; please try again.');
    }
  };
  return (
    <>
      <BackLink href={hrefFor({ name: 'map' })} label="Map" />
      <h1>Save a location</h1>
      <section class="card">
        <h2>Where you are</h2>
        <p data-test="where">{where}</p>
        <FindsMap pick={{ spot, onPick: place }} />
        <p class="muted small">Not quite right? Tap the map or drag the pin.</p>
      </section>
      <section class="card">
        <h2><label for="description">Description</label><span class="optional">optional</span></h2>
        <textarea id="description" class="field" rows={3} value={notes} onInput={(e) => setNotes((e.target as HTMLTextAreaElement).value)}
          placeholder="What did you find? For example: Penny Bun, five caps, under the big beech" />
      </section>
      <section class="card">
        <h2>Photo<span class="optional">optional</span></h2>
        {previews.length > 0 && (
          <div class="thumbs">
            {previews.map((u, i) => (
              <figure key={u}>
                <img src={u} alt={`Photo ${i + 1}`} />
                <button type="button" class="small-button" onClick={() => setPhotos((ps) => ps.filter((_, k) => k !== i))}>Remove</button>
              </figure>
            ))}
          </div>
        )}
        <label class="small-button file-button"><Icon name="camera" size={18} />{previews.length ? 'Add another photo' : 'Take or choose a photo'}
          <input type="file" accept="image/*" multiple aria-label="Photo" onChange={(e) => addPhotos((e.target as HTMLInputElement).files)} />
        </label>
      </section>
      {problem && <p class="card alert" role="alert">{problem}</p>}
      <p><button type="button" class="big-button wide" disabled={busy !== null} onClick={save}>
        {busy ?? <><Icon name="pin" size={20} />Save location</>}</button></p>
    </>
  );
}
