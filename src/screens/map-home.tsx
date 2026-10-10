import { useEffect, useState } from 'preact/hooks';
import { hrefFor } from '../router';
import { listFinds, type Find } from '../finds/store';
import { BackupReminder, plural, useBackup } from './backup';
import { Icon } from './icons';

// The Map (Stefan 10/10/2026): two choices — save the spot where he stands, or see his saved locations and walk back
// to one. Below them, only when it is due, the reminder to back his locations up.
export function MapHome() {
  const [finds, setFinds] = useState<Find[] | null>(null);
  const load = () => listFinds().then(setFinds, () => setFinds(null));
  useEffect(() => { void load(); }, []);
  const backup = useBackup(finds ?? [], () => void load());
  const saved = finds === null ? 'Your saved locations' : finds.length === 0 ? 'No saved locations yet'
    : `${plural(finds.length, 'saved location')}, and the way back to each`;
  return (
    <>
      <h1>Map</h1>
      <div class="map-choices">
        <a class="choice-button main" href={hrefFor({ name: 'find-new' })} data-test="save-location">
          <span class="choice-icon"><Icon name="pin-plus" size={30} /></span>
          <span class="choice-text"><strong>Save a location</strong><small>The spot where you are standing now</small></span>
        </a>
        <a class="choice-button" href={hrefFor({ name: 'finds' })} data-test="view-map">
          <span class="choice-icon"><Icon name="map" size={30} /></span>
          <span class="choice-text"><strong>View map</strong><small data-test="saved-count">{saved}</small></span>
        </a>
      </div>
      {finds && <BackupReminder b={backup} />}
    </>
  );
}
