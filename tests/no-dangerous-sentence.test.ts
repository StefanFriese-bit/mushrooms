import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { siteNames } from '../src/species';
import type { SpeciesRecord } from '../src/types';

// "No dangerous lookalike" names the websites it rests on (10/10/2026): another trusted site may name a dangerous
// lookalike that only it names — a one-site fact stays off the page — so "the trusted sites" would claim too much.
const rec = (sources: Array<[string, string]>) =>
  ({ sources: sources.map(([id, title]) => ({ id, title, url: `https://example.org/${id}` })) }) as unknown as SpeciesRecord;

describe('the sites behind "no dangerous lookalike"', () => {
  const r = rec([['fn', 'First Nature — Lepista flaccida'], ['wf', 'Wild Food UK — Tawny Funnel'], ['wp', 'Wikipedia — Paralepista flaccida'],
    ['fn-cf', 'First Nature — Clitocybe gibba'], ['nt', 'NatureSpot']]);

  it('names them in the order cited, each website once', () => {
    expect(siteNames(r, ['fn', 'wf'])).toBe('First Nature and Wild Food UK');
    expect(siteNames(r, ['wf', 'fn', 'wp'])).toBe('Wild Food UK, First Nature and Wikipedia');
    expect(siteNames(r, ['fn', 'fn-cf', 'wf'])).toBe('First Nature and Wild Food UK'); // two First Nature pages: one website
  });

  it('takes a title with no " — " whole, and skips a source the record does not have', () => {
    expect(siteNames(r, ['nt', 'wf', 'missing'])).toBe('NatureSpot and Wild Food UK');
  });

  it('on every page that says it, rests on two different websites that the sentence can name', () => {
    const dir = new URL('../content/species/', import.meta.url);
    const pages = readdirSync(dir).filter((f) => f.endsWith('.json'))
      .map((f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8')) as SpeciesRecord);
    const saying = pages.filter((p) => p.noDangerousLookalike);
    expect(saying.length).toBeGreaterThan(0);
    for (const p of saying) {
      const words = siteNames(p, p.noDangerousLookalike!.sources);
      expect(words, p.slug).toMatch(/^[A-Z][\w ]+(, [A-Z][\w ]+)* and [A-Z][\w ]+$/);
    }
  });
});
