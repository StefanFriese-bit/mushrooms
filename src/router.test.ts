import { describe, expect, it } from 'vitest';
import { hrefFor, parseHash } from './router.ts';

describe('parseHash', () => {
  it('opens the guide by default', () => {
    expect(parseHash('')).toEqual({ name: 'guide', query: '' });
    expect(parseHash('#/')).toEqual({ name: 'guide', query: '' });
  });
  it('reads the guide search', () => {
    expect(parseHash('#/guide?q=cap')).toEqual({ name: 'guide', query: 'cap' });
  });
  it('reads a species page', () => {
    expect(parseHash('#/species/field-mushroom')).toEqual({ name: 'species', slug: 'field-mushroom' });
  });
  it('reads the other tabs', () => {
    for (const n of ['scan', 'identify', 'finds', 'learn', 'about'] as const) expect(parseHash(`#/${n}`)).toEqual({ name: n });
  });
  it('reports an unknown address', () => {
    expect(parseHash('#/nowhere')).toEqual({ name: 'not-found', path: '/nowhere' });
  });
});

describe('hrefFor', () => {
  it('round-trips', () => {
    expect(hrefFor({ name: 'species', slug: 'deathcap' })).toBe('#/species/deathcap');
    expect(hrefFor({ name: 'guide', query: 'yellow stainer' })).toBe('#/guide?q=yellow+stainer');
    expect(parseHash(hrefFor({ name: 'guide', query: 'yellow stainer' }))).toEqual({ name: 'guide', query: 'yellow stainer' });
  });
});
