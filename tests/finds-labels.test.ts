import { describe, expect, it } from 'vitest';
import { findLabel } from '../src/finds/labels';

const names = new Map([['Cantharellus cibarius', 'Chanterelle']]);
describe('what a saved location is called', () => {
  it('is the first line of his description', () => {
    expect(findLabel({ notes: '\n  Penny Bun, five caps \nunder the beech', species: 'Cantharellus cibarius' }, names)).toBe('Penny Bun, five caps');
  });
  it('is shortened when the line is long', () => {
    const long = 'A great many chanterelles along the mossy bank beside the old fallen beech tree';
    const label = findLabel({ notes: long, species: null }, names);
    expect(label.length).toBeLessThanOrEqual(58);
    expect(label.endsWith('…')).toBe(true);
  });
  it('is the species he named when there is no description', () => {
    expect(findLabel({ notes: '', species: 'Cantharellus cibarius' }, names)).toBe('Chanterelle');
    expect(findLabel({ notes: '  ', species: 'Boletus edulis' }, names)).toBe('Boletus edulis'); // no English name loaded yet
  });
  it('is "Saved location" with neither', () => expect(findLabel({ notes: '', species: null }, names)).toBe('Saved location'));
});
