import { useEffect, useMemo, useState } from 'preact/hooks';
import { hrefFor } from '../router';
import { listFinds, type Find } from '../finds/store';
import { speciesNames } from '../species-names';
import { FindsMap, type Pin } from './finds-map';
import { BackupSection, useBackup } from './backup';
import { Icon } from './icons';
import { BackLink } from './back-link';
import { findLabel } from '../finds/labels';
import { askForCompassOnTap } from '../finds/compass';
import { ALL, NO_FILTER, filterFinds, monthName, speciesChoices, type FindFilter } from '../finds/filters';

// View map (spec 7; Stefan 10/10/2026): his saved locations as pins on his own map, his position, and the list, newest
// first — each with "Take me there". Everything here lives on this phone only. (In the code a saved location is still
// a "find": the store and the backup file keep that name, so older backups restore.)
export const sayWhen = (iso: string) => new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
/** When, in the list's one-liners — short, so his note has the room: "10 Oct 14:05" this year, "10 Oct 2025" before. */
export function sayListWhen(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return d.getFullYear() === now.getFullYear() ? `${day} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : `${day} ${d.getFullYear()}`;
}
/** A location's note on one line (Stefan 10/10/2026: "looks like porcini…"): the whole description, its lines joined;
 * without one, the species he named, else "No description". */
function oneLine(f: Find, names: Map<string, string>): { text: string; described: boolean } {
  const note = f.notes.split('\n').map((l) => l.trim()).filter(Boolean).join(' · ');
  if (note) return { text: note, described: true };
  return { text: f.species ? names.get(f.species) ?? f.species : 'No description', described: false };
}

export function useNames(): Map<string, string> {
  const [names, setNames] = useState(new Map<string, string>());
  useEffect(() => { speciesNames().then((n) => setNames(new Map(n.map((x) => [x.name, x.english])))); }, []);
  return names;
}

export { findLabel };

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
      <BackLink href={hrefFor({ name: 'map' })} label="Map" />
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
      {shown.length > 0 && <h2>Saved locations <span class="muted">({shown.length})</span></h2>}
      {shown.length > 0 && (
        // One line each, newest first (Stefan 10/10/2026): when it was saved and his note; a tap opens it, Go walks back.
        <div class="loc-list">
          {shown.map((f) => {
            const line = oneLine(f, names);
            return (
              <div class="loc-line" data-test="find-row" key={f.id}>
                <a class="loc-main" href={hrefFor({ name: 'find', id: f.id })}>
                  <span class="loc-date" title={sayWhen(f.at)}>{sayListWhen(f.at, now)}</span>
                  <span class={`loc-desc${line.described ? '' : ' none'}`}>{line.text}</span>
                </a>
                {f.spot && (
                  <a class="loc-go" href={hrefFor({ name: 'find-go', id: f.id })} aria-label={`Take me there: ${findLabel(f, names)}`}
                    onClick={askForCompassOnTap}>
                    <Icon name="navigate" size={16} />Go
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
      {finds && <BackupSection b={backup} count={finds.length} />}
    </>
  );
}
