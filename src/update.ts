import { registerSW } from 'virtual:pwa-register';
import { progressStep, type SwMessage } from './sw/messages';

// How a new version reaches the phone (spec 4.3), and what he is told about it. The worker (src/sw/sw.ts) downloads a
// new version in the background and reports how far it has got; once it is complete it waits, and he decides when to
// restart into it — never in the middle of something (the bar is not offered while a find is being added).
// The first time the app is opened the same download fills the phone; he is told when the guide works without signal.

export type UpdateState =
  | { kind: 'idle' }
  /** Downloading: the first fill of the phone (`first`) or a new version. */
  | { kind: 'downloading'; first: boolean; done: number; total: number }
  /** A new version is complete and waiting for his Restart. */
  | { kind: 'ready' }
  /** The first fill finished: the guide works without signal. */
  | { kind: 'offline-ready' }
  /** A download stopped before the end (signal lost, app closed); it carries on the next time, from where it was. */
  | { kind: 'stopped'; first: boolean };

let state: UpdateState = { kind: 'idle' };
const listeners = new Set<(s: UpdateState) => void>();
function set(next: UpdateState) {
  state = next;
  for (const l of listeners) l(state);
}
export const currentUpdate = () => state;
export function onUpdate(listener: (s: UpdateState) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** What the bar says, or null for no bar. `addingFind`: the "Add a find" screen is open (no Restart offered there). */
export function updateText(s: UpdateState, addingFind: boolean): { text: string; percent?: number; action?: 'restart' | 'dismiss' } | null {
  switch (s.kind) {
    case 'idle': return null;
    case 'downloading': {
      const percent = progressStep(s.done, s.total);
      return s.first
        ? { text: `Saving the guide on this phone for use without signal: ${percent}%`, percent }
        : { text: `Downloading a new version: ${percent}%. You can keep using the app.`, percent };
    }
    case 'ready': return addingFind ? null : { text: 'A new version is ready.', action: 'restart' };
    case 'offline-ready': return { text: 'Saved on this phone: the guide now works without signal.', action: 'dismiss' };
    case 'stopped': return {
      text: s.first ? 'Saving for use without signal stopped part-way. It carries on the next time the app is open with signal.'
        : 'The new version stopped downloading part-way. It carries on the next time the app is open with signal.',
      action: 'dismiss',
    };
  }
}

/** Updates are looked for when the app comes back to the front, at most this often (a home-screen app resumed from the
 * background does not reload, so the browser itself would not look). */
const CHECK_EVERY_MS = 30 * 60 * 1000;
let restart: ((reload?: boolean) => Promise<void>) | null = null;

export function startUpdates() {
  if (!('serviceWorker' in navigator)) return;
  const first = () => !navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('message', (event) => {
    const m = event.data as SwMessage | undefined;
    if (m?.type !== 'PRECACHE_PROGRESS') return;
    // A message can arrive after the download it belongs to has finished: never step back from "ready" or "saved".
    if (state.kind === 'ready' || state.kind === 'offline-ready') return;
    set({ kind: 'downloading', first: first(), done: m.done, total: m.total });
  });
  let lastCheck = Date.now();
  restart = registerSW({
    immediate: true,
    onNeedRefresh: () => set({ kind: 'ready' }),
    onOfflineReady: () => set({ kind: 'offline-ready' }),
    onRegisteredSW: (_url, reg) => {
      if (!reg) return;
      const watch = (worker: ServiceWorker | null) => worker?.addEventListener('statechange', () => {
        if (worker.state === 'redundant' && state.kind === 'downloading') set({ kind: 'stopped', first: state.first });
      });
      watch(reg.installing);
      reg.addEventListener('updatefound', () => watch(reg.installing));
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible' || reg.installing || Date.now() - lastCheck < CHECK_EVERY_MS) return;
        lastCheck = Date.now();
        reg.update().catch(() => { /* no signal: looked for again next time */ });
      });
    },
  });
}

/** He tapped Restart: the waiting version takes over and the page reloads into it. */
export function restartIntoNewVersion() {
  void restart?.(true);
}

/** He tapped OK on a message that needs nothing from him. */
export function dismissUpdateMessage() {
  if (state.kind === 'offline-ready' || state.kind === 'stopped') set({ kind: 'idle' });
}
