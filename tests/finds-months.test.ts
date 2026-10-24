import { describe, expect, it } from 'vitest';
import { byMonth, monthKey, monthLabel } from '../src/finds/months';
import type { Find } from '../src/finds/store';

const find = (id: string, at: string) => ({ id, at, spot: null, species: null, notes: '' }) as unknown as Find;

describe('the list by month (Stefan 24/10/2026)', () => {
  it('a drawer per month, newest month first, the list order kept inside a month', () => {
    const list = [find('a', '2026-10-23T16:58:00'), find('b', '2026-10-02T09:00:00'), find('c', '2026-09-30T18:00:00'),
      find('d', '2025-10-12T10:00:00')];
    const g = byMonth(list);
    expect(g.map((m) => m.label)).toEqual(['October 2026', 'September 2026', 'October 2025']);
    expect(g.map((m) => m.finds.map((f) => f.id))).toEqual([['a', 'b'], ['c'], ['d']]);
  });
  it('a month is the phone\'s own calendar month, and an empty list has no drawers', () => {
    expect(monthKey('2026-10-01T00:30:00')).toBe('2026-10');
    expect(monthLabel('2026-01')).toBe('January 2026');
    expect(byMonth([])).toEqual([]);
  });
  it('every location is in exactly one drawer', () => {
    const list = Array.from({ length: 40 }, (_, i) => find(String(i), new Date(2026, i % 7, 1 + (i % 27), 12).toISOString()));
    expect(byMonth(list).flatMap((m) => m.finds).length).toBe(40);
  });
});
