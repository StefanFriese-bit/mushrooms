import { describe, expect, it } from 'vitest';
import { SECTIONS, sectionHref, sectionOf } from './sections';
import { parseHash } from './router';

describe('the five sections', () => {
  it('come in Stefan\'s order, the Map first', () => {
    expect(SECTIONS.map((s) => s.label)).toEqual(['Map', 'Scan', 'Guide', 'Identify', 'Learn']);
  });
  it('each opens at its start', () => {
    expect(SECTIONS.map((s) => sectionHref(s.name))).toEqual(['#/map', '#/scan', '#/guide', '#/identify', '#/learn']);
    for (const s of SECTIONS) expect(parseHash(sectionHref(s.name)).name).toBe(s.name);
  });
  it('light up for the pages inside them, and not on the home page or About', () => {
    expect(sectionOf(parseHash('#/finds'))).toBe('map');
    expect(sectionOf(parseHash('#/finds/new'))).toBe('map');
    expect(sectionOf(parseHash('#/finds/2f1c'))).toBe('map');
    expect(sectionOf(parseHash('#/finds/2f1c/go'))).toBe('map');
    expect(sectionOf(parseHash('#/species/deathcap'))).toBe('guide');
    expect(sectionOf(parseHash('#/check/deathcap'))).toBe('guide');
    expect(sectionOf(parseHash('#/identify?underside=gills'))).toBe('identify');
    expect(sectionOf(parseHash(''))).toBeNull();
    expect(sectionOf(parseHash('#/about'))).toBeNull();
    expect(sectionOf(parseHash('#/scan-speed'))).toBeNull();
  });
});
