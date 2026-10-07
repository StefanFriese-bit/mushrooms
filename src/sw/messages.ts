// What the service worker (src/sw/sw.ts) and the page (src/update.ts) say to each other. No DOM and no worker types
// here, so both sides (and the unit tests) can import it.

export type SwMessage =
  | { type: 'PRECACHE_PROGRESS'; done: number; total: number }
  | { type: 'SKIP_WAITING' };

/** The progress the page is told about: a message per whole per cent (and the last file), not one per file. */
export function progressStep(done: number, total: number): number {
  if (total <= 0) return 100;
  return done >= total ? 100 : Math.floor((100 * done) / total);
}
