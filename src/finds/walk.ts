import { distanceM, type LatLon } from './geo';

// A walk round the locations he is looking for (Stefan 13/10/2026: "select the mushroom to look for, in this case the
// penny bun, and then have the map plot out a walk from where I start hitting each location in a logical way"). It
// starts where he stands and visits every one of them, in the order that keeps the walking short.
//
// ⚠ The legs are straight lines over the ground — the distance a crow flies, not a path through the wood. There is no
// path map on the phone (the tiles are pictures, and a walk must work with no signal), so the order is what this works
// out; the walking is his, with the arrow on the walk-back screen. Everything here is in metres.

export type Stop = LatLon & { id: string };
export type Walk = {
  /** The locations in the order to walk them. */
  order: Stop[];
  /** How far each leg is: `legs[0]` from where he started to the first stop, and so on. */
  legs: number[];
  /** The whole walk, start to last stop. */
  total: number;
  /** How far the last stop is from where he started — said, never walked for him. */
  backToStart: number;
};

/** How long a given order takes, start included. */
function lengthOf(start: LatLon, order: Stop[]): number {
  let from: LatLon = start;
  let total = 0;
  for (const s of order) { total += distanceM(from, s); from = s; }
  return total;
}

/** Always walk to the nearest one not yet visited. A good start, and on its own it can leave one awkward stop stranded
 * — which is what the tidying below is for. Ties go to the one that was saved first, so the same locations always give
 * the same walk. */
function nearestFirst(start: LatLon, stops: Stop[]): Stop[] {
  const left = [...stops];
  const order: Stop[] = [];
  let from: LatLon = start;
  while (left.length > 0) {
    let best = 0;
    let bestM = distanceM(from, left[0]);
    for (let i = 1; i < left.length; i++) {
      const m = distanceM(from, left[i]);
      if (m < bestM - 0.000001) { best = i; bestM = m; }
    }
    from = left[best];
    order.push(left.splice(best, 1)[0]);
  }
  return order;
}

/** Untangle the walk: wherever it crosses itself, walking that stretch the other way round is shorter, so turn it
 * round. Repeated until nothing improves (two-opt). A handful of locations settles in a blink. */
function untangle(start: LatLon, order: Stop[]): Stop[] {
  let best = [...order];
  let bestM = lengthOf(start, best);
  // Each pass tries every stretch; a hundred passes is far more than a walk of this size can need.
  for (let pass = 0; pass < 100; pass++) {
    let better = false;
    for (let i = 0; i < best.length - 1; i++) {
      for (let k = i + 1; k < best.length; k++) {
        const tried = [...best.slice(0, i), ...best.slice(i, k + 1).reverse(), ...best.slice(k + 1)];
        const m = lengthOf(start, tried);
        if (m < bestM - 0.000001) { best = tried; bestM = m; better = true; }
      }
    }
    if (!better) break;
  }
  return best;
}

/** The walk: from where he stands, round every one of them, in the order that keeps it short. */
export function planWalk(start: LatLon, stops: Stop[]): Walk {
  const order = stops.length > 1 ? untangle(start, nearestFirst(start, stops)) : [...stops];
  const legs: number[] = [];
  let from: LatLon = start;
  for (const s of order) { legs.push(distanceM(from, s)); from = s; }
  return {
    order,
    legs,
    total: legs.reduce((a, b) => a + b, 0),
    backToStart: order.length > 0 ? distanceM(order[order.length - 1], start) : 0,
  };
}

/** The line to draw on the map: where he started, then each stop in order. */
export const walkLine = (start: LatLon, w: Walk): LatLon[] => [start, ...w.order];

/** Where he is in the walk: which stop he is on its way to, counting from 1; 0 = this location is not on the walk. */
export const stopNumber = (w: Walk, id: string): number => w.order.findIndex((s) => s.id === id) + 1;

/** The stop after this one, or null at the end of the walk. */
export function nextStop(w: Walk, id: string): Stop | null {
  const at = w.order.findIndex((s) => s.id === id);
  return at >= 0 && at + 1 < w.order.length ? w.order[at + 1] : null;
}
