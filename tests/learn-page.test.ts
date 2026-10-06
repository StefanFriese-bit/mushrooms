import { describe, expect, it } from 'vitest';
import { checkLearn } from '../tools/lib/learn-page.ts';

const HOSTS = ['first-nature.com', 'wildfooduk.com', 'en.wikipedia.org'];
const section = (over = {}) => ({
  title: 'How to take a spore print',
  points: ['Lay the cap gills-down on paper.'],
  sources: [
    { title: 'First Nature', url: 'https://www.first-nature.com/fungi/~sporeprint.php' },
    { title: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Spore_print' },
  ],
  ...over,
});

describe('checkLearn', () => {
  it('accepts sections with points and sources from two allowed websites', () => {
    expect(checkLearn([section()], HOSTS)).toEqual([]);
  });
  it('needs two different websites per section', () => {
    const s = section({ sources: [{ title: 'FN', url: 'https://www.first-nature.com/a' }, { title: 'FN', url: 'https://www.first-nature.com/b' }] });
    expect(checkLearn([s], HOSTS)).toContain('Learn "How to take a spore print": needs sources from two different websites (has 1)');
  });
  it('refuses a website that is not allowed, a section with no points, and the word "safe"', () => {
    const s = section({ points: [], sources: [...section().sources, { title: 'X', url: 'https://example.com/x' }] });
    const problems = checkLearn([s, section({ title: 'Rules', points: ['Some mushrooms are safe to eat.'] })], HOSTS);
    expect(problems).toContain('Learn "How to take a spore print": example.com is not on the allowed list');
    expect(problems).toContain('Learn "How to take a spore print": has no points');
    expect(problems).toContain('Learn "Rules": uses the word "safe"');
  });
});
