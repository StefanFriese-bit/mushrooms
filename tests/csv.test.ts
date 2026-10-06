import { describe, expect, it } from 'vitest';
import { parseCsv } from '../tools/lib/csv.ts';

describe('parseCsv', () => {
  it('reads a header and rows into objects', () => {
    expect(parseCsv('a,b\n1,2\n3,4\n')).toEqual([{ a: '1', b: '2' }, { a: '3', b: '4' }]);
  });
  it('keeps commas, doubled quotes and line breaks inside quoted fields', () => {
    expect(parseCsv('name,place\n"Smith, J","He said ""hi""\nthen left"\n'))
      .toEqual([{ name: 'Smith, J', place: 'He said "hi"\nthen left' }]);
  });
  it('accepts Windows line endings and a missing last line break', () => {
    expect(parseCsv('a,b\r\n1,2')).toEqual([{ a: '1', b: '2' }]);
  });
});
