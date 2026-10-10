import { describe, expect, it } from 'vitest';
import { byPhotos } from './identify-photos';
import type { Listed, Narrowed } from './identify';
import type { ClassInfo, Danger, SpeciesScore, Thresholds } from './scan/rules';

const T: Thresholds = { safety: 0.05, notSure: 0.3, offSeason: 0.5, group: 0.6 };
let id = 0;
const cls = (name: string, ours: string | null, danger: Danger): ClassInfo =>
  ({ id: id++, name, ours, danger, uk: true, months: Array(12).fill(1) });
/** A species' score from the photos, as speciesScores gives it. */
const sc = (sci: string, danger: Danger, score: number, safe = score, ours: string | null = sci): [string, SpeciesScore] =>
  [ours ?? `class ${id}`, { first: cls(sci, ours, danger), score, raw: score, safe }];
const fit = (sci: string, danger: Listed['danger'] = null): Listed => ({ slug: sci.toLowerCase(), english: sci, scientific: sci, danger });

describe('Identify, then photos: the species that fit his answers, in the order the photos put them', () => {
  const n: Narrowed = {
    matches: ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((x) => fit(x)).concat([fit('Deathcap', 'deadly'), fit('Unknowable')]),
    kept: [{ ...fit('Panther', 'poisonous'), keptFor: ['A'] }],
    nearMisses: [fit('Near')],
  };
  const scores = new Map([
    sc('A', null, 0.05), sc('B', null, 0.4), sc('C', null, 0.2), sc('D', null, 0.1), sc('E', null, 0.01), sc('F', null, 0.3),
    sc('G', null, 0.15), sc('Deathcap', 'deadly', 0.001), sc('Panther', 'poisonous', 0.002), sc('Near', null, 0.9),
  ]);

  it('puts the five most like the photos first, best first, and folds the others away', () => {
    const r = byPhotos(n, scores, T);
    expect(r.top.map((m) => m.scientific)).toEqual(['B', 'F', 'C', 'G', 'D']);
    expect(r.rest.map((m) => m.scientific)).toEqual(['A', 'E']);
    expect(r.notSure).toBe(false);
  });

  it('never folds away or ranks out of sight a dangerous species: it stays in sight whatever the photos say', () => {
    const r = byPhotos(n, scores, T);
    expect(r.rest.some((m) => m.danger)).toBe(false);
    expect(r.dangerous.map((m) => m.scientific)).toEqual(['Deathcap', 'Panther']); // the fit below the five, and the kept lookalike
  });

  it('lists apart the species the scan cannot recognise: the photos say nothing about them', () => {
    const r = byPhotos(n, scores, T);
    expect(r.unknown.map((m) => m.scientific)).toEqual(['Unknowable']);
    expect([...r.top, ...r.rest, ...r.dangerous].some((m) => m.scientific === 'Unknowable')).toBe(false);
  });

  it('warns of a dangerous species the photos could be although the answers ruled it out — only those', () => {
    const more = new Map([...scores,
      sc('Destroying Angel', 'deadly', 0.01, 0.06), // over the safety line, ruled out by an answer: warned of
      sc('Funeral Bell', 'deadly', 0.01, 0.02), // under the line: not
      sc('Brown Roll-rim', 'poisonous', 0.02, 0.09, null), // not in the guide, over the line: warned of, by the model's name
      sc('Harmless', null, 0.5, 0.5), // not dangerous: never a warning
      sc('Deathcap', 'deadly', 0.001, 0.2), // on the list already (it fits): no warning, it is in sight
    ]);
    const r = byPhotos(n, more, T);
    expect(r.warnings).toEqual([
      { name: 'Brown Roll-rim', ours: null, danger: 'poisonous' },
      { name: 'Destroying Angel', ours: 'Destroying Angel', danger: 'deadly' },
    ]);
  });

  it('says so when the photos do not point clearly to any of them', () => {
    const weak = new Map([...scores].map(([k, e]) => [k, { ...e, score: e.score / 2 }] as [string, SpeciesScore]));
    expect(byPhotos(n, weak, T).notSure).toBe(true); // the best, B, at 0.2 is under the 0.3 line
    const none = byPhotos({ matches: [fit('Unknowable')], kept: [], nearMisses: [] }, scores, T);
    expect(none.top).toEqual([]);
    expect(none.notSure).toBe(true);
  });

  it('keeps the guide\'s order between species the photos score the same', () => {
    const tie = new Map([sc('A', null, 0.3), sc('B', null, 0.3), sc('C', null, 0.3)]);
    expect(byPhotos({ matches: [fit('C'), fit('A'), fit('B')], kept: [], nearMisses: [] }, tie, T).top.map((m) => m.scientific))
      .toEqual(['C', 'A', 'B']);
  });
});
