import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { hrefFor } from '../router';
import { addFind, type Spot } from '../finds/store';
import { followSpot, shrinkPhoto, takeHandOver } from '../finds/device';
import { sayAccuracy } from '../finds/geo';
import { speciesNames, type SpeciesName } from '../species-names';
import { FindsMap } from './finds-map';

// Add a find (spec 7): the GPS spot (getting better while the screen is open), or a pin he places by hand; photos
// from the camera or the library, scaled to 1,600 px; what it is, or "not identified yet"; notes. Saves with no
// signal. Photos handed over by a scan arrive already filled in.
export function FindNew() {
  const handed = useMemo(() => takeHandOver(), []);
  const [spot, setSpot] = useState<Spot | null>(null);
  const [where, setWhere] = useState('Finding your position…');
  const placed = useRef(false);
  const [photos, setPhotos] = useState<Blob[]>(handed?.photos ?? []);
  const [species, setSpecies] = useState(handed?.species ?? '');
  const [notes, setNotes] = useState('');
  const [names, setNames] = useState<SpeciesName[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const previews = useMemo(() => photos.map((p) => URL.createObjectURL(p)), [photos]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);
  useEffect(() => { speciesNames().then(setNames); }, []);
  useEffect(() => followSpot(
    (s) => { if (!placed.current) { setSpot(s); setWhere(`Your position, ${sayAccuracy(s.accuracy)}`); } },
    (message) => { if (!placed.current) setWhere(message); },
  ), []);
  const place = (lat: number, lon: number) => {
    placed.current = true;
    setSpot({ lat, lon, accuracy: null });
    setWhere('Placed by hand on the map');
  };
  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy('Preparing the photos…');
    try {
      const small = await Promise.all([...files].map((f) => shrinkPhoto(f)));
      setPhotos((ps) => [...ps, ...small]);
    } catch {
      setProblem('One of the photos could not be read.');
    } finally {
      setBusy(null);
    }
  };
  const save = async () => {
    if (!spot && !confirm('There is no spot yet. Save the find without one?')) return;
    setBusy('Saving…');
    try {
      const f = await addFind({ at: new Date().toISOString(), spot, species: species || null, notes: notes.trim() }, photos);
      location.hash = hrefFor({ name: 'find', id: f.id });
    } catch {
      setBusy(null);
      setProblem('The find could not be saved on this phone. Nothing was stored; please try again.');
    }
  };
  return (
    <>
      <h1>Add a find</h1>
      <h2>Where</h2>
      <p data-test="where">{where}</p>
      <FindsMap pick={{ spot, onPick: place }} />
      <p class="muted small">Tap the map or drag the pin to move it.</p>
      <h2>Photos</h2>
      <div class="thumbs">
        {previews.map((u, i) => (
          <figure key={u}>
            <img src={u} alt={`Photo ${i + 1}`} />
            <button type="button" class="small-button" onClick={() => setPhotos((ps) => ps.filter((_, k) => k !== i))}>Remove</button>
          </figure>
        ))}
      </div>
      <label class="small-button file-button">Take or choose photos
        <input type="file" accept="image/*" multiple onChange={(e) => addPhotos((e.target as HTMLInputElement).files)} />
      </label>
      <h2>What it is</h2>
      <select class="field" value={species} onChange={(e) => setSpecies((e.target as HTMLSelectElement).value)} aria-label="What it is">
        <option value="">Not identified yet</option>
        {names.map((n) => <option value={n.name} key={n.name}>{n.english} ({n.name})</option>)}
      </select>
      <h2>Notes</h2>
      <textarea class="field" rows={3} value={notes} onInput={(e) => setNotes((e.target as HTMLTextAreaElement).value)}
        aria-label="Notes" placeholder="Under which trees, how many, smell…" />
      {problem && <p class="card" role="alert">{problem}</p>}
      <p><button type="button" class="big-button" disabled={busy !== null} onClick={save}>{busy ?? 'Save the find'}</button></p>
    </>
  );
}
