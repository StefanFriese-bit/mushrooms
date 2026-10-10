import { describe, expect, it } from 'vitest';
import { STAGES, daysSince, growthChipText, growthLine, growthWords, isGrowthLog, latestGrowth, sayDays } from './growth';

// Growth at a saved location (Stefan 10/10/2026): "Porcini · G1 · 3 days ago". Dates are built in the phone's own
// time, so the tests mean the same in any time zone.
const at = (d: number, h = 9, m = 0) => new Date(2026, 9, d, h, m).toISOString(); // October 2026

describe('growth at a saved location', () => {
  it('has his scale: G0 just surfacing, G1 a centimetre or two, G2 about 5 cm — then grown, then old', () => {
    expect(STAGES.map((s) => `${s.short} ${s.name}`)).toEqual(['G0 Surfacing', 'G1 Button', 'G2 Young', 'G3 Grown', 'G4 Old']);
    expect(STAGES[1].hint).toMatch(/1 to 2 cm/);
    expect(STAGES[2].hint).toMatch(/5 cm/);
  });

  it("counts whole days by the phone's calendar: logged at 23:50, it is one day later at 00:10", () => {
    expect(daysSince(at(10, 8), new Date(2026, 9, 10, 20))).toBe(0);
    expect(daysSince(at(9, 23, 50), new Date(2026, 9, 10, 0, 10))).toBe(1);
    expect(daysSince(at(7), new Date(2026, 9, 10, 7))).toBe(3);
    expect(daysSince(at(24), new Date(2026, 9, 26, 12))).toBe(2); // across the clocks going back (25 October)
    expect(daysSince(at(12), new Date(2026, 9, 10))).toBe(0); // a clock set wrong never gives "-2 days"
  });

  it('shows the newest stage he logged and how long ago, in the words the list and the page use', () => {
    const log = [{ stage: 0, at: at(7) }, { stage: 2, at: at(9) }, { stage: 1, at: at(8) }];
    const now = new Date(2026, 9, 10, 12);
    expect(latestGrowth(log)).toEqual({ stage: 2, at: at(9) });
    expect(growthLine(log, now)).toBe('G2 · 1 day ago');
    expect(growthWords(log, now)).toBe('G2 Young · 1 day ago');
    expect(growthChipText([{ stage: 1, at: at(7) }], now)).toBe('G1 · 3 days');
    expect(growthChipText([{ stage: 0, at: at(10, 8) }], now)).toBe('G0 · today');
    expect(growthChipText(undefined, now)).toBeNull();
    expect(growthWords([], now)).toBeNull();
    expect([0, 1, 5].map(sayDays)).toEqual(['today', '1 day ago', '5 days ago']);
  });

  it('accepts only a list of known stages with real moments', () => {
    expect(isGrowthLog([{ stage: 4, at: at(7) }])).toBe(true);
    expect(isGrowthLog([])).toBe(true);
    expect(isGrowthLog([{ stage: 5, at: at(7) }])).toBe(false);
    expect(isGrowthLog([{ stage: -1, at: at(7) }])).toBe(false);
    expect(isGrowthLog([{ stage: 1, at: 'last week' }])).toBe(false);
    expect(isGrowthLog({ stage: 1, at: at(7) })).toBe(false);
  });
});
