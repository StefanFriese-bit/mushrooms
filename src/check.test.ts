import { describe, expect, it } from 'vitest';
import { checkTable, verdict } from './check';
import type { SpeciesRecord } from './types';
import field from '../content/species/field-mushroom.json';

const rec = field as unknown as SpeciesRecord;
const t = checkTable(rec);

describe('checkTable', () => {
  it('puts the species first, then its lookalikes in the page order, with their danger and pages', () => {
    expect(t.columns.map((c) => [c.english, c.kind, c.slug])).toEqual([
      ['Field Mushroom', null, 'field-mushroom'],
      ['Deathcap', 'deadly', 'deathcap'],
      ['Destroying Angel', 'deadly', 'destroying-angel'],
      ['Yellow Stainer', 'poisonous', 'yellow-stainer'],
    ]);
  });
  it('has one row per feature, in order of first appearance', () => {
    expect(t.rows.map((r) => r.feature)).toEqual(
      ['Gills', 'Stem base', 'Cap colour', 'Spore print', 'Cut stem base', 'Smell', 'Ring', 'Stem base shape']);
  });
  it('gives the species its own words once, and a lookalike without that row no cell', () => {
    expect(t.rows[0].cells[0]).toBe('Pink from the start, then chocolate brown');
    expect(t.rows[2].cells.map((c) => c === null)).toEqual([false, false, true, true]);
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
  it('nothing ticked says nothing', () => {
    expect(verdict(t, new Map())).toEqual({ ticked: 0, fitsSpecies: 0, fitsLookalike: [] });
  });
  it('every tick on the species fits it', () => {
    const v = verdict(t, new Map(t.rows.map((_, i) => [i, 0])));
    expect(v).toEqual({ ticked: 8, fitsSpecies: 8, fitsLookalike: [] });
  });
  it('a tick on a lookalike names it, and every other lookalike with the same words in that row', () => {
    const v = verdict(t, new Map([[0, 0], [3, 1]])); // gills fit; spore print white = Deathcap AND Destroying Angel
    expect(v.ticked).toBe(2);
    expect(v.fitsLookalike.map((f) => [f.feature, f.lookalikes.map((l) => l.english)])).toEqual([
      ['Spore print', ['Deathcap', 'Destroying Angel']],
    ]);
  });
  it('ignores a tick on an empty cell', () => {
    expect(verdict(t, new Map([[2, 3]])).ticked).toBe(0);
  });
});
