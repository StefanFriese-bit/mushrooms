import { useEffect, useMemo, useState } from 'preact/hooks';
import { hrefFor } from '../router';
import { listFinds, type Find } from '../finds/store';
import { speciesNames } from '../species-names';
import { FindsMap, type Pin } from './finds-map';
import { BackupSection, useBackup } from './backup';
import { Icon } from './icons';
import { BackLink } from './back-link';
import { findLabel } from '../finds/labels';
import { growthWords } from '../finds/growth';
import { GrowthChip } from './growth';
import { askForCompassOnTap } from '../finds/compass';
import { ALL, NO_FILTER, filterFinds, monthName, speciesChoices, type FindFilter } from '../finds/filters';
import { followHere } from '../finds/device';
import { sayDistance, type Fix } from '../finds/geo';
import { planWalk, walkLine, type Stop } from '../finds/walk';
import { clearWalk, saveWalk, walkOf } from '../finds/walk-store';
import { badgesOfFind } from '../finds/badges';
import { pastTrails, PAST_ON_MAP, useTracks } from './track';
const SHOW_WALKS = 'show-walks';
import { PAST_COLOURS, sayKm, trackStats } from '../finds/track';
import { BadgeIcons } from './badges';
import { byMonth } from '../finds/months';
const OPEN_MONTHS = 'open-months';

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
  // Where he stands: drawn as the blue dot with how exact it is, and framed with his pins the first time it is known,
  // so the map shows where he is among them (Stefan 18/10/2026: "I should also be able to see my location relative to
  // all of those"). Until then the dot only came from the map's own locate button, which starts itself only when there
  // are no pins — with pins on the map he never saw himself. The planned walk starts from here too.
  const [here, setHere] = useState<Fix | null>(null);
  useEffect(() => followHere(setHere, () => {}), []);
  const [walk, setWalk] = useState(() => walkOf());
  const now = useMemo(() => new Date(), []);
  const shown = useMemo(() => filterFinds(finds ?? [], filter, now, names), [finds, filter, now, names]);
  const choices = useMemo(() => speciesChoices(finds ?? [], names), [finds, names]);
  // The species choice only once a saved location has been named as a species (on its page).
  const named = (finds ?? []).some((f) => f.species);
  const filtered = filter.species !== ALL || filter.pastYears || filter.text.trim() !== '';
  // The locations he could walk to: the ones the filter shows that have a spot.
  const walkable = useMemo<Stop[]>(() => shown.filter((f) => f.spot).map((f) => ({ id: f.id, lat: f.spot!.lat, lon: f.spot!.lon })), [shown]);
  const onWalk = useMemo(() => new Map((walk?.order ?? []).map((s, i) => [s.id, i + 1])), [walk]);
  // On a walk the list follows the walk; otherwise it stays newest first.
  const listed = useMemo(() => (walk ? [...shown].sort((a, b) => (onWalk.get(a.id) ?? 99) - (onWalk.get(b.id) ?? 99)) : shown), [shown, walk, onWalk]);
  const pins = useMemo<Pin[]>(() => shown.filter((f) => f.spot).map((f) => ({
    id: f.id, lat: f.spot!.lat, lon: f.spot!.lon, label: findLabel(f, names), when: sayWhen(f.at), growth: growthWords(f.growth, now) ?? undefined,
    href: hrefFor({ name: 'find', id: f.id }), goHref: hrefFor({ name: 'find-go', id: f.id }), accuracy: f.spot!.accuracy,
    stop: onWalk.get(f.id), badges: badgesOfFind(f).map((b) => b.key),
  })), [shown, names, now, onWalk]);
  // His last walks on this map too (Stefan 16/10/2026: "where the last four times I walked is"), remembered on this phone.
  const tracks = useTracks();
  const [showWalks, setShowWalks] = useState(() => { try { return localStorage.getItem(SHOW_WALKS) === '1'; } catch { return false; } });
  const toggleWalks = (on: boolean) => { setShowWalks(on); try { localStorage.setItem(SHOW_WALKS, on ? '1' : '0'); } catch { /* private mode */ } };
  const trails = useMemo(() => (showWalks && tracks ? pastTrails(tracks) : []), [showWalks, tracks]);
  const planTheWalk = () => {
    if (!here) return;
    setWalk(saveWalk(planWalk(here, walkable), here)); // saved as it is planned: the walk outlives this screen
  };
  const dropTheWalk = () => { clearWalk(); setWalk(null); };
  // Which month drawers he has open, kept on this phone so coming back from a location finds them as he left them.
  const [openMonths, setOpenMonths] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(OPEN_MONTHS) ?? '[]') as string[]); } catch { return new Set(); }
  });
  const toggleMonth = (key: string, open: boolean) => setOpenMonths((was) => {
    if (was.has(key) === open) return was;
    const next = new Set(was);
    if (open) next.add(key); else next.delete(key);
    try { localStorage.setItem(OPEN_MONTHS, JSON.stringify([...next])); } catch { /* private mode */ }
    return next;
  });
  // One line each, newest first (Stefan 10/10/2026): when it was saved and his note; a tap opens it, Go walks back.
  const row = (f: Find) => {
    const line = oneLine(f, names);
    const stop = onWalk.get(f.id);
    return (
      <div class="loc-line" data-test="find-row" key={f.id}>
        <a class="loc-main" href={hrefFor({ name: 'find', id: f.id })}>
          {stop && <span class="loc-stop" data-test="loc-stop">{stop}</span>}
          {/* The growth chip under the date, so his note keeps the line's width. */}
          <span class="loc-when">
            <span class="loc-date" title={sayWhen(f.at)}>{sayListWhen(f.at, now)}</span>
            <GrowthChip log={f.growth} now={now} />
          </span>
          <BadgeIcons badges={badgesOfFind(f)} size={26} />
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
  };

  return (
    <>
      <BackLink href={hrefFor({ name: 'map' })} label="Map" />
      <div class="title-row">
        <h1>View map</h1>
        <a class="small-button" href={hrefFor({ name: 'find-new' })}><Icon name="plus" size={18} />Save a location</a>
      </div>
      <FindsMap pins={pins} key={filtered ? JSON.stringify(filter) : 'all'} locate tall
        route={walk ? walkLine(walk.start, walk) : null} trails={trails} frameTrails={showWalks} here={here} />
      {tracks && tracks.length > 0 && (
        <p class="show-walks">
          <label class="check"><input type="checkbox" checked={showWalks} data-test="show-walks"
            onChange={(e) => toggleWalks((e.target as HTMLInputElement).checked)} />{' '}Show my last {Math.min(PAST_ON_MAP, tracks.length)} walks</label>
          {showWalks && tracks.slice(0, PAST_ON_MAP).map((t, i) => (
            <span class="walk-chip" key={t.id}><span class="swatch" style={{ background: PAST_COLOURS[i] }} />
              {new Date(t.start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · {sayKm(trackStats(t).distanceM)}</span>
          ))}
        </p>
      )}
      <p class="muted small">Your saved locations are on this phone only. The blue dot is you. Tap a pin for the way back.
        Areas you have looked at with a signal stay on the map without one.</p>
      {problem && <p class="card alert" role="alert">{problem}</p>}
      {finds && finds.length > 0 && (
        <div class="find-filters" data-test="find-filters">
          {/* A word out of his own descriptions (Stefan 13/10/2026): the map and the list show only those locations,
              and each one still has Go. */}
          <input class="field find-search" type="search" inputMode="search" value={filter.text} data-test="find-search"
            aria-label="Find a word in your locations" placeholder="A word in your locations, e.g. penny bun"
            onInput={(e) => setFilter({ ...filter, text: (e.target as HTMLInputElement).value })} />
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
          {/* The walk round them, in the order that keeps it short (Stefan 13/10/2026). */}
          {walkable.length > 1 && !walk && (
            <p><button type="button" class="small-button" onClick={planTheWalk} disabled={!here} data-test="plan-walk">
              <Icon name="navigate" size={18} />Plan a walk round these {walkable.length}</button>
              {!here && <span class="muted small"> Waiting for your position…</span>}</p>
          )}
          {walk && (
            <p class="card walk-card" data-test="walk-card">
              <strong>Your walk: {walk.order.length} stops, {sayDistance(walk.total)}</strong>
              <span class="muted small">From where you are now, in the order that keeps the walking short. Then{' '}
                {sayDistance(walk.backToStart)} back to where you started. The line is straight over the ground, not a path —
                follow the arrow on each stop.</span>
              <span class="walk-card-do">
                <a class="small-button primary" href={hrefFor({ name: 'find-go', id: walk.order[0].id })} onClick={askForCompassOnTap}
                  data-test="walk-start"><Icon name="navigate" size={16} />Start: stop 1</a>
                <button type="button" class="small-button" onClick={dropTheWalk} data-test="walk-clear">Clear the walk</button>
              </span>
            </p>
          )}
        </div>
      )}
      {finds && finds.length === 0 && <p class="card">No saved locations yet. “Save a location” keeps the spot where you
        stand, with a description and a photo if you like. It works without a signal.</p>}
      {finds && filtered && shown.length === 0 && (
        <p class="card" data-test="filter-empty">{filter.text.trim() ? `No saved location mentions “${filter.text.trim()}”.`
          : filter.pastYears ? `Nothing saved in ${monthName(now)} in earlier years${filter.species !== ALL ? ' for this species' : ''} yet.`
          : 'No saved locations of this species yet.'}</p>
      )}
      {shown.length > 0 && <h2>{walk ? 'Your walk' : 'Saved locations'} <span class="muted">({shown.length})</span></h2>}
      {shown.length > 0 && (walk || filtered ? (
        // A walk or a search: the list IS the answer, so it stays one open list (a walk in its stop order).
        <div class="loc-list">{listed.map(row)}</div>
      ) : (
        // Otherwise a drawer per month, all closed until he opens one (Stefan 24/10/2026); every pin stays on the map.
        <div class="loc-months" data-test="loc-months">
          {byMonth(listed).map((m) => (
            <details class="loc-month" data-test="loc-month" data-month={m.key} key={m.key} open={openMonths.has(m.key)}
              onToggle={(e) => toggleMonth(m.key, (e.currentTarget as HTMLDetailsElement).open)}>
              <summary><Icon name="chevron" size={18} /><span class="loc-month-name">{m.label}</span>
                <span class="loc-month-count">{m.finds.length}</span></summary>
              <div class="loc-list">{m.finds.map(row)}</div>
            </details>
          ))}
        </div>
      ))}
      {finds && <BackupSection b={backup} count={finds.length} finds={finds} />}
    </>
  );
}
