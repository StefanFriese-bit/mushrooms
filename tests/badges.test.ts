import { describe, expect, it } from 'vitest';
import { badgeFromWords, badgesOfFind } from '../src/finds/badges';

const keys = (f: { species: string | null; notes: string }) => badgesOfFind(f).map((b) => b.key);
const badgeOfFind = (f: { species: string | null; notes: string }) => { const b = badgesOfFind(f); return b.length === 1 ? b[0] : null; };

describe('a saved location\'s picture', () => {
  it('comes from the species it is named as', () => {
    expect(badgeOfFind({ species: 'Boletus edulis', notes: '' })?.key).toBe('penny-bun');
    expect(keys({ species: 'Amanita muscaria', notes: '' })).toEqual(['fly-agaric']);
  });
  it('named as another species: none, whatever the description says', () => {
    expect(badgeOfFind({ species: 'Cantharellus cibarius', notes: 'thought it was a penny bun' })).toBeNull();
  });
  it('not named: from the description, in his own words', () => {
    expect(badgeFromWords('Penny Bun, five caps, under the big beech')?.key).toBe('penny-bun');
    expect(badgeFromWords('two penny buns')?.key).toBe('penny-bun');
    expect(badgeFromWords('Ceps by the path')?.key).toBe('penny-bun');
    expect(badgeFromWords('porcini!')?.key).toBe('penny-bun');
    expect(badgeFromWords('Fly agarics in a ring')?.key).toBe('fly-agaric');
    expect(badgeFromWords('brown birch bolete')?.key).toBe('birch-bolete');
  });
  it('a half name, or two of the three, gives none', () => {
    expect(badgeFromWords('under the birch')).toBeNull();
    expect(badgeFromWords('bun shaped')).toBeNull();
    expect(badgeFromWords('a fly on it')).toBeNull();
    expect(badgeFromWords('fly agaric next to a penny bun')).toBeNull();
    expect(badgeFromWords('')).toBeNull();
  });
  it('the three he looks for most: Horn of Plenty, Hedgehog, Winter Chanterelle', () => {
    expect(badgeOfFind({ species: 'Craterellus cornucopioides', notes: '' })?.key).toBe('horn-of-plenty');
    expect(badgeOfFind({ species: 'Hydnum repandum', notes: '' })?.key).toBe('hedgehog');
    expect(badgeOfFind({ species: 'Hydnum rufescens', notes: '' })?.key).toBe('hedgehog');
    expect(badgeOfFind({ species: 'Craterellus tubaeformis', notes: '' })?.key).toBe('winter-chanterelle');
    expect(badgeFromWords('Black trumpets in the moss')?.key).toBe('horn-of-plenty');
    expect(badgeFromWords('horn of plenty')?.key).toBe('horn-of-plenty');
    expect(badgeFromWords('Hedgehogs under the beech')?.key).toBe('hedgehog');
    expect(badgeFromWords('Winter chanterelles, loads')?.key).toBe('winter-chanterelle');
    expect(badgeFromWords('yellowfoot')?.key).toBe('winter-chanterelle');
  });
  it('near misses give none: a plain Chanterelle, a Yellowleg Bonnet, a trumpet alone', () => {
    expect(badgeOfFind({ species: 'Cantharellus cibarius', notes: 'winter chanterelle' })).toBeNull();
    expect(badgeFromWords('chanterelle')).toBeNull();
    expect(badgeFromWords('yellowleg bonnet')).toBeNull();
    expect(badgeFromWords('trumpet shaped')).toBeNull();
  });
  it('Bay Bolete: its own picture, from its name or its older names; "bay" alone gives none', () => {
    expect(keys({ species: 'Imleria badia', notes: '' })).toEqual(['bay-bolete']);
    expect(badgeFromWords('Bay boletes under the pines')?.key).toBe('bay-bolete');
    expect(badgeFromWords('Boletus badius')?.key).toBe('bay-bolete');
    expect(badgeFromWords('Xerocomus badius')?.key).toBe('bay-bolete');
    expect(badgeFromWords('by the bay')).toBeNull();
    // Latin names of the others match the same way.
    expect(badgeFromWords('Boletus edulis')?.key).toBe('penny-bun');
    expect(badgeFromWords('Craterellus cornucopioides')?.key).toBe('horn-of-plenty');
    expect(badgeFromWords('Craterellus tubaeformis')?.key).toBe('winter-chanterelle');
  });
  it('two found together: both pictures (Stefan 16/10/2026: a penny bun and a bay bolete)', () => {
    expect(keys({ species: null, notes: 'Found a penny bun and a bay bolete' })).toEqual(['penny-bun', 'bay-bolete']);
    // Named as one of them: that one first, the other from the description, never twice.
    expect(keys({ species: 'Imleria badia', notes: 'bay bolete next to a penny bun' })).toEqual(['bay-bolete', 'penny-bun']);
    expect(keys({ species: 'Boletus edulis', notes: 'penny bun' })).toEqual(['penny-bun']);
    expect(keys({ species: null, notes: 'fly agaric next to a penny bun' })).toEqual(['penny-bun', 'fly-agaric']);
    expect(keys({ species: 'Cantharellus cibarius', notes: 'penny bun and bay bolete' })).toEqual([]);
  });
  it('Parasol: its picture from its name; a Shaggy Parasol is another mushroom (Stefan 18/10/2026)', () => {
    expect(keys({ species: 'Macrolepiota procera', notes: '' })).toEqual(['parasol']);
    expect(badgeFromWords('Two parasols by the gate')?.key).toBe('parasol');
    expect(badgeFromWords('Macrolepiota procera')?.key).toBe('parasol');
    expect(badgeFromWords('shaggy parasol')).toBeNull();
    expect(badgeFromWords('Chlorophyllum, the shaggy parasol')).toBeNull();
  });
});
