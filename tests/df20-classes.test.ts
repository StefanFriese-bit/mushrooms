import { describe, expect, it } from 'vitest';
import { binomial, df20Classes, matchClasses } from '../tools/lib/df20-classes.ts';

const row = (class_id: string, species: string, scientificName: string) => ({ class_id, species, scientificName });

describe('binomial', () => {
  it('takes genus and species from a name with its author', () => {
    expect(binomial('Inocybe lilacina (Peck) Kauffman')).toBe('Inocybe lilacina');
    expect(binomial('Amanita muscaria var. formosa')).toBe('Amanita muscaria');
    expect(binomial('fungus')).toBeNull();
  });
});

describe('df20Classes', () => {
  it('gives one entry per class with its own name, the species it is filed under and its photo count', () => {
    const classes = df20Classes([row('1', 'Inocybe geophylla', 'Inocybe geophylla (Bull.) P.Kumm.'),
      row('0', 'Amanita muscaria', 'Amanita muscaria (L.) Lam.'), row('1', 'Inocybe geophylla', 'Inocybe geophylla (Bull.) P.Kumm.')]);
    expect(classes).toEqual([
      { id: 0, name: 'Amanita muscaria', filedAs: 'Amanita muscaria', photos: 1 },
      { id: 1, name: 'Inocybe geophylla', filedAs: 'Inocybe geophylla', photos: 2 },
    ]);
  });
});

describe('matchClasses', () => {
  const classes = [
    { id: 0, name: 'Inocybe geophylla', filedAs: 'Inocybe geophylla', photos: 9 },
    { id: 1, name: 'Inocybe lilacina', filedAs: 'Inocybe geophylla', photos: 9 },
    { id: 2, name: 'Lepista nuda', filedAs: 'Lepista nuda', photos: 9 },
    { id: 3, name: 'Cantharellus pallens', filedAs: 'Cantharellus cibarius', photos: 9 },
    { id: 4, name: 'Cantharellus cibarius', filedAs: 'Cantharellus cibarius', photos: 9 },
    { id: 5, name: 'Xerocomus oldname', filedAs: 'Boletus edulis', photos: 9 },
  ];
  const ours = [
    { name: 'Inocybe geophylla', olderNames: [] }, { name: 'Inocybe lilacina', olderNames: [] },
    { name: 'Collybia nuda', olderNames: ['Lepista nuda'] }, { name: 'Cantharellus cibarius', olderNames: [] },
    { name: 'Boletus edulis', olderNames: [] },
  ];
  const m = matchClasses(classes, ours);
  it("matches a class on its own name, never the name it is filed under when that name is another class's own", () => {
    expect(m.get(0)).toBe('Inocybe geophylla');
    expect(m.get(1)).toBe('Inocybe lilacina');
    expect(m.get(3)).toBeUndefined();
    expect(m.get(4)).toBe('Cantharellus cibarius');
  });
  it('matches through an older name, and falls back to the filed-under name only when no class owns it', () => {
    expect(m.get(2)).toBe('Collybia nuda');
    expect(m.get(5)).toBe('Boletus edulis');
  });
});
