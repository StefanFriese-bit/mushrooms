import { useEffect, useMemo, useState } from 'preact/hooks';
import { ALL_SPECIES } from '../content';
import { hrefFor } from '../router';
import { deleteFind, getFind, photosOf, photoAddress, updateFind, type Find } from '../finds/store';
import { appleMapsLink, sayAccuracy, saySpot, type LatLon } from '../finds/geo';
import { osGridRef, plusCode } from '../finds/codes';
import { speciesNames, type SpeciesName } from '../species-names';
import { FindsMap } from './finds-map';
import { findLabel, sayWhen, useNames } from './finds';

// One find (spec 7): its photos, what it is, when, where (with "Find it again" — an arrow and the distance, no signal
// needed — and Apple Maps' directions), its OS grid reference and Plus Code to copy or share, notes; what it is and the
// notes can be changed; it can be deleted.

/** The spot as references a person can read out or type into a map, to copy or share (src/finds/codes.ts). */
function References({ spot, label }: { spot: LatLon; label: string }) {
  const [said, setSaid] = useState<string | null>(null);
  const grid = osGridRef(spot);
  const code = plusCode(spot);
  const text = `${label}: ${grid ? `OS grid ${grid} · ` : ''}Plus Code ${code} · ${saySpot(spot)}`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setSaid('Copied.'); } catch { setSaid('This phone did not allow copying.'); }
  };
  const share = async () => {
    try { await navigator.share({ text }); } catch { /* he closed the share sheet */ }
  };
  return (
    <div class="card refs" data-test="refs">
      <p><strong>OS grid reference</strong>{' '}{grid ? <code data-test="os-grid">{grid}</code> : <span class="muted">none (outside Great Britain)</span>}
        {grid && <span class="muted small"> (to 10 m)</span>}</p>
      <p><strong>Plus Code</strong> <code data-test="plus-code">{code}</code> <span class="muted small">(Google Maps finds it)</span></p>
      <p><button type="button" class="small-button" onClick={copy}>Copy</button>{' '}
        {'share' in navigator && <button type="button" class="small-button" onClick={share}>Share</button>}
        {said && <span class="muted small"> {said}</span>}</p>
    </div>
  );
}
export function FindPage({ id }: { id: string }) {
  const [find, setFind] = useState<Find | null | undefined>(undefined);
  const [srcs, setSrcs] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [species, setSpecies] = useState('');
  const [notes, setNotes] = useState('');
  const [all, setAll] = useState<SpeciesName[]>([]);
  const names = useNames();
  useEffect(() => { getFind(id).then((f) => setFind(f ?? null), () => setFind(null)); }, [id]);
  useEffect(() => {
    if (!find) return;
    let urls: string[] = [];
    let gone = false;
    photosOf(find).then((ps) => { if (!gone) { urls = ps.map(photoAddress); setSrcs(urls); } });
    return () => { gone = true; urls.forEach((u) => URL.revokeObjectURL(u)); };
  }, [find?.id]);
  useEffect(() => { if (editing && all.length === 0) speciesNames().then(setAll); }, [editing]);
  const page = useMemo(() => (find?.species ? ALL_SPECIES.find((s) => s.scientific === find.species) : undefined), [find?.species]);
  if (find === undefined) return <p class="muted">Loading…</p>;
  if (find === null) return <><h1>Not found</h1><p>That find is not on this phone. <a href={hrefFor({ name: 'finds' })}>Back to your finds</a></p></>;
  const save = async () => {
    setFind(await updateFind(find.id, { species: species || null, notes: notes.trim() }));
    setEditing(false);
  };
  const remove = async () => {
    if (!confirm('Delete this find and its photos from this phone? This cannot be undone.')) return;
    await deleteFind(find);
    location.hash = hrefFor({ name: 'finds' });
  };
  return (
    <>
      {srcs.length > 0 && (
        <div class="photos">
          {srcs.map((s, i) => <figure key={s}><img src={s} alt={`Photo ${i + 1}`} /></figure>)}
        </div>
      )}
      <h1>{findLabel(find, names)}</h1>
      <p class="muted">Found {sayWhen(find.at)}</p>
      {page && (
        <p><a href={hrefFor({ name: 'species', slug: page.slug })}>Its page in the guide</a>{page.lookalikes.length > 0 && <> ·{' '}
          <a href={hrefFor({ name: 'check', slug: page.slug })}>Check it against its lookalikes</a></>}</p>
      )}
      <h2>Where</h2>
      {find.spot ? (
        <>
          <p>{saySpot(find.spot)} · {sayAccuracy(find.spot.accuracy)}</p>
          <p><a class="big-button" href={hrefFor({ name: 'find-go', id: find.id })} data-test="find-again">Find it again</a></p>
          <p class="small">Arrow and distance on this phone, no signal needed. Or <a href={appleMapsLink(find.spot)}
            data-test="take-me-there">take me there in Apple Maps</a> (paths; needs signal).</p>
          <References spot={find.spot} label={findLabel(find, names)} />
          <FindsMap pins={[{ id: find.id, lat: find.spot.lat, lon: find.spot.lon, label: findLabel(find, names),
            href: hrefFor({ name: 'find', id: find.id }), accuracy: find.spot.accuracy }]} locate />
        </>
      ) : <p>No spot was saved with this find.</p>}
      <h2>Notes</h2>
      {editing ? (
        <>
          <select class="field" value={species} onChange={(e) => setSpecies((e.target as HTMLSelectElement).value)} aria-label="What it is">
            <option value="">Not identified yet</option>
            {all.map((n) => <option value={n.name} key={n.name}>{n.english} ({n.name})</option>)}
          </select>
          <textarea class="field" rows={3} value={notes} onInput={(e) => setNotes((e.target as HTMLTextAreaElement).value)} aria-label="Notes" />
          <p><button type="button" class="small-button" onClick={save}>Save changes</button>{' '}
            <button type="button" class="small-button" onClick={() => setEditing(false)}>Cancel</button></p>
        </>
      ) : (
        <>
          <p>{find.notes || <span class="muted">None.</span>}</p>
          <p><button type="button" class="small-button" onClick={() => { setSpecies(find.species ?? ''); setNotes(find.notes); setEditing(true); }}>
            Change what it is or the notes</button></p>
        </>
      )}
      <p class="card muted small">Before eating anything you found, get it confirmed by someone who knows mushrooms, in
        person, or on iNaturalist.</p>
      <p><button type="button" class="small-button danger" onClick={remove}>Delete this find</button></p>
    </>
  );
}
