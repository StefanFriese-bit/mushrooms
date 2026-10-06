import { describe, expect, it } from 'vitest';
import { checkTable, verdict } from './check';
import type { SpeciesRecord } from './types';
import field from '../content/species/field-mushroom.json';
import deathcapPage from '../content/species/deathcap.json';

const rec = field as unknown as SpeciesRecord;
const t = checkTable(rec);

describe('checkTable', () => {
  it('puts the species first, then its lookalikes in the page order, with their danger and pages', () => {
    expect(t.columns.map((c) => [c.english, c.kind, c.slug, c.danger])).toEqual([
      ['Field Mushroom', null, 'field-mushroom', null],
      ['Deathcap', 'deadly', 'deathcap', 'deadly'],
      ['Destroying Angel', 'deadly', 'destroying-angel', 'deadly'],
      ['Yellow Stainer', 'poisonous', 'yellow-stainer', 'poisonous'],
      ['Inky Mushroom', 'poisonous', 'inky-mushroom', 'poisonous'],
    ]);
  });
  it('a dangerous species being checked carries its own danger', () => {
    expect(checkTable(deathcapPage as unknown as SpeciesRecord).columns[0].danger).toBe('deadly');
  });
  it('has one row per feature, in order of first appearance', () => {
    expect(t.rows.map((r) => r.feature)).toEqual(
      ['Gills', 'Stem base', 'Cap colour', 'Spore print', 'Cut stem base', 'Smell', 'Ring', 'Stem base shape', 'Where it grows']);
  });
  it('gives the species its own words once, and a lookalike without that row no cell', () => {
    expect(t.rows[0].cells[0]).toBe('Pink from the start, then chocolate brown');
    expect(t.rows[2].cells.map((c) => c === null)).toEqual([false, false, true, true, true]);
  });
  it('joins two different wordings of the species for one feature', () => {
    const two = { ...rec, lookalikes: [
      { ...rec.lookalikes[0], tellApart: [{ feature: 'Gills', thisOne: 'Pink', thatOne: 'White', sources: [] }] },
      { ...rec.lookalikes[1], tellApart: [{ feature: 'gills', thisOne: 'Chocolate brown when old', thatOne: 'White', sources: [] }] },
    ] } as SpeciesRecord;
    expect(checkTable(two).rows).toEqual([{ feature: 'Gills', cells: ['Pink · Chocolate brown when old', 'White', 'White'] }]);
  });
});

describe('verdict', () => {
  const names = (cols: Array<{ english: string }>) => cols.map((c) => c.english);
  it('nothing ticked says nothing', () => {
    expect(verdict(t, new Map())).toEqual({ ticked: 0, ticks: [], dangerous: [], others: [] });
  });
  it('every tick on the Field Mushroom fits it, and nothing is dangerous', () => {
    const v = verdict(t, new Map(t.rows.map((_, i) => [i, 0])));
    expect([v.ticked, names(v.dangerous), names(v.others)]).toEqual([9, [], ['Field Mushroom']]);
  });
  it('a tick on a dangerous lookalike is red and names every lookalike with the same words in that row', () => {
    const v = verdict(t, new Map([[0, 0], [3, 1]])); // gills fit; spore print white = Deathcap AND Destroying Angel
    expect(v.ticks.map((x) => [x.feature, names(x.species), x.dangerous])).toEqual([
      ['Gills', ['Field Mushroom'], false],
      ['Spore print', ['Deathcap', 'Destroying Angel'], true],
    ]);
    expect(names(v.dangerous)).toEqual(['Deathcap', 'Destroying Angel']);
  });
  it('checking a deadly species: its own words are red; an edible lookalike\'s words are not a danger sign', () => {
    const d = checkTable(deathcapPage as unknown as SpeciesRecord);
    const base = d.rows.findIndex((r) => r.feature === 'Stem base');
    const spore = d.rows.findIndex((r) => r.feature === 'Spore print');
    const edible = verdict(d, new Map([[base, 1]])); // "No bag" = Field AND Horse Mushroom
    expect([names(edible.dangerous), names(edible.others)]).toEqual([[], ['Field Mushroom', 'Horse Mushroom']]);
    const own = verdict(d, new Map([[spore, 0]])); // "White" = the Deathcap's own words
    expect([names(own.dangerous), own.ticks[0].dangerous]).toEqual([['Deathcap'], true]);
  });
  it('ignores a tick on an empty cell', () => {
    expect(verdict(t, new Map([[2, 3]])).ticked).toBe(0);
  });
});
