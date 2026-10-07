import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { BackupError, backupReminder, packBackup, planRestore, readBackup } from '../src/finds/backup';
import type { Find, StoredPhoto } from '../src/finds/store';

// His finds in one file (src/finds/backup.ts): what goes in comes back out; anything wrong changes nothing.
const find = (id: string, photoIds: string[] = []): Find =>
  ({ id, at: '2026-10-07T09:30:00.000Z', spot: { lat: 51.65, lon: 0.04, accuracy: 6 }, species: 'Cantharellus cibarius', notes: 'by the stream', photoIds });
const photo = (id: string, findId: string, n: number): StoredPhoto => ({ id, findId, type: 'image/jpeg', bytes: new Uint8Array([0xff, 0xd8, n, n, 0xff, 0xd9]).buffer });
const made = new Date('2026-10-07T10:00:00Z');

describe('a backup file', () => {
  it('gives back every find and photo exactly as they went in', () => {
    const finds = [find('a', ['p1', 'p2']), find('b'), { ...find('c', ['p3']), spot: null, species: null, notes: '' }];
    const photos = [photo('p1', 'a', 1), photo('p2', 'a', 2), photo('p3', 'c', 3)];
    const back = readBackup(packBackup(finds, photos, made));
    expect(back.finds).toEqual(finds);
    expect(back.photos.map((p) => [p.id, p.findId, p.type, [...new Uint8Array(p.bytes)]]))
      .toEqual(photos.map((p) => [p.id, p.findId, p.type, [...new Uint8Array(p.bytes)]]));
    expect(back.made).toBe(made.toISOString());
  });
  it('refuses a damaged file, a file that is not a backup, and one that misses a photo — changing nothing', () => {
    const good = packBackup([find('a', ['p1'])], [photo('p1', 'a', 1)], made);
    expect(() => readBackup(good.slice(0, good.length - 40))).toThrow(BackupError);
    expect(() => readBackup(strToU8('just some text'))).toThrow("That file can't be restored. Nothing was changed.");
    expect(() => readBackup(zipSync({ 'notes.txt': strToU8('hello') }))).toThrow(BackupError);
    expect(() => readBackup(packBackup([find('a', ['p1'])], [], made))).toThrow(BackupError); // names a photo it lacks
    expect(() => readBackup(packBackup([{ ...find('a'), at: 'yesterday' }], [], made))).toThrow(BackupError);
    expect(() => readBackup(packBackup([find('a'), find('a')], [], made))).toThrow(BackupError); // the same find twice
  });
  it('says plainly when a backup comes from another version of the app', () => {
    const newer = zipSync({ 'finds.json': strToU8(JSON.stringify({ app: 'mushroom-guide-finds', version: 99, made: '', finds: [], photos: [] })) });
    expect(() => readBackup(newer)).toThrow('That backup was made by a newer version of the app');
  });
});

describe('restoring', () => {
  it('adds only the finds not on the phone; a find already there is left as it is', () => {
    const plan = planRestore(new Set(['b']), [find('a'), find('b'), find('c')]);
    expect(plan.add.map((f) => f.id)).toEqual(['a', 'c']);
    expect(plan.already.map((f) => f.id)).toEqual(['b']);
  });
});

describe('the backup reminder', () => {
  const now = new Date('2026-10-20T12:00:00Z');
  it('counts the finds not in a backup once the last backup is over a week old, or there is none', () => {
    expect(backupReminder(['a', 'b'], null, now)).toBe(2);
    expect(backupReminder(['a', 'b', 'c'], { at: '2026-10-01T12:00:00Z', ids: ['a'] }, now)).toBe(2);
  });
  it('stays quiet within a week of a backup, and when every find is in one', () => {
    expect(backupReminder(['a', 'b'], { at: '2026-10-15T12:00:00Z', ids: ['a'] }, now)).toBe(0);
    expect(backupReminder(['a'], { at: '2026-09-01T12:00:00Z', ids: ['a'] }, now)).toBe(0);
    expect(backupReminder([], null, now)).toBe(0);
  });
});
