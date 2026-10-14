import type { Find } from './store';
import { BACKUP_APP, BackupError, isFind } from './backup';

// The automatic backup (Stefan 14/10/2026: "Can this not be automated so I don't have to worry about this … We don't
// need to save the photos. What's important is the locations."). His saved locations — never the photos — go to ONE
// file, locations.json, in a private repository in the company's GitHub space, written by this phone whenever a
// location is saved, changed or removed and the phone has a signal. GitHub keeps every version of the file. A new
// phone gets them back with the key and "Restore from GitHub". Nothing here can touch the locations on the phone except
// that restore, which adds and never overwrites (src/finds/store.ts restoreFinds).
//
// The key is a GitHub "fine-grained personal access token" he makes once, allowed to read and write the contents of
// that one repository and nothing else; it lives in this phone's small store and is sent to api.github.com only.

export const OWNER = 'ECWuser';
export const REPO = 'mushrooms-backup';
export const BRANCH = 'main';
export const FILE = 'locations.json';
export const API = 'https://api.github.com';
export const CLOUD_KEY = 'cloud-backup';
/** After a try that did not reach GitHub, no new try for this long — the app comes to the front many times a walk. */
export const RETRY_AFTER_MS = 5 * 60 * 1000;
/** The Map page warns once changes have waited this long without reaching GitHub. */
export const WARN_AFTER_MS = 24 * 3600 * 1000;

/** A saved location as the file holds it: a find without its photos. */
export type Location = Omit<Find, 'photoIds'>;
export type LocationsFile = { app: string; version: number; kind: 'locations'; made: string; locations: Location[] };
export const FILE_VERSION = 1;

/** The last push that reached GitHub: when, which locations, and the fingerprint of what was sent. */
export type Sent = { at: string; ids: string[]; hash: string };
export type Failed = { since: string; at: string; why: string };
export type CloudState = {
  /** The GitHub key; '' = not set up. */
  key: string;
  sent: Sent | null;
  /** The run of tries since the last success that did not reach GitHub, or null. */
  failed: Failed | null;
  /** Why the last try sent nothing ON PURPOSE (a phone with no locations never writes over a backup), or null. */
  held?: string | null;
};
export const NOT_SET_UP: CloudState = { key: '', sent: null, failed: null, held: null };
/** Said when a phone with no locations meets a backup on GitHub: the backup is left as it is. */
export const HELD_EMPTY = 'GitHub already holds a backup and this phone has no saved locations, so nothing was sent — "Restore from GitHub" brings them here.';

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
function phoneStore(): Store | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}

export function readCloud(store: Store | null = phoneStore()): CloudState {
  try {
    const raw = store?.getItem(CLOUD_KEY);
    if (!raw) return NOT_SET_UP;
    const v = JSON.parse(raw) as Partial<CloudState>;
    const sent = v.sent && typeof v.sent.at === 'string' && Array.isArray(v.sent.ids) && typeof v.sent.hash === 'string' ? v.sent : null;
    const failed = v.failed && typeof v.failed.since === 'string' && typeof v.failed.at === 'string' && typeof v.failed.why === 'string' ? v.failed : null;
    return { key: typeof v.key === 'string' ? v.key : '', sent, failed, held: typeof v.held === 'string' ? v.held : null };
  } catch { return NOT_SET_UP; }
}
export function writeCloud(state: CloudState, store: Store | null = phoneStore()): void {
  try { store?.setItem(CLOUD_KEY, JSON.stringify(state)); } catch { /* not kept: it is tried again next time */ }
}

/** The key as he pasted it, or null when it is not a key at all (empty, or with spaces inside). */
export function cleanKey(typed: string): string | null {
  const k = typed.trim();
  return k.length >= 20 && !/\s/.test(k) ? k : null;
}

/** What goes in the file: each location without its photos, in a fixed order so the same locations always give the
 * same text (and the same fingerprint). */
export function locationsOf(finds: Find[]): Location[] {
  return [...finds].sort((a, b) => a.id.localeCompare(b.id)).map((f) => {
    const l: Location = { id: f.id, at: f.at, spot: f.spot, species: f.species, notes: f.notes };
    if (f.growth) l.growth = f.growth;
    return l;
  });
}

/** A short fingerprint of the locations (FNV-1a over their text): the same locations → the same fingerprint, so a push
 * is only made when something changed. */
export function fingerprint(locations: Location[]): string {
  const text = JSON.stringify(locations);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0') + ':' + text.length.toString(16);
}

export function fileText(locations: Location[], made: Date): string {
  const file: LocationsFile = { app: BACKUP_APP, version: FILE_VERSION, kind: 'locations', made: made.toISOString(), locations };
  return JSON.stringify(file, null, 1) + '\n';
}

/** Whether what is on the phone differs from what last reached GitHub. */
export function needsSending(finds: Find[], state: CloudState): boolean {
  return !state.sent || state.sent.hash !== fingerprint(locationsOf(finds));
}

/** The Map page's warning: changes have waited more than a day without reaching GitHub (null = nothing to say). */
export function cloudWarning(finds: Find[], state: CloudState, now: Date): string | null {
  if (!state.key || !state.failed || !needsSending(finds, state)) return null;
  if (now.getTime() - Date.parse(state.failed.since) <= WARN_AFTER_MS) return null;
  return `The automatic backup has not reached GitHub since ${new Date(state.failed.since).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}: ${state.failed.why}.`;
}

const CANNOT = 'That is not a backup of saved locations. Nothing was changed.';
/** The file read back from GitHub, checked whole: anything wrong and nothing on the phone changes. */
export function readLocationsFile(text: string): Location[] {
  let file: LocationsFile;
  try { file = JSON.parse(text) as LocationsFile; } catch { throw new BackupError(CANNOT); }
  if (!file || file.app !== BACKUP_APP || file.kind !== 'locations' || !Array.isArray(file.locations)) throw new BackupError(CANNOT);
  if (file.version !== FILE_VERSION) throw new BackupError(`That backup was made by ${file.version > FILE_VERSION ? 'a newer' : 'an older'} version of the app and can't be restored here. Nothing was changed.`);
  if (!file.locations.every((l) => isFind({ ...l, photoIds: [] }))) throw new BackupError(CANNOT);
  if (new Set(file.locations.map((l) => l.id)).size !== file.locations.length) throw new BackupError(CANNOT);
  return file.locations;
}

/** The locations as finds again — with no photos, which the file never held. */
export const asFinds = (locations: Location[]): Find[] => locations.map((l) => ({ ...l, photoIds: [] }));

// ---- GitHub ----

export type Fetch = (url: string, init?: RequestInit) => Promise<Response>;
export type Deps = { fetch?: Fetch; now?: () => Date; store?: Store | null };

/** Text as base64, the way the contents API wants it (UTF-8; in pieces, so a long file does not overflow a call). */
export function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function headers(key: string, accept = 'application/vnd.github+json'): Record<string, string> {
  return { Authorization: `Bearer ${key}`, Accept: accept, 'X-GitHub-Api-Version': '2022-11-28' };
}

/** What GitHub's answer means, in his words. */
export function whyRefused(status: number): string {
  if (status === 401) return 'GitHub refused the key (it may have run out — make a new one)';
  if (status === 403) return 'GitHub refused the key for that repository';
  if (status === 404) return 'GitHub cannot find the backup repository with this key';
  if (status === 409 || status === 422) return 'GitHub changed under us; it is tried again';
  if (status === 429) return 'GitHub asked us to slow down';
  return `GitHub answered ${status}`;
}

class Refused extends Error { constructor(public status: number) { super(whyRefused(status)); } }

/** The file's blob sha on GitHub (needed to replace it), or null when there is no file yet. Read off the branch's tree,
 * which has no size limit — the contents API stops describing a file past 1 MB. */
async function fileSha(fetchFn: Fetch, key: string): Promise<string | null> {
  const r = await fetchFn(`${API}/repos/${OWNER}/${REPO}/git/trees/${BRANCH}`, { headers: headers(key) });
  if (r.status === 404) return null; // no branch yet: the first push makes it
  if (!r.ok) throw new Refused(r.status);
  const tree = (await r.json()) as { tree?: Array<{ path: string; sha: string; type: string }> };
  return tree.tree?.find((e) => e.path === FILE && e.type === 'blob')?.sha ?? null;
}

async function putFile(fetchFn: Fetch, key: string, text: string, sha: string | null, message: string): Promise<Response> {
  const body: Record<string, string> = { message, content: toBase64(text), branch: BRANCH };
  if (sha) body.sha = sha;
  return fetchFn(`${API}/repos/${OWNER}/${REPO}/contents/${FILE}`, {
    method: 'PUT', headers: { ...headers(key), 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}

/** Sends the locations to GitHub and says how it went, as the new state (nothing is written to the store here). */
export async function sendLocations(finds: Find[], state: CloudState, deps: Deps = {}): Promise<CloudState> {
  const fetchFn = deps.fetch ?? ((u, i) => fetch(u, i));
  const now = (deps.now ?? (() => new Date()))();
  const at = now.toISOString();
  const failed = (why: string): CloudState => ({ ...state, failed: { since: state.failed?.since ?? at, at, why } });
  if (!state.key) return state;
  const locations = locationsOf(finds);
  const text = fileText(locations, now);
  const message = `Backup: ${locations.length} location${locations.length === 1 ? '' : 's'}`;
  try {
    let sha = await fileSha(fetchFn, state.key);
    // A phone with nothing on it never writes an empty file over a backup (a new phone, or one that lost its data): the
    // backup stays, and the screen offers Restore. Deleting his last location on purpose leaves the backup too — GitHub
    // keeps every version in any case.
    if (locations.length === 0 && sha !== null) return { ...state, failed: null, held: HELD_EMPTY };
    let r = await putFile(fetchFn, state.key, text, sha, message);
    if (r.status === 409 || r.status === 422) { // the file changed under us (another phone?): once more, with its new sha
      sha = await fileSha(fetchFn, state.key);
      r = await putFile(fetchFn, state.key, text, sha, message);
    }
    if (!r.ok) throw new Refused(r.status);
    return { ...state, sent: { at, ids: locations.map((l) => l.id), hash: fingerprint(locations) }, failed: null, held: null };
  } catch (e) {
    if (e instanceof Refused) return failed(e.message);
    return failed('no signal');
  }
}

/** The locations as GitHub holds them (raw, so a file past 1 MB still comes back whole). */
export async function fetchLocations(state: CloudState, deps: Deps = {}): Promise<Location[]> {
  const fetchFn = deps.fetch ?? ((u, i) => fetch(u, i));
  if (!state.key) throw new BackupError('The automatic backup is not set up on this phone.');
  let r: Response;
  try {
    r = await fetchFn(`${API}/repos/${OWNER}/${REPO}/contents/${FILE}?ref=${BRANCH}`, { headers: headers(state.key, 'application/vnd.github.raw+json') });
  } catch { throw new BackupError('GitHub could not be reached (no signal?). Nothing was changed.'); }
  if (r.status === 404) throw new BackupError('There is no backup on GitHub yet. Nothing was changed.');
  if (!r.ok) throw new BackupError(`${whyRefused(r.status)}. Nothing was changed.`);
  return readLocationsFile(await r.text());
}

/** Whether GitHub lets this key see the backup repository (the "Save key" check). */
export async function keyOpensRepo(key: string, deps: Deps = {}): Promise<{ ok: true } | { ok: false; why: string }> {
  const fetchFn = deps.fetch ?? ((u, i) => fetch(u, i));
  try {
    const r = await fetchFn(`${API}/repos/${OWNER}/${REPO}`, { headers: headers(key) });
    return r.ok ? { ok: true } : { ok: false, why: whyRefused(r.status) };
  } catch { return { ok: false, why: 'no signal' }; }
}

// ---- the runner: when to send ----

const listeners = new Set<(s: CloudState) => void>();
export function onCloud(listener: (s: CloudState) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function tell(s: CloudState) { for (const l of listeners) l(s); }

let inFlight: Promise<void> | null = null;
let again = false;
/** Sends now if there is a key and something to send — unless the last try failed less than RETRY_AFTER_MS ago and this
 * is not a forced try (a Save key, or Back up now). Two calls at once become one send and one more after it. */
export async function trySend(listFinds: () => Promise<Find[]>, opts: { force?: boolean } & Deps = {}): Promise<void> {
  if (inFlight) { again = true; return inFlight; }
  inFlight = (async () => {
    try {
      do {
        again = false;
        const state = readCloud(opts.store);
        if (!state.key) return;
        const now = (opts.now ?? (() => new Date()))();
        if (!opts.force && state.failed && now.getTime() - Date.parse(state.failed.at) < RETRY_AFTER_MS) return;
        const finds = await listFinds();
        if (!needsSending(finds, state)) return;
        if (state.held && finds.length === 0 && !opts.force) return; // still an empty phone: nothing to send, nothing to ask
        const next = await sendLocations(finds, state, opts);
        writeCloud(next, opts.store);
        tell(next);
      } while (again);
    } catch { /* a send never breaks the app; the next change or signal tries again */ }
  })().finally(() => { inFlight = null; });
  return inFlight;
}

/** Keeps the key (after GitHub accepted it) and sends at once. */
export async function setKey(key: string, listFinds: () => Promise<Find[]>, deps: Deps = {}): Promise<{ ok: true } | { ok: false; why: string }> {
  const check = await keyOpensRepo(key, deps);
  if (!check.ok) return check;
  const next: CloudState = { ...readCloud(deps.store), key, failed: null, held: null };
  writeCloud(next, deps.store);
  tell(next);
  await trySend(listFinds, { ...deps, force: true });
  return { ok: true };
}

/** Called BEFORE a restore writes anything: when the phone will then hold exactly what GitHub holds, that is noted as
 * sent, so the restore does not push the same file straight back (the store says "changed" the moment it writes). A
 * phone that holds more than the backup is left to push, as it should. */
export function noteRestored(fetched: Location[], onPhone: Find[], deps: Deps = {}): CloudState {
  const state = readCloud(deps.store);
  const after = [...onPhone, ...asFinds(fetched).filter((f) => !onPhone.some((p) => p.id === f.id))];
  const hash = fingerprint(locationsOf(after));
  if (!state.key || hash !== fingerprint(locationsOf(asFinds(fetched)))) return state;
  const next: CloudState = { ...state, sent: { at: (deps.now ?? (() => new Date()))().toISOString(), ids: after.map((f) => f.id), hash }, failed: null, held: null };
  writeCloud(next, deps.store);
  tell(next);
  return next;
}

/** Forgets the key: nothing is sent any more, and nothing on GitHub is touched. */
export function forgetKey(store: Store | null = phoneStore()): void {
  writeCloud(NOT_SET_UP, store);
  tell(NOT_SET_UP);
}

/** Started once with the app: sends after every change to the locations, when the phone gets a signal back, and when
 * the app comes to the front. Never throws, never blocks the screen. */
export function startCloudBackup(listFinds: () => Promise<Find[]>, onFindsChanged: (l: () => void) => () => void): void {
  if (typeof window === 'undefined') return;
  const go = () => { void trySend(listFinds); };
  onFindsChanged(go);
  window.addEventListener('online', go);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') go(); });
  go();
}
