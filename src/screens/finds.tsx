import { useEffect, useMemo, useState } from 'preact/hooks';
import { hrefFor } from '../router';
import { listFinds, photosOf, photoAddress, type Find } from '../finds/store';
import { sayAccuracy } from '../finds/geo';
import { speciesNames } from '../species-names';
import { FindsMap, type Pin } from './finds-map';
import { BackupSection, useBackup } from './backup';
import { Icon } from './icons';
import { findLabel } from '../finds/labels';
import { ALL, NO_FILTER, filterFinds, monthName, speciesChoices, type FindFilter } from '../finds/filters';

// View map (spec 7; Stefan 10/10/2026): his saved locations as pins on his own map, his position, and the list, newest
// first — each with "Take me there". Everything here lives on this phone only. (In the code a saved location is still
// a "find": the store and the backup file keep that name, so older backups restore.)
export const sayWhen = (iso: string) => new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

export function useNames(): Map<string, string> {
  const [names, setNames] = useState(new Map<string, string>());
  useEffect(() => { speciesNames().then((n) => setNames(new Map(n.map((x) => [x.name, x.english])))); }, []);
  return names;
}

export { findLabel };

/** The first photo of a saved location, small. */
export function Thumb({ find }: { find: Find }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let url: string | null = null;
    let gone = false;
    photosOf(find).then((ps) => { if (!gone && ps[0]) { url = photoAddress(ps[0]); setSrc(url); } });
    return () => { gone = true; if (url) URL.revokeObjectURL(url); };
  }, [find.id]);
  return src ? <img src={src} alt="" /> : <span class="no-photo"><Icon name="pin" size={22} /></span>;
}

export function Finds() {
  const [finds, setFinds] = useState<Find[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const names = useNames();
  const load = () => listFinds().then(setFinds, () => setProblem('The saved locations on this phone could not be read.'));
  useEffect(() => { void load(); }, []);
  const backup = useBackup(finds ?? [], () => void load());
  const [filter, setFilter] = useState<FindFilter>(NO_FILTER);
  const now = useMemo(() => new Date(), []);
  const shown = useMemo(() => filterFinds(finds ?? [], filter, now), [finds, filter, now]);
  const choices = useMemo(() => speciesChoices(finds ?? [], names), [finds, names]);
  // The species choice only once a saved location has been named as a species (on its page).
  const named = (finds ?? []).some((f) => f.species);
  const filtered = filter.species !== ALL || filter.pastYears;
  const pins = useMemo<Pin[]>(() => shown.filter((f) => f.spot).map((f) => ({
    id: f.id, lat: f.spot!.lat, lon: f.spot!.lon, label: findLabel(f, names), when: sayWhen(f.at),
    href: hrefFor({ name: 'find', id: f.id }), goHref: hrefFor({ name: 'find-go', id: f.id }), accuracy: f.spot!.accuracy,
  })), [shown, names]);
  return (
    <>
      <div class="title-row">
        <h1>View map</h1>
        <a class="small-button" href={hrefFor({ name: 'find-new' })}><Icon name="plus" size={18} />Save a location</a>
      </div>
      <FindsMap pins={pins} key={filtered ? JSON.stringify(filter) : 'all'} locate tall />
      <p class="muted small">Your saved locations are on this phone only. The blue dot is you. Tap a pin for the way back.
        Areas you have looked at with a signal stay on the map without one.</p>
      {problem && <p class="card alert" role="alert">{problem}</p>}
      {finds && finds.length > 0 && (
        <div class="find-filters" data-test="find-filters">
          {named && (
            <select class="field" aria-label="Which locations to show" value={filter.species}
              onChange={(e) => setFilter({ ...filter, species: (e.target as HTMLSelectElement).value })}>
              <option value={ALL}>All species</option>
              {choices.map((c) => <option value={c.value} key={c.value}>{c.label} ({c.count})</option>)}
            </select>
          )}
          <label class="check">
            <input type="checkbox" checked={filter.pastYears} onChange={(e) => setFilter({ ...filter, pastYears: (e.target as HTMLInputElement).checked })} />
            {' '}{monthName(now)} in past years
          </label>
          {filtered && <p class="muted small" data-test="filter-count">Showing {shown.length} of {finds.length}{' '}
            <button type="button" class="link-button" onClick={() => setFilter(NO_FILTER)}>Show all</button></p>}
        </div>
      )}
      {finds && finds.length === 0 && <p class="card">No saved locations yet. “Save a location” keeps the spot where you
        stand, with a description and a photo if you like. It works without a signal.</p>}
      {finds && filtered && shown.length === 0 && (
        <p class="card" data-test="filter-empty">{filter.pastYears ? `Nothing saved in ${monthName(now)} in earlier years${filter.species !== ALL ? ' for this species' : ''} yet.`
          : 'No saved locations of this species yet.'}</p>
      )}
      {shown.map((f) => (
        <div class="row loc-row" data-test="find-row" key={f.id}>
          <a class="row-main" href={hrefFor({ name: 'find', id: f.id })}>
            <Thumb find={f} />
            <span class="grow">
              <span class="row-title">{findLabel(f, names)}</span>
              <span class="note">{sayWhen(f.at)} · {f.spot ? sayAccuracy(f.spot.accuracy) : 'no position'}</span>
            </span>
          </a>
          {f.spot && (
            <a class="go-link" href={hrefFor({ name: 'find-go', id: f.id })} aria-label={`Take me there: ${findLabel(f, names)}`}>
              <Icon name="navigate" size={20} /><span>Go</span>
            </a>
          )}
        </div>
      ))}
      {finds && <BackupSection b={backup} count={finds.length} />}
    </>
  );
}
