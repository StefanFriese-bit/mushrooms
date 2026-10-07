import { useEffect, useMemo, useState } from 'preact/hooks';
import { hrefFor } from '../router';
import { listFinds, photosOf, photoAddress, type Find } from '../finds/store';
import { sayAccuracy } from '../finds/geo';
import { speciesNames } from '../species-names';
import { FindsMap, type Pin } from './finds-map';
import { BackupReminder, BackupSection, useBackup } from './backup';

// Finds (spec 7): his own map — his finds as pins, his position — and the list, newest first. Everything here lives on
// this phone only.
export const sayWhen = (iso: string) => new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

export function useNames(): Map<string, string> {
  const [names, setNames] = useState(new Map<string, string>());
  useEffect(() => { speciesNames().then((n) => setNames(new Map(n.map((x) => [x.name, x.english])))); }, []);
  return names;
}
export const findLabel = (f: Find, names: Map<string, string>) => (f.species ? names.get(f.species) ?? f.species : 'Not identified yet');

/** The first photo of a find, small. */
export function Thumb({ find }: { find: Find }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let url: string | null = null;
    let gone = false;
    photosOf(find).then((ps) => { if (!gone && ps[0]) { url = photoAddress(ps[0]); setSrc(url); } });
    return () => { gone = true; if (url) URL.revokeObjectURL(url); };
  }, [find.id]);
  return src ? <img src={src} alt="" /> : <span class="no-photo" />;
}

export function Finds() {
  const [finds, setFinds] = useState<Find[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const names = useNames();
  const load = () => listFinds().then(setFinds, () => setProblem('The finds on this phone could not be read.'));
  useEffect(() => { void load(); }, []);
  const backup = useBackup(finds ?? [], () => void load());
  const pins = useMemo<Pin[]>(() => (finds ?? []).filter((f) => f.spot).map((f) => ({
    id: f.id, lat: f.spot!.lat, lon: f.spot!.lon, label: `${findLabel(f, names)} · ${sayWhen(f.at)}`, href: hrefFor({ name: 'find', id: f.id }),
  })), [finds, names]);
  return (
    <>
      <h1>Finds</h1>
      <p><a class="big-button" href={hrefFor({ name: 'find-new' })}>Add a find here</a></p>
      {finds && <BackupReminder b={backup} />}
      <FindsMap pins={pins} locate />
      <p class="muted small">Your finds stay on this phone only. The blue dot is you; areas you have looked at stay on the
        map without a signal.</p>
      {problem && <p class="card" role="alert">{problem}</p>}
      {finds && finds.length === 0 && <p class="card">No finds yet. “Add a find here” saves the spot, photos and what it
        is — it works without a signal.</p>}
      {finds?.map((f) => (
        <a class="row" data-test="find-row" href={hrefFor({ name: 'find', id: f.id })} key={f.id}>
          <Thumb find={f} />
          <div class="grow">
            <div>{findLabel(f, names)}</div>
            <div class="note">{sayWhen(f.at)} · {f.spot ? sayAccuracy(f.spot.accuracy) : 'no spot'}</div>
          </div>
        </a>
      ))}
      {finds && <BackupSection b={backup} count={finds.length} />}
    </>
  );
}
