import { useState } from 'preact/hooks';
import { allPhotos, restoreFinds, type Find } from '../finds/store';
import { BackupError, backupName, backupReminder, lastBackup, noteBackup, packBackup, readBackup } from '../finds/backup';
import { sayWhen } from './finds';

// Backup and restore of his saved locations (spec 7): one file to iCloud Drive — through the iPhone's share sheet
// ("Save to Files"), or as a download where a phone cannot share files — and restoring by opening that file. A reminder
// shows when locations are not in a backup and the last one is more than a week old. (In the code a saved location is
// still a "find": the store and the backup file keep that name, so older backups restore.)
export const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

export function useBackup(finds: Find[], onRestored: () => void) {
  const [note, setNote] = useState(lastBackup);
  const [busy, setBusy] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const remind = backupReminder(finds.map((f) => f.id), note, new Date());

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
  return { note, busy, said, remind, save, restore };
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

/** The backup section at the foot of View map. */
export function BackupSection({ b, count }: { b: ReturnType<typeof useBackup>; count: number }) {
  return (
    <section class="card" data-test="backup">
      <h2>Backup</h2>
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
      {b.busy && <p class="muted small" role="status">{b.busy}</p>}
      {b.said && <p class="small" role="status" data-test="backup-said">{b.said}</p>}
    </section>
  );
}
