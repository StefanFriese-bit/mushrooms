import { isTrack, type Track } from './track';

// His recorded walks (src/finds/track.ts), kept in this phone's own database, apart from his saved locations (their
// database, src/finds/store.ts, is left exactly as it is). The walk being recorded is saved here as it grows, so a
// walk outlives the app being closed: when it opens again, recording carries on (src/finds/track-recorder.ts).

const DB_NAME = 'mushroom-walks';
const VERSION = 1;
let opening: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('walks')) db.createObjectStore('walks', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { opening = null; reject(req.error ?? new Error('The walks database could not be opened')); };
  });
  return opening;
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('The walks database refused the change'));
    tx.onabort = () => reject(tx.error ?? new Error('The change to the walks database was cancelled'));
  });
}

const listeners = new Set<() => void>();
/** Told after a walk is saved (finished), renamed or deleted — not on every point while recording. */
export function onWalksChanged(l: () => void): () => void { listeners.add(l); return () => listeners.delete(l); }
export const walksChanged = () => { for (const l of listeners) { try { l(); } catch { /* its own fault */ } } };

/** Writes a walk whole (the recording one as it grows, or a finished one). */
export async function putTrack(t: Track, announce = false): Promise<void> {
  const db = await open();
  const tx = db.transaction('walks', 'readwrite');
  tx.objectStore('walks').put(t);
  await done(tx);
  if (announce) walksChanged();
}

/** Every walk, newest first, the one being recorded included (its `end` is null). Damaged records are left out. */
export async function listTracks(): Promise<Track[]> {
  const db = await open();
  const req = db.transaction('walks').objectStore('walks').getAll();
  const all = await new Promise<unknown[]>((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
  return all.filter(isTrack).sort((a, b) => b.start.localeCompare(a.start));
}

export async function getTrack(id: string): Promise<Track | undefined> {
  return (await listTracks()).find((t) => t.id === id);
}

export async function deleteTrack(id: string): Promise<void> {
  const db = await open();
  const tx = db.transaction('walks', 'readwrite');
  tx.objectStore('walks').delete(id);
  await done(tx);
  walksChanged();
}
