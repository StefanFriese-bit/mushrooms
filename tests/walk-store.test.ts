import { describe, expect, it } from 'vitest';
import { clearWalk, isSavedWalk, readWalk, saveWalk, walkOf, WALK_KEY } from '../src/finds/walk-store';
import type { Walk } from '../src/finds/walk';

const store = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); }, m };
};
const start = { lat: 51.6588, lon: 0.0466 };
const walk: Walk = {
  order: [{ id: 'a', lat: 51.659, lon: 0.0466 }, { id: 'b', lat: 51.66, lon: 0.047 }],
  legs: [22, 115], total: 137, backToStart: 130,
};
const at = new Date('2026-10-13T09:00:00Z');

describe('the walk he is on, kept on the phone', () => {
  it('saves it and reads it back as it was', () => {
    const s = store();
    const saved = saveWalk(walk, start, at, s);
    expect(saved.order).toEqual(walk.order);
    expect(saved.start).toEqual(start);
    expect(readWalk(s)).toEqual(saved);
  });

  it('keeps one walk at a time: planning another replaces it', () => {
    const s = store();
    saveWalk(walk, start, at, s);
    const second: Walk = { order: [{ id: 'z', lat: 51.7, lon: 0.05 }], legs: [10], total: 10, backToStart: 10 };
    saveWalk(second, start, at, s);
    expect(readWalk(s)?.order.map((o) => o.id)).toEqual(['z']);
  });

  it('is this outing\'s while it is fresh, and forgotten after twelve hours', () => {
    const s = store();
    saveWalk(walk, start, at, s);
    expect(walkOf(at.getTime() + 11 * 3_600_000, s)?.total).toBe(137);
    expect(walkOf(at.getTime() + 13 * 3_600_000, s)).toBe(null);
    expect(readWalk(s)).not.toBe(null); // forgotten for the walk, still on the phone
  });

  it('a clock put back an hour does not throw the walk away', () => {
    const s = store();
    saveWalk(walk, start, at, s);
    expect(walkOf(at.getTime() - 30 * 60_000, s)).not.toBe(null);
    expect(walkOf(at.getTime() - 2 * 3_600_000, s)).toBe(null);
  });

  it('clearing it leaves nothing behind', () => {
    const s = store();
    saveWalk(walk, start, at, s);
    clearWalk(s);
    expect(readWalk(s)).toBe(null);
    expect(s.m.has(WALK_KEY)).toBe(false);
  });

  it('refuses anything that is not a walk, rather than drawing nonsense on the map', () => {
    expect(isSavedWalk(null)).toBe(false);
    expect(isSavedWalk({ ...walk, start, at: at.toISOString(), order: [] })).toBe(false);        // no stops
    expect(isSavedWalk({ ...walk, start, at: at.toISOString(), legs: [1] })).toBe(false);        // a leg per stop
    expect(isSavedWalk({ ...walk, start, at: 'whenever' })).toBe(false);
    expect(isSavedWalk({ ...walk, start: { lat: 999, lon: 0 }, at: at.toISOString() })).toBe(false);
    expect(isSavedWalk({ ...walk, start, at: at.toISOString(), order: [{ lat: 51, lon: 0 }] })).toBe(false); // no id
    expect(isSavedWalk({ ...walk, start, at: at.toISOString() })).toBe(true);
    const s = store();
    s.setItem(WALK_KEY, '{ not json');
    expect(readWalk(s)).toBe(null);
  });

  it('a phone that gives no storage still walks: saving never throws, and reading says there is none', () => {
    const dead = { getItem: () => { throw new Error('no'); }, setItem: () => { throw new Error('no'); }, removeItem: () => { throw new Error('no'); } };
    expect(() => saveWalk(walk, start, at, dead)).not.toThrow();
    expect(saveWalk(walk, start, at, dead).order).toEqual(walk.order); // the screen still has it
    expect(readWalk(dead)).toBe(null);
    expect(() => clearWalk(dead)).not.toThrow();
    expect(readWalk(null)).toBe(null);
  });
});
