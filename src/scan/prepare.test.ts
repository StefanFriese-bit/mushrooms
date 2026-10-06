import { describe, expect, it } from 'vitest';
import { cropRect, testSize, toPlanes } from './prepare';

describe('cropRect', () => {
  it('squash keeps the whole photo', () => {
    expect(cropRect(400, 300, 'squash')).toEqual({ x: 0, y: 0, w: 400, h: 300 });
  });
  it('square keeps the centre square of the shorter side, landscape or portrait', () => {
    expect(cropRect(400, 300, 'square')).toEqual({ x: 50, y: 0, w: 300, h: 300 });
    expect(cropRect(300, 400, 'square')).toEqual({ x: 0, y: 50, w: 300, h: 300 });
  });
  it('timm keeps the centre 87.5% square', () => {
    expect(cropRect(400, 400, 'timm')).toEqual({ x: 25, y: 25, w: 350, h: 350 });
  });
  it('rounds half up, as photos.py does (a 473 × 1024 guide photo)', () => {
    // top = (1024 - 473) / 2 = 275.5 → 276; bottom = 748.5 → 749
    expect(cropRect(473, 1024, 'square')).toEqual({ x: 0, y: 276, w: 473, h: 473 });
  });
});

describe('toPlanes', () => {
  it('splits RGBA bytes into red, green and blue planes from 0 to 1, dropping alpha', () => {
    const rgba = [255, 0, 51, 9, 0, 255, 102, 9, 0, 0, 0, 9, 255, 255, 255, 9];
    expect([...toPlanes(rgba, 2)]).toEqual([1, 0, 0, 1, 0, 1, 0, 1, 0.2, 0.4, 0, 1].map((v) => expect.closeTo(v, 6)));
  });
  it('refuses bytes of the wrong size', () => {
    expect(() => toPlanes([1, 2, 3, 4], 2)).toThrow(/2 × 2/);
  });
});

describe('testSize', () => {
  it('scales a phone photo to 500 px on its longer side, as the test photos were', () => {
    expect(testSize(4032, 3024)).toEqual({ width: 500, height: 375 });
    expect(testSize(3024, 4032)).toEqual({ width: 375, height: 500 });
  });
  it('never enlarges a small photo', () => expect(testSize(400, 300)).toEqual({ width: 400, height: 300 }));
});
