import { describe, expect, it } from 'vitest';
import { badgeFromWords, badgeOfFind } from '../src/finds/badges';

describe('a saved location\'s picture', () => {
  it('comes from the species it is named as', () => {
    expect(badgeOfFind({ species: 'Boletus edulis', notes: '' })?.key).toBe('penny-bun');
    expect(badgeOfFind({ species: 'Amanita muscaria', notes: 'penny bun' })?.key).toBe('fly-agaric');
  });
  it('named as another species: none, whatever the description says', () => {
    expect(badgeOfFind({ species: 'Macrolepiota procera', notes: 'thought it was a penny bun' })).toBeNull();
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
});
