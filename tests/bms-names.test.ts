import { describe, expect, it } from 'vitest';
import { englishName, parseBmsLatinToEnglish } from '../tools/lib/bms-names.ts';

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
  const bms = new Map([['Agaricus arvensis', 'Horse Mushroom']]);
  it('prefers the BMS name', () => {
    expect(englishName('Agaricus arvensis', bms, 'horse mushroom')).toEqual({ english: 'Horse Mushroom', source: 'bms-2005' });
  });
  it("falls back to iNaturalist's name, then to none", () => {
    expect(englishName('Boletus edulis', bms, 'Penny Bun')).toEqual({ english: 'Penny Bun', source: 'inaturalist' });
    expect(englishName('Boletus edulis', bms, null)).toEqual({ english: null, source: null });
  });
});
