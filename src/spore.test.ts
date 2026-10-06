import { describe, expect, it } from 'vitest';
import { sporeGroups } from './spore';

describe('sporeGroups', () => {
  it.each([
    ['White', ['white']],
    ['White to cream', ['white']],
    ['White to pale cream', ['white']],
    ['Pale yellow to cream', ['white']],
    ['Rusty brown', ['brown']],
    ['Chocolate brown', ['dark']],
    ['Dark brown', ['dark']],
    ['Dark purple-brown to chocolate brown', ['dark']],
    ['Salmon pink', ['pink']],
    ['Ochre to tobacco brown', ['brown']],
    ['Black', ['dark']],
  ])('%s → %j', (text, groups) => expect(sporeGroups(text)).toEqual(groups));
  it('plain "brown" counts as both brown groups, so it never wrongly excludes', () => {
    expect(sporeGroups('Brown')).toEqual(['brown', 'dark']);
  });
  it('names no group for words it does not know', () => expect(sporeGroups('Varies')).toEqual([]));
});
