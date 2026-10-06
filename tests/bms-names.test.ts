import { describe, expect, it } from 'vitest';
import { englishName, nameClashes, parseBmsLatinToEnglish, tidyEnglish } from '../tools/lib/bms-names.ts';

const SAMPLE = [
  'List of Recommended English',
  'Names For Fungi in the UK',
  'Latin to English names',
  'Current Scientific Latin name Recommended English',
  'Abortiporus biennis Blushing Rosette',
  'Agaricus arvensis Horse Mushroom',
  'Agaricus augustus The Prince',
  "Exidia glandulosa Witches' Butter",
  'Auricularia auricula-judae Jelly Ear',
  'Hericium erinaceum Bearded Tooth *',
  'Astraeus hygrometricus',
  'Barometer Earthstar',
  '7',
  'English to Latin names',
  'Horse Mushroom Agaricus arvensis',
].join('\n');

describe('parseBmsLatinToEnglish', () => {
  const { names, unparsed } = parseBmsLatinToEnglish(SAMPLE);

  it('reads "Genus species English Name" lines', () => {
    expect(names.get('Agaricus arvensis')).toBe('Horse Mushroom');
    expect(names.get('Agaricus augustus')).toBe('The Prince');
    expect(names.get('Exidia glandulosa')).toBe("Witches' Butter");
    expect(names.get('Auricularia auricula-judae')).toBe('Jelly Ear');
  });

  it('drops the footnote star some names carry (10 in the 2005 list)', () => {
    expect(names.get('Hericium erinaceum')).toBe('Bearded Tooth');
  });

  it('treats a page break as a line break (22 in the 2005 list put the page number after the last name)', () => {
    const paged = parseBmsLatinToEnglish(
      ['Current Scientific Latin name Recommended English', 'Byssomerulius corium Netted Crust\f2', 'Agaricus arvensis Horse Mushroom', 'English to Latin names'].join('\n'),
    );
    expect(paged.names.get('Byssomerulius corium')).toBe('Netted Crust');
    expect(paged.unparsed).toEqual(['2']);
  });

  it('joins a double name that wraps onto the next line, and nothing else', () => {
    const wrapped = parseBmsLatinToEnglish(
      [
        'Current Scientific Latin name Recommended English',
        'Coprinus comatus',
        "Shaggy Inkcap / Lawyer's",
        'Wig',
        'Camarophyllopsis atropuncta Dotted Fanvault',
        'Camarophyllopsis',
        'English to Latin names',
      ].join('\n'),
    );
    expect(wrapped.names.get('Coprinus comatus')).toBe("Shaggy Inkcap / Lawyer's Wig");
    expect(wrapped.names.get('Camarophyllopsis atropuncta')).toBe('Dotted Fanvault');
    expect(wrapped.unparsed).toEqual(['Camarophyllopsis']);
  });

  it('joins a Latin name and its English name split over two lines', () => {
    expect(names.get('Astraeus hygrometricus')).toBe('Barometer Earthstar');
  });

  it('stops at the English-to-Latin section and reports what it did not understand', () => {
    expect(names.size).toBe(7);
    expect(unparsed).toEqual(['7']);
  });

  it('refuses a text without the Latin-to-English section', () => {
    expect(() => parseBmsLatinToEnglish('nothing here')).toThrow(/Latin-to-English section/);
  });
});

describe('englishName', () => {
  const bms = new Map([
    ['Agaricus arvensis', 'Horse Mushroom'],
    ['Lepista nuda', 'Wood Blewit'],
  ]);
  it('prefers the BMS name', () => {
    expect(englishName('Agaricus arvensis', bms, 'horse mushroom')).toEqual({ english: 'Horse Mushroom', source: 'bms-2005', via: null });
  });
  it('finds the BMS name under an older scientific name', () => {
    expect(englishName('Collybia nuda', bms, 'Blewit', ['Lepista nuda'])).toEqual({ english: 'Wood Blewit', source: 'bms-2005', via: 'Lepista nuda' });
  });
  it("falls back to iNaturalist's name, tidied, then to none", () => {
    expect(englishName('Boletus edulis', bms, 'penny bun')).toEqual({ english: 'Penny Bun', source: 'inaturalist', via: null });
    expect(englishName('Boletus edulis', bms, null)).toEqual({ english: null, source: null, via: null });
  });
});

describe('tidyEnglish', () => {
  it('capitalises words but keeps the small ones small', () => {
    expect(tidyEnglish('chicken of the woods')).toBe('Chicken of the Woods');
    expect(tidyEnglish("hare's foot inkcap")).toBe("Hare's Foot Inkcap");
    expect(tidyEnglish('dung-loving Deconica')).toBe('Dung-loving Deconica');
  });
});

describe('nameClashes', () => {
  it('finds an English name given to two species, and one that the BMS list gives to another species', () => {
    const bms = new Map([['Conocybe tenera', 'Common Conecap']]);
    const rows = [
      { name: 'Pholiotina rugosa', english: 'Common Conecap' },
      { name: 'Aaa bbb', english: 'Same Name' },
      { name: 'Ccc ddd', english: 'same name' },
      { name: 'Conocybe tenera', english: 'Common Conecap' },
    ];
    expect(nameClashes(rows, bms)).toEqual([
      '"Common Conecap" is used for Pholiotina rugosa and Conocybe tenera',
      '"Same Name" is used for Aaa bbb and Ccc ddd',
      '"Common Conecap" (Pholiotina rugosa) is the BMS name of Conocybe tenera',
    ]);
  });
});
