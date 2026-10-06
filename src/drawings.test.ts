import { describe, expect, it } from 'vitest';
import { QUESTIONS } from './identify';
import { DRAWINGS } from './screens/drawings';

describe('drawings', () => {
  it('every answer Identify offers has its drawing', () => {
    const missing = QUESTIONS.flatMap((q) => q.options.map((o) => o.drawing)).filter((n) => !(n in DRAWINGS));
    expect(missing).toEqual([]);
  });
});
