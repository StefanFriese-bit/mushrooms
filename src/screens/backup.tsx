import { useEffect, useState } from 'preact/hooks';
import { allPhotos, listFinds, restoreFinds, type Find } from '../finds/store';
import { BackupError, backupName, backupReminder, lastBackup, noteBackup, packBackup, readBackup } from '../finds/backup';
import { OWNER, REPO, asFinds, cleanKey, cloudWarning, fetchLocations, forgetKey, needsSending, noteRestored, onCloud, readCloud, setKey, trySend, type CloudState } from '../finds/cloud-backup';
import { sayWhen } from './finds';

// Backup and restore of his saved locations (spec 7): one file to iCloud Drive — through the iPhone's share sheet
// ("Save to Files"), or as a download where a phone cannot share files — and restoring by opening that file. A reminder
// shows when locations are not in a backup and the last one is more than a week old. (In the code a saved location is
// still a "find": the store and the backup file keep that name, so older backups restore.)
// Since 14/10/2026 the AUTOMATIC backup (src/finds/cloud-backup.ts) sits above it: the locations, never the photos, to
// a private repository in the company's GitHub space, by themselves. Its state is shown here and on the Map page.
export const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

/** The automatic backup's state, kept up to date as pushes happen. */
export function useCloud(): CloudState {
  const [state, setState] = useState(readCloud);
  useEffect(() => onCloud(setState), []);
  return state;
}

export function useBackup(finds: Find[], onRestored: () => void) {
  const [note, setNote] = useState(lastBackup);
  const [busy, setBusy] = useState<string | null>(null);
  const [said, setSaidText] = useState<string | null>(null);
  /** Which block spoke last, so the message shows under the button that was pressed. */
  const [saidBy, setSaidBy] = useState<'cloud' | 'file'>('file');
  const setSaid = (text: string | null, by: 'cloud' | 'file' = 'file') => { setSaidText(text); setSaidBy(by); };
  const cloud = useCloud();
  const remind = backupReminder(finds.map((f) => f.id), note, new Date(), cloud.sent);
  const warning = cloudWarning(finds, cloud, new Date());

  const save = async () => {
    setBusy('Making the backup file…');
    setSaid(null);
    try {
      const made = new Date();
      const bytes = packBackup(finds, await allPhotos(), made).slice(); // a plain copy, as a File wants
      const file = new File([bytes], backupName(made), { type: 'application/zip' });
      let shared = false;
      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'Mycelium Network backup' });
          shared = true;
        } catch (e) {
          if ((e as DOMException)?.name === 'AbortError') { setSaid('No backup was saved: the share sheet was closed.'); return; }
        }
      }
      if (!shared) {
        const url = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }
      const next = { at: made.toISOString(), ids: finds.map((f) => f.id) };
      noteBackup(next);
      setNote(next);
      setSaid(shared ? `Backup of ${plural(finds.length, 'location')} made. If you chose "Save to Files", pick iCloud Drive so it is safe off the phone.`
        : `Backup of ${plural(finds.length, 'location')} saved as ${file.name} (in Downloads). In the Files app, move it to iCloud Drive.`);
    } catch {
      setSaid('The backup could not be made. Your saved locations are unchanged.');
    } finally {
      setBusy(null);
    }
  };

  const restore = async (file: File | undefined) => {
    if (!file) return;
    setBusy('Checking the backup file…');
    setSaid(null);
    try {
      const backup = readBackup(new Uint8Array(await file.arrayBuffer()));
      const { added, already } = await restoreFinds(backup.finds, backup.photos);
      setSaid(`Restored ${plural(added, 'location')}${already ? `; ${plural(already, 'location')} ${already === 1 ? 'was' : 'were'} already on this phone and left as ${already === 1 ? 'it was' : 'they were'}` : ''}.`);
      onRestored();
    } catch (e) {
      setSaid(e instanceof BackupError ? e.message : "That file can't be restored. Nothing was changed.");
    } finally {
      setBusy(null);
    }
  };
  // The automatic backup: the key (once), a push now, a restore from GitHub, and forgetting the key.
  const saveKey = async (typed: string) => {
    const key = cleanKey(typed);
    if (!key) { setSaid('That does not look like a GitHub key. Paste the whole key, with nothing else.', 'cloud'); return false; }
    setBusy('Asking GitHub whether the key opens the backup…');
    setSaid(null, 'cloud');
    try {
      const r = await setKey(key, listFinds);
      setSaid(r.ok ? 'The key is kept on this phone. Your locations now go to GitHub by themselves.' : `GitHub did not accept the key: ${r.why}. Nothing was kept.`, 'cloud');
      return r.ok;
    } finally { setBusy(null); }
  };
  const cloudNow = async () => {
    setBusy('Sending your locations to GitHub…');
    setSaid(null, 'cloud');
    try {
      await trySend(listFinds, { force: true });
      const s = readCloud();
      setSaid(s.failed ? `Not sent: ${s.failed.why}.` : s.held ? s.held : needsSending(finds, s) ? 'Nothing was sent.' : `Your ${plural(finds.length, 'location')} ${finds.length === 1 ? 'is' : 'are'} on GitHub.`, 'cloud');
    } finally { setBusy(null); }
  };
  const cloudRestore = async () => {
    setBusy('Reading the backup on GitHub…');
    setSaid(null, 'cloud');
    try {
      const locations = await fetchLocations(readCloud());
      noteRestored(locations, await listFinds()); // the phone will hold what GitHub holds: nothing to push back
      const { added, already } = await restoreFinds(asFinds(locations), []);
      setSaid(`Restored ${plural(added, 'location')} from GitHub${already ? `; ${plural(already, 'location')} ${already === 1 ? 'was' : 'were'} already on this phone and left as ${already === 1 ? 'it was' : 'they were'}` : ''}. Photos are not in the automatic backup.`, 'cloud');
      onRestored();
    } catch (e) {
      setSaid(e instanceof BackupError ? e.message : 'The backup on GitHub could not be read. Nothing was changed.', 'cloud');
    } finally { setBusy(null); }
  };
  const cloudForget = () => {
    if (!window.confirm('Forget the GitHub key on this phone? Your locations stay on the phone and on GitHub; they just stop going there by themselves.')) return;
    forgetKey();
    setSaid('The key is forgotten. Nothing goes to GitHub from this phone until a key is pasted again.', 'cloud');
  };
  return { note, busy, said, saidBy, remind, warning, cloud, save, restore, saveKey, cloudNow, cloudRestore, cloudForget };
}

/** The Map page's warning: changes have waited more than a day without reaching GitHub. */
export function CloudWarning({ b }: { b: ReturnType<typeof useBackup> }) {
  if (!b.warning) return null;
  return (
    <div class="card alert" data-test="cloud-warning" role="alert">
      <p><strong>{b.warning}</strong> Your newest locations are on this phone only until it gets through.</p>
      <p><button type="button" class="small-button" onClick={b.cloudNow} disabled={b.busy !== null}>Try now</button></p>
    </div>
  );
}

/** The "working…" and the outcome, under the block whose button was pressed. */
function Said({ b, by }: { b: ReturnType<typeof useBackup>; by: 'cloud' | 'file' }) {
  if (b.saidBy !== by) return null;
  return (<>
    {b.busy && <p class="muted small" role="status">{b.busy}</p>}
    {b.said && <p class="small" role="status" data-test="backup-said">{b.said}</p>}
  </>);
}

/** The automatic backup, at the top of the Backup section. */
function CloudBackup({ b, finds }: { b: ReturnType<typeof useBackup>; finds: Find[] }) {
  const [setting, setSetting] = useState(false);
  const [typed, setTyped] = useState('');
  const c = b.cloud;
  const save = async () => { if (await b.saveKey(typed)) { setTyped(''); setSetting(false); } };
  if (!c.key) {
    return (
      <div class="cloud" data-test="cloud">
        <h3>Automatic backup</h3>
        <p class="small">Your saved locations can go to a private place on GitHub by themselves — every time one is saved,
          changed or removed, as soon as the phone has a signal. Photos are not copied; the backup file below has them.</p>
        {!setting && <p><button type="button" class="small-button" onClick={() => setSetting(true)} data-test="cloud-setup">Set it up</button></p>}
        {setting && (
          <div class="cloud-setup">
            <p class="small">On GitHub, signed in as the company account: Settings › Developer settings › Personal access tokens ›
              Fine-grained tokens › Generate new token. Repository access: only <strong>{OWNER}/{REPO}</strong>. Permissions:
              Contents — Read and write. Copy the key and paste it here once. It stays on this phone.</p>
            <input class="field cloud-key" type="text" value={typed} aria-label="GitHub key" placeholder="Paste the GitHub key"
              autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck={false} data-test="cloud-key"
              onInput={(e) => setTyped((e.target as HTMLInputElement).value)} />
            <p class="backup-actions">
              <button type="button" class="small-button primary" onClick={save} disabled={b.busy !== null || typed.trim() === ''} data-test="cloud-save-key">Save key</button>{' '}
              <button type="button" class="small-button" onClick={() => { setSetting(false); setTyped(''); }}>Cancel</button>
            </p>
          </div>
        )}
        <Said b={b} by="cloud" />
      </div>
    );
  }
  const waiting = needsSending(finds, c);
  return (
    <div class="cloud" data-test="cloud">
      <h3>Automatic backup</h3>
      <p class="small" data-test="cloud-status">
        <strong>On.</strong> Your saved locations go to GitHub by themselves ({OWNER}/{REPO}, private); photos stay on the phone.{' '}
        {c.sent ? `Last reached GitHub: ${sayWhen(c.sent.at)} (${plural(c.sent.ids.length, 'location')}).` : 'Nothing has reached GitHub yet.'}
        {waiting && !c.failed && ' Changes are on their way.'}
      </p>
      {c.failed && <p class="small alert-text" data-test="cloud-failed">Last try {sayWhen(c.failed.at)}: {c.failed.why}. It is tried again by itself.</p>}
      {c.held && !c.failed && <p class="small" data-test="cloud-held">{c.held}</p>}
      <p class="backup-actions">
        <button type="button" class="small-button" onClick={b.cloudNow} disabled={b.busy !== null} data-test="cloud-now">Back up now</button>{' '}
        <button type="button" class="small-button" onClick={b.cloudRestore} disabled={b.busy !== null} data-test="cloud-restore">Restore from GitHub</button>{' '}
        <button type="button" class="link-button small" onClick={b.cloudForget} disabled={b.busy !== null} data-test="cloud-forget">Forget the key</button>
      </p>
      <Said b={b} by="cloud" />
    </div>
  );
}

/** The reminder on the Map page: only when locations are not in a backup and the last one is over a week old. */
export function BackupReminder({ b }: { b: ReturnType<typeof useBackup> }) {
  if (b.remind === 0) return null;
  return (
    <div class="card" data-test="backup-reminder">
      <p><strong>{plural(b.remind, 'location')} {b.remind === 1 ? 'is' : 'are'} not in a backup yet.</strong> Your saved
        locations are kept only on this phone. A backup file keeps them safe if the phone is lost.</p>
      <p><button type="button" class="small-button" onClick={b.save} disabled={b.busy !== null}>Back up now</button></p>
    </div>
  );
}

/** The backup section at the foot of View map: the automatic backup, then the backup file. */
export function BackupSection({ b, count, finds }: { b: ReturnType<typeof useBackup>; count: number; finds: Find[] }) {
  return (
    <section class="card" data-test="backup">
      <h2>Backup</h2>
      <CloudBackup b={b} finds={finds} />
      <h3>Backup file</h3>
      <p class="small">Your saved locations and their photos, in one file to keep in iCloud Drive. To restore — on this
        phone or a new one — open that file here.</p>
      <p class="muted small">{b.note ? `Last backup: ${sayWhen(b.note.at)}.` : 'No backup made yet.'}</p>
      <p class="backup-actions">
        <button type="button" class="small-button" onClick={b.save} disabled={b.busy !== null || count === 0}>
          Back up {plural(count, 'location')}</button>{' '}
        <label class="small-button file-button">Restore from a backup file
          <input type="file" accept=".zip,application/zip" aria-label="Backup file to restore" disabled={b.busy !== null}
            onChange={(e) => { const input = e.target as HTMLInputElement; void b.restore(input.files?.[0]); input.value = ''; }} />
        </label>
      </p>
      <Said b={b} by="file" />
    </section>
  );
}
