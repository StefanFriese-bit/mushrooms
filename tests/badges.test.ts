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
});
