import { describe, expect, it } from 'vitest';
import { checkRecord, checkRecords } from '../tools/lib/species-record.ts';
import type { SpeciesRecord } from '../src/types.ts';

const HOSTS = ['first-nature.com', 'wildfooduk.com', 'en.wikipedia.org', 'woodlandtrust.org.uk'];
const two = ['fn', 'wf'];

function rec(over: Partial<SpeciesRecord> = {}): SpeciesRecord {
  return {
    slug: 'field-mushroom',
    inatId: 1,
    scientific: 'Agaricus campestris',
    english: 'Field Mushroom',
    olderNames: [],
    edibility: { value: 'edible-cooked', sources: two },
    edibilityNote: null,
    protectedInUk: { value: false, sources: two },
    topPoints: [
      { value: 'Pink gills turning chocolate brown.', sources: two },
      { value: 'No bag at the base of the stem.', sources: two },
      { value: 'Grows in open grassland.', sources: two },
    ],
    habitat: { value: 'Pasture and lawns.', sources: two },
    seasonMonths: { value: [7, 8, 9, 10], sources: two },
    sporePrint: { value: 'Dark brown', sources: two },
    features: {
      underside: { value: 'gills', sources: two },
      ring: { value: 'yes', sources: two },
      bagAtBase: { value: 'no', sources: two },
      growsOn: { value: 'ground', sources: two },
      capCm: { value: [3, 10], sources: two },
      fleshChange: { value: 'Slightly pinkish; never chrome yellow', sources: two },
      smell: { value: 'Pleasant, mushroomy', sources: two },
    },
    lookalikes: [
      {
        scientific: 'Agaricus xanthodermus',
        english: 'Yellow Stainer',
        slug: 'yellow-stainer',
        kind: 'poisonous',
        tellApart: [{ feature: 'Stem base when cut', thisOne: 'No colour change', thatOne: 'Chrome yellow', sources: two }],
      },
    ],
    noDangerousLookalike: null,
    photos: [{ file: 'photos/field-mushroom/1.webp', view: 'top', credit: 'A. Person', licence: 'cc-by', link: 'https://www.inaturalist.org/observations/1' }],
    sources: [
      { id: 'fn', title: 'First Nature', url: 'https://www.first-nature.com/fungi/agaricus-campestris.php' },
      { id: 'wf', title: 'Wild Food UK', url: 'https://www.wildfooduk.com/mushroom-guide/field-mushroom/' },
    ],
    checked: '2026-10-06',
    ...over,
  };
}

describe('checkRecord', () => {
  it('accepts a complete, sourced record', () => {
    expect(checkRecord(rec(), HOSTS)).toEqual([]);
  });
  it('needs two different websites behind every safety fact', () => {
    const r = rec({ edibility: { value: 'edible-cooked', sources: ['fn'] } });
    expect(checkRecord(r, HOSTS)).toContain('field-mushroom: edibility needs sources from two different websites (has 1)');
  });
  it('takes a "not edible" verdict from one website; edible, poisonous and deadly need two', () => {
    const r = rec({ edibility: { value: 'not-edible', sources: ['wf'] }, edibilityNote: { value: 'Bitter.', sources: ['wf'] },
      lookalikes: [] });
    expect(checkRecord(r, HOSTS)).toEqual([]);
    for (const value of ['edible-cooked', 'edible-some-react', 'poisonous', 'deadly'] as const) {
      r.edibility = { value, sources: ['wf'] };
      r.noDangerousLookalike = value.startsWith('edible') ? { sources: two } : null;
      expect(checkRecord(r, HOSTS)).toContain('field-mushroom: edibility needs sources from two different websites (has 1)');
      expect(checkRecord(r, HOSTS)).toContain('field-mushroom: edibilityNote needs sources from two different websites (has 1)');
    }
    r.edibility = { value: 'not-edible', sources: [] };
    r.noDangerousLookalike = null;
    expect(checkRecord(r, HOSTS)).toContain('field-mushroom: edibility needs at least one source');
  });
  it('takes the season from one source (it is not a safety fact), but not from none', () => {
    expect(checkRecord(rec({ seasonMonths: { value: [7, 8, 9, 10, 11], sources: ['fn'] } }), HOSTS)).toEqual([]);
    expect(checkRecord(rec({ seasonMonths: { value: [7, 8], sources: [] } }), HOSTS))
      .toContain('field-mushroom: seasonMonths needs at least one source');
  });
  it('takes flesh change and smell from one source, but the structural features from two websites', () => {
    const r = rec();
    r.features.fleshChange = { value: 'White; no change described', sources: ['wf'] };
    r.features.smell = { value: 'Faint', sources: ['fn'] };
    expect(checkRecord(r, HOSTS)).toEqual([]);
    r.features.bagAtBase = { value: 'no', sources: ['fn'] };
    expect(checkRecord(r, HOSTS)).toContain('field-mushroom: feature bagAtBase needs sources from two different websites (has 1)');
  });
  it('takes the cap size of a species that is neither edible nor dangerous from one source; of the others, two websites', () => {
    const r = rec();
    r.features.capCm = { value: [1, 20], sources: ['wf'] };
    expect(checkRecord(r, HOSTS)).toContain('field-mushroom: feature capCm needs sources from two different websites (has 1)');
    r.edibility = { value: 'not-edible', sources: two };
    r.lookalikes = [];
    expect(checkRecord(r, HOSTS)).toEqual([]);
    for (const value of ['poisonous', 'deadly', 'edible-some-react'] as const) {
      r.edibility = { value, sources: two };
      r.noDangerousLookalike = value === 'edible-some-react' ? { sources: two } : null;
      expect(checkRecord(r, HOSTS)).toContain('field-mushroom: feature capCm needs sources from two different websites (has 1)');
    }
  });
  it('refuses a source id the record does not declare', () => {
    const r = rec({ sporePrint: { value: 'Dark brown', sources: ['fn', 'zz'] } });
    expect(checkRecord(r, HOSTS)).toContain('field-mushroom: sporePrint names an undeclared source "zz"');
  });
  it('refuses a source website that is not allowed', () => {
    const r = rec();
    r.sources.push({ id: 'ex', title: 'Example', url: 'https://example.com/x' });
    expect(checkRecord(r, HOSTS)).toContain('field-mushroom: source "ex" is on example.com, which is not on the allowed list');
  });
  it('needs 3 to 6 top points', () => {
    expect(checkRecord(rec({ topPoints: [] }), HOSTS)).toContain('field-mushroom: needs 3 to 6 top points (has 0)');
  });
  it('needs dangerous lookalikes or a sourced "no dangerous lookalike" for an edible species', () => {
    const r = rec({ lookalikes: [] });
    expect(checkRecord(r, HOSTS)).toContain('field-mushroom: an edible species must name its dangerous lookalikes or carry "no dangerous lookalike"');
  });
  it('needs a sourced row for every lookalike', () => {
    const r = rec();
    r.lookalikes[0].tellApart = [];
    expect(checkRecord(r, HOSTS)).toContain('field-mushroom: lookalike Yellow Stainer needs at least one "tell them apart" row');
  });
  it('allows only open-licence photos with a credit and a link', () => {
    const r = rec();
    (r.photos[0] as { licence: string }).licence = 'all-rights-reserved';
    expect(checkRecord(r, HOSTS)).toContain('field-mushroom: photo 1 has a licence that is not allowed (all-rights-reserved)');
  });
  it('needs a spore print colour that Identify can ask about', () => {
    const p = checkRecord(rec({ sporePrint: { value: 'Varies', sources: two } }), HOSTS);
    expect(p).toContain('field-mushroom: sporePrint "Varies" names no colour group Identify can ask about');
  });
  it('never says "safe"', () => {
    const r = rec({ topPoints: [...rec().topPoints, { value: 'Safe to eat when cooked.', sources: two }] });
    expect(checkRecord(r, HOSTS)).toContain('field-mushroom: uses the word "safe"');
  });
});

describe('checkRecords', () => {
  it('needs lookalike links both ways when both pages exist', () => {
    const a = rec();
    const b = rec({ slug: 'yellow-stainer', scientific: 'Agaricus xanthodermus', english: 'Yellow Stainer',
      edibility: { value: 'poisonous', sources: two }, lookalikes: [], noDangerousLookalike: null });
    expect(checkRecords([a, b], HOSTS)).toContain('yellow-stainer: does not link back to its lookalike field-mushroom');
  });
  it('refuses two records with the same slug', () => {
    expect(checkRecords([rec(), rec()], HOSTS)).toContain('field-mushroom: slug used twice');
  });
});
