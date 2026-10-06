import { describe, expect, it } from 'vitest';
import { selectSpecies, type Candidate, type SelectInput } from '../tools/lib/select.ts';

const cand = (name: string, ukRecords: number, inatId = name.length): Candidate => ({
  inatId,
  name,
  ukRecords,
  inatEnglish: null,
  photo: null,
});

function input(over: Partial<SelectInput> = {}): SelectInput {
  const core = new Map<string, Candidate>([
    ['Edibilis bonus', cand('Edibilis bonus', 50)],
    ['Mortalis rarus', cand('Mortalis rarus', 0)],
    ['Similis malus', cand('Similis malus', 40)],
  ]);
  return {
    ranked: [cand('Communis primus', 900), cand('Communis secundus', 800), cand('Similis malus', 40), cand('Edibilis bonus', 50)],
    core,
    edibles: ['Edibilis bonus'],
    dangerous: [
      { name: 'Mortalis rarus', level: 'deadly' },
      { name: 'Similis malus', level: 'poisonous' },
    ],
    lookalikeNames: new Set(['Similis malus']),
    add: new Map(),
    remove: [],
    target: 5,
    ...over,
  };
}

describe('selectSpecies', () => {
  it('takes every core species first, with its reasons, then the most recorded', () => {
    const { picked } = selectSpecies(input());
    expect(picked.map((p) => [p.name, p.reasons])).toEqual([
      ['Edibilis bonus', ['edible']],
      ['Mortalis rarus', ['deadly']],
      ['Similis malus', ['dangerous-lookalike']],
      ['Communis primus', ['most-recorded']],
      ['Communis secundus', ['most-recorded']],
    ]);
    expect(picked.find((p) => p.name === 'Mortalis rarus')?.dangerLevel).toBe('deadly');
    expect(picked.find((p) => p.name === 'Similis malus')?.dangerLevel).toBe('poisonous');
  });

  it('stops at the target', () => {
    expect(selectSpecies(input({ target: 4 })).picked).toHaveLength(4);
  });

  it('keeps a core species that has no UK records, and says so', () => {
    const { picked, notes } = selectSpecies(input());
    expect(picked.some((p) => p.name === 'Mortalis rarus')).toBe(true);
    expect(notes).toContain('Mortalis rarus has no UK research-grade records on iNaturalist; it is in for safety.');
  });

  it('honours a removal of an ordinary species and does not refill it', () => {
    const { picked } = selectSpecies(input({ remove: ['Communis primus'], target: 5 }));
    expect(picked.map((p) => p.name)).not.toContain('Communis primus');
  });

  it('refuses to remove a deadly species or a dangerous lookalike', () => {
    const { picked, notes } = selectSpecies(input({ remove: ['Mortalis rarus', 'Similis malus'] }));
    expect(picked.map((p) => p.name)).toEqual(expect.arrayContaining(['Mortalis rarus', 'Similis malus']));
    expect(notes).toContain('Kept Mortalis rarus: dangerous lookalikes and deadly species always stay in the guide.');
  });

  it("adds Stefan's additions with their own reason", () => {
    const add = new Map([['Addita nova', cand('Addita nova', 3)]]);
    const { picked } = selectSpecies(input({ add, target: 6 }));
    expect(picked.find((p) => p.name === 'Addita nova')?.reasons).toEqual(['added-by-stefan']);
  });

  it('says when there are not enough species for the target', () => {
    const { notes } = selectSpecies(input({ target: 50 }));
    expect(notes).toContain('Only 5 species available for a target of 50.');
  });

  it('fails loudly when a core species was not resolved', () => {
    expect(() => selectSpecies(input({ edibles: ['Ignotus nomen'] }))).toThrow(/Ignotus nomen/);
  });
});
