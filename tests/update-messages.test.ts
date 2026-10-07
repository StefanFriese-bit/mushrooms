import { describe, expect, it } from 'vitest';
import { progressStep } from '../src/sw/messages';

// The worker tells the page its progress once per whole per cent (src/sw/sw.ts), so the page gets about 100 messages
// for 1,584 files, and the last file always says 100.
describe('download progress steps', () => {
  it('rounds down to whole per cents and reaches 100 only at the last file', () => {
    expect(progressStep(0, 1584)).toBe(0);
    expect(progressStep(15, 1584)).toBe(0);
    expect(progressStep(16, 1584)).toBe(1);
    expect(progressStep(1583, 1584)).toBe(99);
    expect(progressStep(1584, 1584)).toBe(100);
  });
  it('never says more than 100, and an empty list counts as done', () => {
    expect(progressStep(2000, 1584)).toBe(100);
    expect(progressStep(0, 0)).toBe(100);
  });
  it('gives at most 101 different steps however many files there are', () => {
    const steps = new Set(Array.from({ length: 1585 }, (_, i) => progressStep(i, 1584)));
    expect(steps.size).toBe(101);
  });
});
