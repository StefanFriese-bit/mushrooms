import { describe, expect, it } from 'vitest';
import { pickTestObservations } from '../tools/lib/test-photo-picker.ts';

const obs = (id: number, login: string, licences: (string | null)[], observed_on: string | null = '2025-10-12') => ({
  id, user: { login }, observed_on,
  photos: licences.map((l, k) => ({ id: id * 10 + k, license_code: l, url: `https://x/photos/${id * 10 + k}/square.jpg` })),
});

describe('pickTestObservations', () => {
  it('skips the guide own observations, photos without an open licence, and observations without a date', () => {
    const picked = pickTestObservations([obs(1, 'a', ['cc-by']), obs(2, 'b', [null]), obs(3, 'c', ['cc-by-nd'], null), obs(4, 'd', ['cc-by-sa'])], new Set([1]), 10);
    expect(picked.map((p) => p.obsId)).toEqual([4]);
  });
  it('takes up to three photos per observation, at 500 px', () => {
    const [p] = pickTestObservations([obs(5, 'a', ['cc0', 'cc-by', 'cc-by-nc', 'cc-by'])], new Set(), 10);
    expect(p.urls).toEqual(['https://x/photos/50/medium.jpg', 'https://x/photos/51/medium.jpg', 'https://x/photos/52/medium.jpg']);
    expect(p.month).toBe(10);
  });
  it('spreads the picks over observers before taking a second from anyone', () => {
    const picked = pickTestObservations([obs(1, 'a', ['cc0']), obs(2, 'a', ['cc0']), obs(3, 'a', ['cc0']), obs(4, 'b', ['cc0'])], new Set(), 3);
    expect(picked.map((p) => p.obsId)).toEqual([1, 4, 2]);
  });
});
