import { describe, expect, it } from 'vitest';
import { renderReviewPage, sectionOf, type ReviewRow } from '../tools/lib/review-page.ts';

const row = (name: string, reasons: ReviewRow['reasons'], extra: Partial<ReviewRow> = {}): ReviewRow => ({
  inatId: 1,
  name,
  ukRecords: 1234,
  inatEnglish: null,
  photo: null,
  reasons,
  dangerLevel: null,
  english: `${name} english`,
  englishSource: 'bms-2005',
  ...extra,
});

describe('sectionOf', () => {
  it('puts each species in the first section that fits', () => {
    expect(sectionOf(row('A a', ['dangerous-lookalike', 'deadly']))).toBe('Deadly species');
    expect(sectionOf(row('B b', ['dangerous-lookalike']))).toBe('Dangerous lookalikes of edible species');
    expect(sectionOf(row('C c', ['edible', 'added-by-stefan']))).toBe('Edible species');
    expect(sectionOf(row('D d', ['added-by-stefan']))).toBe('Added by you');
    expect(sectionOf(row('E e', ['most-recorded']))).toBe('Most recorded in the UK');
  });
});

describe('renderReviewPage', () => {
  const rows = [
    row('Amanita phalloides', ['deadly', 'dangerous-lookalike'], { dangerLevel: 'deadly' }),
    row('Agaricus campestris', ['edible']),
    row('Xylaria hypoxylon', ['most-recorded']),
  ];
  const html = renderReviewPage(rows, { generated: '2026-10-07', target: 300, notes: ['A note <b>'] });

  it('lists every species once, with its section counts', () => {
    expect(html.match(/<tr class="sp"/g)).toHaveLength(3);
    expect(html).toContain('Deadly species (1)');
    expect(html).toContain('Edible species (1)');
    expect(html).toContain('Most recorded in the UK (1)');
    expect(html).toContain('3 species');
  });

  it('links each species to iNaturalist and shows UK records', () => {
    expect(html).toContain('https://www.inaturalist.org/taxa/1');
    expect(html).toContain('1,234');
  });

  it('escapes text', () => {
    const evil = renderReviewPage([row('<script>x</script> y', ['most-recorded'])], { generated: 'd', target: 1, notes: [] });
    expect(evil).not.toContain('<script>x</script>');
    expect(evil).toContain('&lt;script&gt;');
  });

  it('shows the notes', () => {
    expect(html).toContain('A note &lt;b&gt;');
  });
});
