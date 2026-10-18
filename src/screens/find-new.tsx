import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { hrefFor } from '../router';
import { addFind, type Spot } from '../finds/store';
import { followSpot, shrinkPhoto, takeHandOver } from '../finds/device';
import { sayAccuracy } from '../finds/geo';
import { FindsMap } from './finds-map';
import { Icon } from './icons';
import { BackLink } from './back-link';
import { GrowthPicker } from './growth';
import { BadgePicker } from './badges';
import { badgeByKey, badgeFor, type BadgeKey } from '../finds/badges';

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
  // One of the three pictures (src/finds/badges.ts) = the species; a scan that named one of them starts it pressed.
  const [badge, setBadge] = useState<BadgeKey | null>(badgeFor(handed?.species)?.key ?? null);
  const [stage, setStage] = useState<number | null>(null); // growth stage, optional (src/finds/growth.ts)
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  // The map is folded away (Stefan 18/10/2026: "every single time I've used it … I'm saving a location exactly where I
  // am"): one tap opens it to move the pin. It opens by itself when the phone gives no position, so the pin can be placed.
  const [showMap, setShowMap] = useState(false);
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
    (message) => { if (!placed.current) { setWhere(message); setShowMap(true); } },
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
      const at = new Date().toISOString();
      const f = await addFind({ at, spot, species: badgeByKey(badge)?.species ?? (badgeFor(handed?.species) ? null : handed?.species ?? null), notes: notes.trim(),
        ...(stage === null ? {} : { growth: [{ stage, at }] }) }, photos);
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
      {/* One screen, top to bottom (Stefan 18/10/2026): where he is, in one line; the pictures; the description; Save. */}
      <div class="where-row">
        <Icon name="pin" size={20} />
        <p data-test="where">{where}</p>
        <button type="button" class="small-button" aria-expanded={showMap} onClick={() => setShowMap(!showMap)} data-test="where-map">
          <Icon name="map" size={18} />{showMap ? 'Hide map' : 'Map'}</button>
      </div>
      {showMap && (
        <section class="card where-map">
          <FindsMap pick={{ spot, onPick: place }} />
          <p class="muted small">Not quite right? Tap the map or drag the pin.</p>
        </section>
      )}
      <BadgePicker value={badge} onPick={setBadge} />
      <label class="field-label" for="description">Description <span class="optional">optional</span></label>
      <textarea id="description" class="field" rows={2} value={notes} onInput={(e) => setNotes((e.target as HTMLTextAreaElement).value)}
        placeholder="For example: five caps, under the big beech" />
      {problem && <p class="card alert" role="alert">{problem}</p>}
      <p class="save-row"><button type="button" class="big-button wide" disabled={busy !== null} onClick={save}>
        {busy ?? <><Icon name="pin" size={20} />Save location</>}</button></p>
      {photos.length > 0 && <p class="muted small" data-test="photo-count">{photos.length === 1 ? '1 photo' : `${photos.length} photos`} saved with it (below).</p>}
      <h2 class="more-title">More, if you like</h2>
      <section class="card">
        <h2>Growth stage<span class="optional">optional</span></h2>
        <p class="muted small">Just coming up? Mark how far: the location then shows the stage and how many days ago you saw it.</p>
        <GrowthPicker value={stage} onPick={setStage} label="Growth stage" />
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
    </>
  );
}
