import { describe, expect, it } from 'vitest';
import { hrefFor, parseHash } from './router.ts';

describe('parseHash', () => {
  it('opens the home page by default', () => {
    expect(parseHash('')).toEqual({ name: 'home' });
    expect(parseHash('#/')).toEqual({ name: 'home' });
    expect(hrefFor({ name: 'home' })).toBe('#/');
  });
  it('opens the guide at its own address', () => {
    expect(parseHash('#/guide')).toEqual({ name: 'guide', query: '' });
    expect(parseHash('#/guide/extra')).toEqual({ name: 'not-found', path: '/guide/extra' });
  });
  it('reads the guide search', () => {
    expect(parseHash('#/guide?q=cap')).toEqual({ name: 'guide', query: 'cap' });
  });
  it('reads a species page', () => {
    expect(parseHash('#/species/field-mushroom')).toEqual({ name: 'species', slug: 'field-mushroom' });
  });
  it('reads the other tabs', () => {
    for (const n of ['map', 'scan', 'finds', 'learn', 'about', 'scan-speed'] as const) expect(parseHash(`#/${n}`)).toEqual({ name: n });
  });
  it('keeps the Identify answers as they are written', () => {
    expect(parseHash('#/identify')).toEqual({ name: 'identify', query: '' });
    expect(parseHash('#/identify?underside=gills&ring=unsure')).toEqual({ name: 'identify', query: 'underside=gills&ring=unsure' });
  });
  it('reads a check', () => {
    expect(parseHash('#/check/field-mushroom')).toEqual({ name: 'check', slug: 'field-mushroom' });
    expect(parseHash('#/check')).toEqual({ name: 'not-found', path: '/check' });
  });
  it('reads the finds: the map, a new find and one find', () => {
    expect(parseHash('#/finds')).toEqual({ name: 'finds' });
    expect(parseHash('#/finds/new')).toEqual({ name: 'find-new' });
    expect(parseHash('#/finds/2f1c')).toEqual({ name: 'find', id: '2f1c' });
    expect(hrefFor({ name: 'find', id: '2f1c' })).toBe('#/finds/2f1c');
    expect(hrefFor({ name: 'find-new' })).toBe('#/finds/new');
    expect(parseHash('#/finds/2f1c/go')).toEqual({ name: 'find-go', id: '2f1c' }); // walking back to it
    expect(hrefFor({ name: 'find-go', id: '2f1c' })).toBe('#/finds/2f1c/go');
  });
  it('reports an unknown address, and sends it home', () => {
    expect(parseHash('#/nowhere')).toEqual({ name: 'not-found', path: '/nowhere' });
    expect(hrefFor({ name: 'not-found', path: '/nowhere' })).toBe('#/');
  });
});

describe('hrefFor', () => {
  it('round-trips', () => {
    expect(hrefFor({ name: 'species', slug: 'deathcap' })).toBe('#/species/deathcap');
    expect(hrefFor({ name: 'guide', query: 'yellow stainer' })).toBe('#/guide?q=yellow+stainer');
    expect(parseHash(hrefFor({ name: 'guide', query: 'yellow stainer' }))).toEqual({ name: 'guide', query: 'yellow stainer' });
    expect(hrefFor({ name: 'identify', query: 'underside=gills' })).toBe('#/identify?underside=gills');
    expect(hrefFor({ name: 'identify', query: '' })).toBe('#/identify');
    expect(hrefFor({ name: 'check', slug: 'deathcap' })).toBe('#/check/deathcap');
  });
});
