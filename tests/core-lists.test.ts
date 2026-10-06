import { describe, expect, it } from 'vitest';
import { hostOf, validateCoreLists, type CoreLists } from '../tools/lib/core-lists.ts';

const FN = 'https://www.first-nature.com/fungi/x.php';
const WF = 'https://www.wildfooduk.com/mushroom-guide/x/';
const two = [FN, WF];

function valid(): CoreLists {
  return {
    allowedSourceHosts: ['first-nature.com', 'wildfooduk.com', 'en.wikipedia.org'],
    edibles: [
      { name: 'Agaricus campestris', sources: two },
      { name: 'Hydnum repandum', sources: two },
    ],
    dangerous: [
      { name: 'Agaricus xanthodermus', level: 'poisonous', sources: two },
      { name: 'Cortinarius rubellus', level: 'deadly', sources: two },
    ],
    pairs: [{ edible: 'Agaricus campestris', dangerous: 'Agaricus xanthodermus', sources: two }],
    noDangerousLookalike: [{ edible: 'Hydnum repandum', sources: two }],
  };
}

describe('validateCoreLists', () => {
  it('accepts a consistent, sourced list', () => {
    expect(validateCoreLists(valid())).toEqual([]);
  });

  it('needs two sources from two different allowed websites', () => {
    const c = valid();
    c.edibles[0].sources = [FN, 'https://first-nature.com/fungi/y.php'];
    expect(validateCoreLists(c)).toContain('edible "Agaricus campestris": needs two sources from different websites (has 1)');
  });

  it('refuses a source website that is not on the allowed list', () => {
    const c = valid();
    c.dangerous[0].sources = [FN, 'https://example.com/a'];
    const problems = validateCoreLists(c);
    expect(problems).toContain('dangerous "Agaricus xanthodermus": example.com is not on the allowed source list');
  });

  it('refuses a name that is not "Genus species"', () => {
    const c = valid();
    c.edibles[1].name = 'hydnum';
    expect(validateCoreLists(c).some((p) => p.includes('not a "Genus species" name'))).toBe(true);
  });

  it('refuses a pair whose species are not in the lists', () => {
    const c = valid();
    c.pairs.push({ edible: 'Boletus edulis', dangerous: 'Rubroboletus satanas', sources: two });
    const problems = validateCoreLists(c);
    expect(problems).toContain('pair "Boletus edulis" / "Rubroboletus satanas": "Boletus edulis" is not in the edible list');
    expect(problems).toContain('pair "Boletus edulis" / "Rubroboletus satanas": "Rubroboletus satanas" is not in the dangerous list');
  });

  it('requires every edible to name its lookalikes or be marked as having none', () => {
    const c = valid();
    c.noDangerousLookalike = [];
    expect(validateCoreLists(c)).toContain(
      'edible "Hydnum repandum": name its dangerous lookalikes, or mark it as having none (with two sources)',
    );
  });

  it('refuses an edible that has lookalikes and is also marked as having none', () => {
    const c = valid();
    c.noDangerousLookalike.push({ edible: 'Agaricus campestris', sources: two });
    expect(validateCoreLists(c)).toContain('edible "Agaricus campestris": has lookalikes AND is marked as having none');
  });

  it("allows a poisonous species only as somebody's lookalike; a deadly one always", () => {
    const c = valid();
    c.pairs = [];
    c.noDangerousLookalike.push({ edible: 'Agaricus campestris', sources: two });
    const problems = validateCoreLists(c);
    expect(problems).toContain(
      'dangerous "Agaricus xanthodermus": a poisonous species belongs here only as a lookalike of an edible one',
    );
    expect(problems.some((p) => p.includes('Cortinarius rubellus'))).toBe(false);
  });

  it('refuses a species in both the edible and the dangerous list', () => {
    const c = valid();
    c.dangerous.push({ name: 'Agaricus campestris', level: 'poisonous', sources: two });
    expect(validateCoreLists(c)).toContain('"Agaricus campestris" is in both the edible and the dangerous list');
  });

  it('reads hosts without www', () => {
    expect(hostOf('https://www.wildfooduk.com/a/')).toBe('wildfooduk.com');
    expect(hostOf('not a url')).toBe(null);
  });
});
