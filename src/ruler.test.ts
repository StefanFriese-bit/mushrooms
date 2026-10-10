import { afterEach, describe, expect, it, vi } from 'vitest';
import { CARD_MM, rulerScale, ticks } from './ruler';

const iPhone15 = { dpr: 3, iPhone: true, width: 393, height: 852 };

describe('the ruler on the screen', () => {
  it('is set from Apple\'s own figures on an iPhone: 460 ppi at 3 pixels a point, 326 ppi at 2', () => {
    const s = rulerScale(iPhone15, null);
    expect(s.from).toBe('iphone');
    expect(s.pxPerCm).toBeCloseTo(460 / 2.54 / 3, 6); // 60.37 CSS pixels a centimetre
    // ... which puts the iPhone 15's 1179 pixels across at 6.51 cm: 1179 px ÷ 460 ppi × 2.54
    expect(393 / s.pxPerCm).toBeCloseTo((1179 / 460) * 2.54, 6);
    const eleven = rulerScale({ dpr: 2, iPhone: true, width: 414, height: 896 }, null);
    expect(eleven.from).toBe('iphone');
    expect(414 / eleven.pxPerCm).toBeCloseTo((828 / 326) * 2.54, 6);
  });

  it('cannot tell a mini from an iPhone X by its screen, so it takes the middle and asks to be checked', () => {
    const s = rulerScale({ dpr: 3, iPhone: true, width: 375, height: 812 }, null);
    expect(s.from).toBe('unknown');
    const mini = 375 / ((1080 / 476) * 2.54); // 65.07: 1080 pixels across 375 points at 476 ppi
    const x = 460 / 2.54 / 3;
    expect(s.pxPerCm).toBeCloseTo((mini + x) / 2, 6);
    expect(rulerScale({ dpr: 3, iPhone: true, width: 812, height: 375 }, null).from).toBe('unknown'); // turned sideways
  });

  it('only guesses on other phones, and says so', () => {
    expect(rulerScale({ dpr: 2.625, iPhone: false, width: 412, height: 915 }, null)).toEqual({ pxPerCm: 60, from: 'unknown' });
    expect(rulerScale({ dpr: 1, iPhone: true, width: 393, height: 852 }, null).from).toBe('unknown'); // no iPhone has 1 pixel a point
  });

  it('follows the bank-card check, kept in device pixels so a change of zoom keeps it true', () => {
    expect(rulerScale(iPhone15, 183)).toEqual({ pxPerCm: 61, from: 'card' });
    expect(rulerScale({ ...iPhone15, dpr: 3.45 }, 183).pxPerCm).toBeCloseTo(183 / 3.45, 9); // zoomed in: fewer CSS pixels a cm
    expect(rulerScale({ dpr: 2.625, iPhone: false, width: 412, height: 915 }, 157.5)).toEqual({ pxPerCm: 60, from: 'card' });
  });

  it('marks every millimetre, every half centimetre and every centimetre, numbered from 0', () => {
    const t = ticks(125, 60);
    expect(t).toHaveLength(21); // 0 to 2.0 cm: 125 px holds 20.8 mm
    expect(t[0]).toEqual({ y: 0, size: 'cm', cm: 0 });
    expect(t[5]).toEqual({ y: 30, size: 'half' });
    expect(t[7]).toEqual({ y: 42, size: 'mm' });
    expect(t[10]).toEqual({ y: 60, size: 'cm', cm: 1 });
    expect(t[20]).toEqual({ y: 120, size: 'cm', cm: 2 });
    expect(ticks(100, 0)).toEqual([]);
  });

  it('knows a bank card\'s size: ISO/IEC 7810 ID-1', () => {
    expect(CARD_MM).toEqual({ long: 85.6, short: 53.98 });
  });
});

describe('the bank-card check is kept on the phone', () => {
  afterEach(() => vi.unstubAllGlobals());
  const fresh = async (storage: Partial<Storage> | 'broken') => {
    vi.resetModules();
    vi.stubGlobal('localStorage', storage === 'broken'
      ? { getItem: () => { throw new Error('no'); }, setItem: () => { throw new Error('no'); }, removeItem: () => { throw new Error('no'); } }
      : storage);
    return import('./ruler');
  };

  it('saves, reads back and forgets', async () => {
    const box = new Map<string, string>();
    const r = await fresh({ getItem: (k) => box.get(k) ?? null, setItem: (k, v) => { box.set(k, v); }, removeItem: (k) => { box.delete(k); } });
    expect(r.loadChecked()).toBeNull();
    r.saveChecked(181.5);
    expect([...box.values()]).toEqual(['181.5']);
    const again = await fresh({ getItem: (k) => box.get(k) ?? null, setItem: (k, v) => { box.set(k, v); }, removeItem: (k) => { box.delete(k); } });
    expect(again.loadChecked()).toBe(181.5); // after the app was closed and opened again
    again.saveChecked(null);
    expect(box.size).toBe(0);
    expect(again.loadChecked()).toBeNull();
  });

  it('never throws, and keeps the check while the app is open where the phone keeps nothing', async () => {
    const r = await fresh('broken');
    expect(r.loadChecked()).toBeNull();
    expect(() => r.saveChecked(170)).not.toThrow();
    expect(r.loadChecked()).toBe(170);
  });

  it('ignores something that is not a scale', async () => {
    const r = await fresh({ getItem: () => 'nonsense', setItem: () => {}, removeItem: () => {} });
    expect(r.loadChecked()).toBeNull();
  });
});
