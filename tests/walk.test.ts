import { describe, expect, it } from 'vitest';
import { distanceM } from '../src/finds/geo';
import { nextStop, planWalk, stopNumber, walkLine, type Stop } from '../src/finds/walk';

// A patch of wood near Epping, laid out by hand so the right answer can be worked out on paper. At this latitude
// 0.0001° of latitude is about 11 m north, and 0.0001° of longitude about 7 m east.
const base = { lat: 51.6588, lon: 0.0466 };
const at = (northM: number, eastM: number, id: string): Stop =>
  ({ id, lat: base.lat + northM / 111320, lon: base.lon + eastM / (111320 * Math.cos((base.lat * Math.PI) / 180)) });
const ids = (l: Stop[]) => l.map((s) => s.id);
const round = (m: number) => Math.round(m);

describe('planning a walk round the locations he is looking for', () => {
  it('walks them nearest first when that is simply the way they lie', () => {
    const w = planWalk(base, [at(300, 0, 'far'), at(100, 0, 'near'), at(200, 0, 'middle')]);
    expect(ids(w.order)).toEqual(['near', 'middle', 'far']);
    expect(w.legs.map(round)).toEqual([100, 100, 100]);
    expect(round(w.total)).toBe(300);
    expect(round(w.backToStart)).toBe(300);
  });

  it('does not strand the odd one out: it untangles a walk that doubling back would waste', () => {
    // Four in a line east, but offered worst-first. Nearest-first alone would still find this one; the point of the
    // test below is the case where it cannot.
    const w = planWalk(base, [at(0, 400, 'd'), at(0, 100, 'a'), at(0, 300, 'c'), at(0, 200, 'b')]);
    expect(ids(w.order)).toEqual(['a', 'b', 'c', 'd']);
    expect(round(w.total)).toBe(400);
  });

  it('beats walking them in the order they were saved, on a layout that traps nearest-first', () => {
    // A horseshoe: going for the nearest first leads him into the bend and leaves a long haul back out.
    const stops = [at(10, 0, 's1'), at(120, 20, 's2'), at(130, 140, 's3'), at(20, 160, 's4'), at(-10, 80, 's5')];
    const w = planWalk(base, stops);
    const asSaved = stops.reduce((acc, s, i) => acc + distanceM(i === 0 ? base : stops[i - 1], s), 0);
    expect(w.total).toBeLessThanOrEqual(asSaved);
    // Every one of them is walked, once.
    expect(ids(w.order).sort()).toEqual(['s1', 's2', 's3', 's4', 's5']);
  });

  it('untangles a walk that going for the nearest one first gets wrong', () => {
    // A real layout (found by searching, not invented): always walking to the nearest unvisited one leads him
    // s3 s2 s4 s1 s6 s5 — 1,754 m, crossing its own tracks. Untangled it is s4 s2 s3 s6 s1 s5, 1,291 m: a quarter
    // less walking for the same six locations. Without the untangling step this test fails.
    const stops = [at(30, -250, 's1'), at(-240, 130, 's2'), at(-230, -20, 's3'),
      at(-110, 210, 's4'), at(290, -270, 's5'), at(-210, -270, 's6')];
    const w = planWalk(base, stops);
    expect(ids(w.order)).toEqual(['s4', 's2', 's3', 's6', 's1', 's5']);
    expect(round(w.total)).toBe(1291);
    expect(w.total).toBeLessThan(1754 - 400);
  });

  it('never leaves a location out and never visits one twice, however they lie', () => {
    const many = Array.from({ length: 12 }, (_, i) => at(((i * 37) % 11) * 40 - 200, ((i * 53) % 7) * 60 - 180, `p${i}`));
    const w = planWalk(base, many);
    expect(ids(w.order).sort()).toEqual(many.map((s) => s.id).sort());
    expect(w.legs).toHaveLength(many.length);
    // The legs are the walk: each one is the distance from the one before.
    let from = base;
    w.order.forEach((s, i) => { expect(round(w.legs[i])).toBe(round(distanceM(from, s))); from = s; });
  });

  it('gives the same walk every time for the same locations', () => {
    const stops = [at(100, 100, 'x'), at(-50, 70, 'y'), at(10, -120, 'z')];
    const first = ids(planWalk(base, stops).order);
    for (let i = 0; i < 5; i++) expect(ids(planWalk(base, [...stops]).order)).toEqual(first);
  });

  it('copes with one location, and with none', () => {
    const one = planWalk(base, [at(50, 0, 'only')]);
    expect(ids(one.order)).toEqual(['only']);
    expect(round(one.total)).toBe(50);
    expect(round(one.backToStart)).toBe(50);
    const none = planWalk(base, []);
    expect(none.order).toEqual([]);
    expect(none.total).toBe(0);
    expect(none.backToStart).toBe(0);
  });

  it('draws from where he started, through the stops in order', () => {
    const w = planWalk(base, [at(200, 0, 'b'), at(100, 0, 'a')]);
    expect(walkLine(base, w)).toEqual([base, ...w.order]);
  });

  it('says which stop a location is, and what comes after it', () => {
    const w = planWalk(base, [at(300, 0, 'c'), at(100, 0, 'a'), at(200, 0, 'b')]);
    expect(stopNumber(w, 'a')).toBe(1);
    expect(stopNumber(w, 'c')).toBe(3);
    expect(stopNumber(w, 'not-on-it')).toBe(0);
    expect(nextStop(w, 'a')?.id).toBe('b');
    expect(nextStop(w, 'c')).toBe(null); // the last one: the walk is done
    expect(nextStop(w, 'not-on-it')).toBe(null);
  });
});
