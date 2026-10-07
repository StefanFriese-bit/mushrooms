import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import type { Find, Spot, StoredPhoto } from './store';

// His finds in one file (spec 7): a zip holding finds.json (the finds) and photos/<id>.<ext> (their photos, stored as
// they are — JPEGs do not shrink further). He saves it to iCloud Drive; opening it again restores. The whole file is
// read and checked before anything on the phone changes: a damaged file, or one that is not a backup, changes nothing.
// A restore adds finds by their id, so nothing is ever duplicated or overwritten.

export const BACKUP_APP = 'mushroom-guide-finds';
export const BACKUP_VERSION = 1;
type Index = { app: string; version: number; made: string; finds: Find[]; photos: Array<{ id: string; findId: string; type: string; file: string }> };

/** Why a file cannot be restored, in his words (spec 10). */
export class BackupError extends Error {}
const CANNOT = "That file can't be restored. Nothing was changed.";

const ext = (type: string) => (type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg');

/** The backup file's bytes for these finds and their photos. */
export function packBackup(finds: Find[], photos: StoredPhoto[], made: Date): Uint8Array {
  const files: Zippable = {};
  const list: Index['photos'] = [];
  for (const p of photos) {
    const file = `photos/${p.id}.${ext(p.type)}`;
    files[file] = [new Uint8Array(p.bytes), { level: 0 }];
    list.push({ id: p.id, findId: p.findId, type: p.type, file });
  }
  const index: Index = { app: BACKUP_APP, version: BACKUP_VERSION, made: made.toISOString(), finds, photos: list };
  files['finds.json'] = strToU8(JSON.stringify(index));
  return zipSync(files);
}

const isText = (v: unknown): v is string => typeof v === 'string';
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
function isSpot(v: unknown): v is Spot | null {
  if (v === null) return true;
  if (typeof v !== 'object') return false;
  const s = v as Record<string, unknown>;
  return isNumber(s.lat) && isNumber(s.lon) && Math.abs(s.lat) <= 90 && Math.abs(s.lon) <= 180 && (s.accuracy === null || isNumber(s.accuracy));
}
function isFind(v: unknown): v is Find {
  if (typeof v !== 'object' || v === null) return false;
  const f = v as Record<string, unknown>;
  return isText(f.id) && f.id.length > 0 && isText(f.at) && !Number.isNaN(Date.parse(f.at)) && isSpot(f.spot) &&
    (f.species === null || isText(f.species)) && isText(f.notes) && Array.isArray(f.photoIds) && f.photoIds.every(isText);
}

/** Reads and checks a whole backup file; throws BackupError (nothing to change) if anything about it is wrong. */
export function readBackup(bytes: Uint8Array): { made: string; finds: Find[]; photos: StoredPhoto[] } {
  let files: Record<string, Uint8Array>;
  try { files = unzipSync(bytes); } catch { throw new BackupError(CANNOT); }
  let index: Index;
  try { index = JSON.parse(strFromU8(files['finds.json'])) as Index; } catch { throw new BackupError(CANNOT); }
  if (!index || index.app !== BACKUP_APP || !Array.isArray(index.finds) || !Array.isArray(index.photos)) throw new BackupError(CANNOT);
  if (index.version !== BACKUP_VERSION) {
    throw new BackupError(`That backup was made by ${index.version > BACKUP_VERSION ? 'a newer' : 'an older'} version of the app and can't be restored here. Nothing was changed.`);
  }
  if (!index.finds.every(isFind)) throw new BackupError(CANNOT);
  const photos: StoredPhoto[] = [];
  for (const p of index.photos) {
    const data = isText(p?.file) ? files[p.file] : undefined;
    if (!isText(p?.id) || !isText(p.findId) || !isText(p.type) || !p.type.startsWith('image/') || !data) throw new BackupError(CANNOT);
    photos.push({ id: p.id, findId: p.findId, type: p.type, bytes: data.slice().buffer });
  }
  const byId = new Map(photos.map((p) => [p.id, p]));
  for (const f of index.finds) {
    if (!f.photoIds.every((id) => byId.get(id)?.findId === f.id)) throw new BackupError(CANNOT); // every photo it names is in the file
  }
  if (new Set(index.finds.map((f) => f.id)).size !== index.finds.length) throw new BackupError(CANNOT);
  return { made: index.made, finds: index.finds, photos };
}

/** Which finds a restore adds (those not on the phone) and which it leaves alone (already there, by id). */
export function planRestore(onPhone: Set<string>, finds: Find[]): { add: Find[]; already: Find[] } {
  return { add: finds.filter((f) => !onPhone.has(f.id)), already: finds.filter((f) => onPhone.has(f.id)) };
}

/** The file's name: the day it was made. */
export const backupName = (made: Date) => `mushroom-finds-${made.toISOString().slice(0, 10)}.zip`;

// When he last saved a backup and which finds it held — kept in the browser's small store, not in the finds database,
// so this can never touch his finds. Lost (cleared) only means one reminder too many.
const KEY = 'finds-backup';
export type BackupNote = { at: string; ids: string[] };
export function lastBackup(): BackupNote | null {
  try { const raw = localStorage.getItem(KEY); return raw ? (JSON.parse(raw) as BackupNote) : null; } catch { return null; }
}
export function noteBackup(note: BackupNote): void {
  try { localStorage.setItem(KEY, JSON.stringify(note)); } catch { /* not kept: he gets one reminder too many */ }
}

/** The reminder (spec 7): finds not in a backup, when the last backup is more than 7 days old (or there is none). */
export function backupReminder(findIds: string[], note: BackupNote | null, now: Date): number {
  const inBackup = new Set(note?.ids ?? []);
  const missing = findIds.filter((id) => !inBackup.has(id)).length;
  if (missing === 0) return 0;
  if (note && now.getTime() - Date.parse(note.at) <= 7 * 24 * 3600 * 1000) return 0;
  return missing;
}
