import type { LatLon } from './geo';

// His finds (spec 7), kept in this phone's own database (IndexedDB) and nowhere else. A find's photos are stored as
// bytes beside it. Nothing here ever talks to the network.
export type Spot = LatLon & { accuracy: number | null }; // accuracy in metres; null = placed on the map by hand
export type Find = {
  id: string;
  at: string; // when it was found (ISO)
  spot: Spot | null;
  species: string | null; // the scientific name of one of our species, or null = not identified yet
  notes: string;
  photoIds: string[];
};
export type StoredPhoto = { id: string; findId: string; type: string; bytes: ArrayBuffer };

const DB_NAME = 'mushroom-finds';
const VERSION = 1;
let opening: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('finds')) db.createObjectStore('finds', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos', { keyPath: 'id' }).createIndex('findId', 'findId');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { opening = null; reject(req.error ?? new Error('The finds database could not be opened')); };
  });
  return opening;
}

/** One transaction; resolves with `work`'s result once everything is written (a half-written find never stays). */
async function inTx<T>(stores: string[], mode: IDBTransactionMode, work: (tx: IDBTransaction) => T): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    let out: T;
    try { out = work(tx); } catch (e) { tx.abort(); reject(e); return; }
    tx.oncomplete = () => resolve(out);
    tx.onerror = () => reject(tx.error ?? new Error('The finds database refused the change'));
    tx.onabort = () => reject(tx.error ?? new Error('The change to the finds database was cancelled'));
  });
}

const ask = <T>(req: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

/** Every find, newest first. */
export async function listFinds(): Promise<Find[]> {
  const db = await open();
  const all = await ask(db.transaction('finds').objectStore('finds').getAll() as IDBRequest<Find[]>);
  return all.sort((a, b) => b.at.localeCompare(a.at));
}

export async function getFind(id: string): Promise<Find | undefined> {
  const db = await open();
  return ask(db.transaction('finds').objectStore('finds').get(id) as IDBRequest<Find | undefined>);
}

/** Saves a new find with its photos in one go. */
export async function addFind(f: Omit<Find, 'id' | 'photoIds'>, photos: Blob[]): Promise<Find> {
  const id = crypto.randomUUID();
  const stored: StoredPhoto[] = [];
  for (const p of photos) stored.push({ id: crypto.randomUUID(), findId: id, type: p.type || 'image/jpeg', bytes: await p.arrayBuffer() });
  const find: Find = { ...f, id, photoIds: stored.map((p) => p.id) };
  await inTx(['finds', 'photos'], 'readwrite', (tx) => {
    tx.objectStore('finds').add(find);
    for (const p of stored) tx.objectStore('photos').add(p);
  });
  return find;
}

/** Changes what he knows about a find (species, notes, its spot). */
export async function updateFind(id: string, changes: Partial<Pick<Find, 'species' | 'notes' | 'spot'>>): Promise<Find> {
  const old = await getFind(id);
  if (!old) throw new Error('That find is no longer on this phone');
  const next = { ...old, ...changes };
  await inTx(['finds'], 'readwrite', (tx) => { tx.objectStore('finds').put(next); });
  return next;
}

/** Removes a find and its photos. */
export async function deleteFind(f: Find): Promise<void> {
  await inTx(['finds', 'photos'], 'readwrite', (tx) => {
    tx.objectStore('finds').delete(f.id);
    for (const id of f.photoIds) tx.objectStore('photos').delete(id);
  });
}

export async function photosOf(f: Find): Promise<StoredPhoto[]> {
  const db = await open();
  const store = db.transaction('photos').objectStore('photos');
  const got = await Promise.all(f.photoIds.map((id) => ask(store.get(id) as IDBRequest<StoredPhoto | undefined>)));
  return got.filter((p): p is StoredPhoto => p !== undefined);
}

/** A stored photo as an address an <img> can show (the caller revokes it when done). */
export const photoAddress = (p: StoredPhoto) => URL.createObjectURL(new Blob([p.bytes], { type: p.type }));
