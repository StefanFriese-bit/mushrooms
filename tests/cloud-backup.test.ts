import { describe, expect, it } from 'vitest';
import {
  API, BRANCH, FILE, HELD_EMPTY, OWNER, REPO, RETRY_AFTER_MS, WARN_AFTER_MS, asFinds, cleanKey, cloudWarning, fetchLocations, fileText,
  fingerprint, forgetKey, keyOpensRepo, locationsOf, needsSending, noteRestored, readCloud, readLocationsFile, sendLocations, setKey,
  toBase64, trySend, writeCloud, type CloudState,
} from '../src/finds/cloud-backup';
import { BackupError, backupReminder } from '../src/finds/backup';
import type { Find } from '../src/finds/store';

// The automatic backup of his saved locations to GitHub (src/finds/cloud-backup.ts): what goes in the file, when a push
// is made, what GitHub's answers mean, and the restore. GitHub itself is a stand-in here that records every call.

const find = (id: string, extra: Partial<Find> = {}): Find =>
  ({ id, at: '2026-10-07T09:30:00.000Z', spot: { lat: 51.65, lon: 0.04, accuracy: 6 }, species: 'Boletus edulis', notes: 'penny bun under the beech', photoIds: ['p1', 'p2'], ...extra });
const now = new Date('2026-10-14T12:00:00Z');
const store = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); }, m };
};
const KEY = 'github_pat_11AAAAAAA0000000000000_abcdefghijklmnopqrstuvwxyz0123456789';
const connected = (): CloudState => ({ key: KEY, sent: null, failed: null });

/** A stand-in GitHub: the tree of the branch, the file, and every request made. `answer` overrides a step. */
function github(opts: { file?: string | null; status?: Record<string, number>; down?: boolean } = {}) {
  const calls: Array<{ method: string; url: string; headers: Record<string, string>; body?: unknown }> = [];
  let file: string | null = opts.file ?? null;
  let sha = file ? 'sha-1' : null;
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const fetchFn = async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const body = init?.body ? JSON.parse(init.body as string) : undefined;
    calls.push({ method, url, headers, body });
    if (opts.down) throw new TypeError('Load failed');
    const path = url.slice(API.length);
    const forced = Object.entries(opts.status ?? {}).find(([k]) => `${method} ${path}`.startsWith(k))?.[1];
    if (forced) return json(forced, { message: 'forced' });
    if (method === 'GET' && path === `/repos/${OWNER}/${REPO}`) return json(200, { full_name: `${OWNER}/${REPO}` });
    if (method === 'GET' && path === `/repos/${OWNER}/${REPO}/git/trees/${BRANCH}`) {
      return sha ? json(200, { tree: [{ path: 'README.md', type: 'blob', sha: 'r' }, { path: FILE, type: 'blob', sha }] }) : json(404, { message: 'Not Found' });
    }
    if (method === 'PUT' && path === `/repos/${OWNER}/${REPO}/contents/${FILE}`) {
      if ((body.sha ?? null) !== sha) return json(409, { message: 'sha does not match' });
      file = Buffer.from(body.content, 'base64').toString('utf8');
      sha = `sha-${calls.length}`;
      return json(body.sha ? 200 : 201, { content: { sha } });
    }
    if (method === 'GET' && path.startsWith(`/repos/${OWNER}/${REPO}/contents/${FILE}`)) {
      return file === null ? json(404, { message: 'Not Found' }) : new Response(file, { status: 200 });
    }
    return json(500, { message: `unexpected ${method} ${path}` });
  };
  return { calls, fetchFn, get file() { return file; }, set file(v: string | null) { file = v; sha = v ? 'sha-x' : null; } };
}

describe('what goes in the file', () => {
  it('holds each location without its photos, in a fixed order, and the same locations give the same fingerprint', () => {
    const a = find('b'), b = find('a', { growth: [{ stage: 2, at: '2026-10-08T10:00:00Z' }] });
    const locs = locationsOf([a, b]);
    expect(locs.map((l) => l.id)).toEqual(['a', 'b']);
    expect(Object.keys(locs[1])).not.toContain('photoIds');
    expect(locs[0].growth).toEqual(b.growth);
    expect(Object.keys(locs[0])).not.toContain('photoIds');
    expect(fingerprint(locationsOf([b, a]))).toBe(fingerprint(locs));
    expect(fingerprint(locationsOf([a]))).not.toBe(fingerprint(locs));
    const text = fileText(locs, now);
    expect(text).not.toContain('photo');
    expect(JSON.parse(text)).toMatchObject({ app: 'mushroom-guide-finds', kind: 'locations', version: 1, made: now.toISOString() });
  });

  it('reads its own file back, and refuses anything that is not one — changing nothing', () => {
    const locs = locationsOf([find('a'), find('b')]);
    expect(readLocationsFile(fileText(locs, now))).toEqual(locs);
    expect(asFinds(locs)[0].photoIds).toEqual([]);
    for (const bad of ['not json', '{}', JSON.stringify({ app: 'other', kind: 'locations', version: 1, locations: [] }),
      fileText(locs, now).replace('"locations"', '"photos"'),
      JSON.stringify({ app: 'mushroom-guide-finds', kind: 'locations', version: 1, locations: [{ id: 'x' }] }),
      JSON.stringify({ app: 'mushroom-guide-finds', kind: 'locations', version: 1, locations: [locs[0], locs[0]] })]) {
      expect(() => readLocationsFile(bad), bad).toThrow(BackupError);
    }
    expect(() => readLocationsFile(JSON.stringify({ app: 'mushroom-guide-finds', kind: 'locations', version: 2, locations: [] }))).toThrow(/newer version/);
  });

  it('base64 survives accents and a long file', () => {
    const text = 'café ' + 'x'.repeat(200_000);
    expect(Buffer.from(toBase64(text), 'base64').toString('utf8')).toBe(text);
  });
});

describe('when a push is needed', () => {
  it('always before the first, then only when a location is added, changed or removed', () => {
    const s = connected();
    expect(needsSending([find('a')], s)).toBe(true);
    const sent = { at: now.toISOString(), ids: ['a'], hash: fingerprint(locationsOf([find('a')])) };
    expect(needsSending([find('a')], { ...s, sent })).toBe(false);
    expect(needsSending([find('a', { photoIds: ['other'] })], { ...s, sent })).toBe(false); // photos are not in it
    expect(needsSending([find('a', { notes: 'changed' })], { ...s, sent })).toBe(true);
    expect(needsSending([find('a'), find('b')], { ...s, sent })).toBe(true);
    expect(needsSending([], { ...s, sent })).toBe(true);
  });

  it('a key is at least 20 characters with no spaces; the state survives the store and a broken store', () => {
    expect(cleanKey('  ' + KEY + '\n')).toBe(KEY);
    expect(cleanKey('short')).toBeNull();
    expect(cleanKey('github pat with spaces 0000000000')).toBeNull();
    const s = store();
    writeCloud({ key: KEY, sent: { at: 'x', ids: ['a'], hash: 'h' }, failed: null }, s);
    expect(readCloud(s)).toEqual({ key: KEY, sent: { at: 'x', ids: ['a'], hash: 'h' }, failed: null, held: null });
    s.m.set('cloud-backup', '{broken');
    expect(readCloud(s)).toEqual({ key: '', sent: null, failed: null, held: null });
    expect(readCloud(null)).toEqual({ key: '', sent: null, failed: null, held: null });
  });

  it('the file-backup reminder stays quiet for locations the automatic backup has reached GitHub with', () => {
    expect(backupReminder(['a', 'b'], null, now, { ids: ['a', 'b'] })).toBe(0);
    expect(backupReminder(['a', 'b'], null, now, { ids: ['a'] })).toBe(1);
    expect(backupReminder(['a', 'b'], null, now, null)).toBe(2);
  });
});

describe('sending to GitHub', () => {
  it('makes the file on the first push (no sha), replaces it with the sha after, and sends the key to api.github.com only', async () => {
    const gh = github();
    const s1 = await sendLocations([find('a')], connected(), { fetch: gh.fetchFn, now: () => now });
    expect(s1.sent).toEqual({ at: now.toISOString(), ids: ['a'], hash: fingerprint(locationsOf([find('a')])) });
    expect(s1.failed).toBeNull();
    const put1 = gh.calls.find((c) => c.method === 'PUT')!;
    expect(put1.body).toMatchObject({ branch: BRANCH, message: 'Backup: 1 location' });
    expect(put1.body).not.toHaveProperty('sha');
    expect(JSON.parse(gh.file!).locations).toEqual(locationsOf([find('a')]));
    expect(gh.file).not.toContain('photoIds');
    const s2 = await sendLocations([find('a'), find('b')], s1, { fetch: gh.fetchFn, now: () => now });
    const put2 = gh.calls.filter((c) => c.method === 'PUT')[1];
    expect(put2.body).toMatchObject({ sha: 'sha-2', message: 'Backup: 2 locations' });
    expect(s2.sent?.ids).toEqual(['a', 'b']);
    for (const c of gh.calls) {
      expect(c.url.startsWith(API + '/repos/')).toBe(true);
      expect(c.headers.Authorization).toBe(`Bearer ${KEY}`);
    }
  });

  it('when the file changed under us, reads its new sha and pushes once more', async () => {
    const gh = github({ file: 'old' });
    const first = gh.fetchFn;
    let stolen = false;
    const racing = async (url: string, init?: RequestInit) => {
      // Between our sha read and our PUT, someone else replaces the file once.
      if (!stolen && init?.method === 'PUT') { stolen = true; gh.file = 'someone else'; }
      return first(url, init);
    };
    const s = await sendLocations([find('a')], connected(), { fetch: racing, now: () => now });
    expect(s.sent).not.toBeNull();
    expect(gh.calls.filter((c) => c.method === 'PUT')).toHaveLength(2);
    expect(JSON.parse(gh.file!).locations[0].id).toBe('a');
  });

  it('says in his words why a push did not reach GitHub, keeps when the trouble started, and never loses the last success', async () => {
    const was = { at: '2026-10-13T08:00:00Z', ids: ['a'], hash: 'h' };
    const refused = await sendLocations([find('a')], { ...connected(), sent: was }, { fetch: github({ status: { 'GET /repos/ECWuser/mushrooms-backup/git/trees': 401 } }).fetchFn, now: () => now });
    expect(refused.failed).toEqual({ since: now.toISOString(), at: now.toISOString(), why: expect.stringContaining('refused the key') });
    expect(refused.sent).toEqual(was);
    const later = new Date(now.getTime() + 3600_000);
    const again = await sendLocations([find('a')], refused, { fetch: github({ down: true }).fetchFn, now: () => later });
    expect(again.failed).toEqual({ since: now.toISOString(), at: later.toISOString(), why: 'no signal' });
    const notFound = await sendLocations([find('a')], connected(), { fetch: github({ status: { 'PUT /repos/ECWuser/mushrooms-backup/contents': 404 } }).fetchFn, now: () => now });
    expect(notFound.failed?.why).toMatch(/cannot find the backup repository/);
    expect(await sendLocations([find('a')], { key: '', sent: null, failed: null }, { fetch: github().fetchFn })).toEqual({ key: '', sent: null, failed: null });
    expect(github().calls).toHaveLength(0);
  });

  it('a phone with no locations never writes over a backup on GitHub: nothing is sent, and Restore is the way', async () => {
    const gh = github({ file: fileText(locationsOf([find('a')]), now) });
    const s = await sendLocations([], connected(), { fetch: gh.fetchFn, now: () => now });
    expect(gh.calls.filter((c) => c.method === 'PUT')).toHaveLength(0);
    expect(s.held).toBe(HELD_EMPTY);
    expect(s.sent).toBeNull();
    expect(s.failed).toBeNull();
    expect(JSON.parse(gh.file!).locations[0].id).toBe('a'); // the backup is as it was
    // With no backup there yet, an empty list is fine to send (it makes the file); and once the phone has a location it goes.
    const empty = github();
    expect((await sendLocations([], connected(), { fetch: empty.fetchFn, now: () => now })).sent?.ids).toEqual([]);
    const s2 = await sendLocations([find('b')], s, { fetch: gh.fetchFn, now: () => now });
    expect(s2.held).toBeNull();
    expect(s2.sent?.ids).toEqual(['b']);
    // The runner does not keep asking GitHub while the phone stays empty.
    const st = store();
    writeCloud(s, st);
    const before = gh.calls.length;
    await trySend(async () => [], { fetch: gh.fetchFn, now: () => now, store: st });
    expect(gh.calls.length).toBe(before);
  });

  it('the Map warning comes only once changes have waited a day without reaching GitHub', () => {
    const s: CloudState = { ...connected(), failed: { since: '2026-10-13T11:00:00Z', at: '2026-10-14T11:50:00Z', why: 'no signal' } };
    expect(cloudWarning([find('a')], s, now)).toMatch(/has not reached GitHub since 13 Oct 2026.*no signal/);
    expect(cloudWarning([find('a')], { ...s, failed: { ...s.failed!, since: new Date(now.getTime() - WARN_AFTER_MS + 60_000).toISOString() } }, now)).toBeNull();
    expect(cloudWarning([find('a')], { ...s, sent: { at: 'x', ids: ['a'], hash: fingerprint(locationsOf([find('a')])) } }, now)).toBeNull(); // nothing waiting
    expect(cloudWarning([find('a')], { ...s, key: '' }, now)).toBeNull();
    expect(cloudWarning([find('a')], connected(), now)).toBeNull();
  });
});

describe('the runner', () => {
  it('sends after a change, not while nothing changed, and waits after a failure unless forced', async () => {
    const gh = github();
    const s = store();
    writeCloud(connected(), s);
    let finds = [find('a')];
    const list = async () => finds;
    await trySend(list, { fetch: gh.fetchFn, now: () => now, store: s });
    expect(gh.calls.filter((c) => c.method === 'PUT')).toHaveLength(1);
    await trySend(list, { fetch: gh.fetchFn, now: () => now, store: s });
    expect(gh.calls.filter((c) => c.method === 'PUT')).toHaveLength(1); // nothing changed: no second push
    finds = [find('a'), find('b')];
    const down = github({ down: true });
    await trySend(list, { fetch: down.fetchFn, now: () => now, store: s });
    expect(readCloud(s).failed?.why).toBe('no signal');
    const soon = new Date(now.getTime() + RETRY_AFTER_MS - 1000);
    await trySend(list, { fetch: gh.fetchFn, now: () => soon, store: s });
    expect(gh.calls.filter((c) => c.method === 'PUT')).toHaveLength(1); // too soon after the failure
    await trySend(list, { fetch: gh.fetchFn, now: () => soon, store: s, force: true });
    expect(gh.calls.filter((c) => c.method === 'PUT')).toHaveLength(2); // forced: sent
    expect(readCloud(s).failed).toBeNull();
    expect(readCloud(s).sent?.ids).toEqual(['a', 'b']);
  });

  it('two calls at once make one push, then one more; a forgotten key sends nothing', async () => {
    const gh = github();
    const s = store();
    writeCloud(connected(), s);
    const list = async () => [find('a')];
    await Promise.all([trySend(list, { fetch: gh.fetchFn, now: () => now, store: s }), trySend(list, { fetch: gh.fetchFn, now: () => now, store: s })]);
    expect(gh.calls.filter((c) => c.method === 'PUT').length).toBeLessThanOrEqual(2);
    forgetKey(s);
    expect(readCloud(s).key).toBe('');
    const before = gh.calls.length;
    await trySend(list, { fetch: gh.fetchFn, now: () => now, store: s, force: true });
    expect(gh.calls.length).toBe(before);
  });

  it('Save key: GitHub must open the repository with it, then it is kept and the locations go at once', async () => {
    const s = store();
    const gh = github();
    const ok = await setKey(KEY, async () => [find('a')], { fetch: gh.fetchFn, now: () => now, store: s });
    expect(ok).toEqual({ ok: true });
    expect(readCloud(s).key).toBe(KEY);
    expect(readCloud(s).sent?.ids).toEqual(['a']);
    const bad = github({ status: { 'GET /repos/ECWuser/mushrooms-backup': 401 } });
    const s2 = store();
    expect(await setKey(KEY, async () => [], { fetch: bad.fetchFn, store: s2 })).toEqual({ ok: false, why: expect.stringContaining('refused the key') });
    expect(readCloud(s2).key).toBe('');
    expect(await keyOpensRepo(KEY, { fetch: github({ down: true }).fetchFn })).toEqual({ ok: false, why: 'no signal' });
  });
});

describe('restoring from GitHub', () => {
  it('a restore that leaves the phone holding exactly the backup is noted as sent — nothing goes straight back; a phone holding more still pushes', () => {
    const fetched = locationsOf([find('a'), find('b')]);
    const s = store();
    writeCloud(connected(), s);
    const noted = noteRestored(fetched, [find('b')], { store: s, now: () => now }); // b already here, a comes back
    expect(noted.sent).toEqual({ at: now.toISOString(), ids: ['b', 'a'], hash: fingerprint(fetched) });
    expect(needsSending([find('a', { photoIds: [] }), find('b')], readCloud(s))).toBe(false);
    const s2 = store();
    writeCloud(connected(), s2);
    expect(noteRestored(fetched, [find('c')], { store: s2, now: () => now }).sent).toBeNull(); // c is not on GitHub: it must go
    const s3 = store();
    expect(noteRestored(fetched, [], { store: s3 }).sent).toBeNull(); // no key: nothing noted
  });

  it('brings the locations back without photos; no file, a refused key or no signal are said and change nothing', async () => {
    const locs = locationsOf([find('a'), find('b')]);
    const gh = github({ file: fileText(locs, now) });
    expect(await fetchLocations(connected(), { fetch: gh.fetchFn })).toEqual(locs);
    expect(gh.calls[0].headers.Accept).toBe('application/vnd.github.raw+json');
    await expect(fetchLocations(connected(), { fetch: github().fetchFn })).rejects.toThrow(/no backup on GitHub yet/);
    await expect(fetchLocations(connected(), { fetch: github({ file: 'x', status: { 'GET /repos/ECWuser/mushrooms-backup/contents': 401 } }).fetchFn })).rejects.toThrow(/refused the key/);
    await expect(fetchLocations(connected(), { fetch: github({ down: true }).fetchFn })).rejects.toThrow(/no signal/);
    await expect(fetchLocations({ key: '', sent: null, failed: null }, { fetch: gh.fetchFn })).rejects.toThrow(/not set up/);
    await expect(fetchLocations(connected(), { fetch: github({ file: 'garbage' }).fetchFn })).rejects.toThrow(BackupError);
  });
});
