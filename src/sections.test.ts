import { describe, expect, it } from 'vitest';
import { SECTIONS, sectionHref, sectionOf } from './sections';
import { parseHash } from './router';

describe('the sections', () => {
  it('come in Stefan\'s order, the Map first; Learn is not one any more (10/10/2026); Dogs last (13/10/2026)', () => {
    expect(SECTIONS.map((s) => s.label)).toEqual(['Map', 'Scan', 'Guide', 'Identify', 'Dogs']);
  });
  it('each opens at its start', () => {
    // With no spot saved for the dogs (this test has no phone storage), Dogs opens the screen that saves one.
    expect(SECTIONS.map((s) => sectionHref(s.name))).toEqual(['#/map', '#/scan', '#/guide', '#/identify', '#/dogs']);
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
    expect(sectionOf(parseHash('#/dogs'))).toBe('dogs');
    expect(sectionOf(parseHash('#/dogs/new'))).toBe('dogs');
    expect(sectionOf(parseHash('#/dogs/go'))).toBe('dogs');
    expect(sectionOf(parseHash(''))).toBeNull();
    expect(sectionOf(parseHash('#/about'))).toBeNull();
    expect(sectionOf(parseHash('#/scan-speed'))).toBeNull();
    expect(sectionOf(parseHash('#/learn'))).toBeNull(); // still opens by its address; no tab lights up for it
  });
});
