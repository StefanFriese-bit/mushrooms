import { describe, expect, it } from 'vitest';
import { MAX_ZOOM, centred, clampView, coverScale, outputSide, sourceRect, zoomAt, zoomOf } from './crop';
import { cropRect } from './prepare';

const [W, H, F] = [4000, 3000, 300]; // a phone photo, landscape, under a 300-point square
describe('cropping a scan photo', () => {
  it('starts on the centre square — what the scan looks at without a crop', () => {
    const v = centred(W, H, F);
    expect(sourceRect(v, F)).toEqual(cropRect(W, H, 'square'));
    expect(zoomOf(v, W, H, F)).toBeCloseTo(1);
  });
  it('never shows anything but photo in the square, however it is dragged', () => {
    const v = clampView({ scale: coverScale(W, H, F), x: 500, y: -9000 }, W, H, F);
    const r = sourceRect(v, F);
    expect(r.x).toBeCloseTo(0);
    expect(r.y + r.h).toBeCloseTo(H);
  });
  it('zooms about the point under the fingers, which stays where it is', () => {
    const v = centred(W, H, F);
    const [px, py] = [90, 210];
    const photoX = (px - v.x) / v.scale;
    const photoY = (py - v.y) / v.scale;
    const z = zoomAt(v, 3, px, py, W, H, F);
    expect(zoomOf(z, W, H, F)).toBeCloseTo(3);
    expect((px - z.x) / z.scale).toBeCloseTo(photoX);
    expect((py - z.y) / z.scale).toBeCloseTo(photoY);
    expect(sourceRect(z, F).w).toBeCloseTo(H / 3);
  });
  it('stops at the whole width and at the closest zoom', () => {
    const v = centred(W, H, F);
    expect(zoomOf(zoomAt(v, 0.2, 150, 150, W, H, F), W, H, F)).toBeCloseTo(1);
    expect(zoomOf(zoomAt(v, 100, 150, 150, W, H, F), W, H, F)).toBeCloseTo(MAX_ZOOM);
  });
  it('gives the cropped photo enough pixels, but never more than 1,024', () => {
    expect(outputSide({ x: 0, y: 0, w: 3000, h: 3000 })).toBe(1024);
    expect(outputSide({ x: 0, y: 0, w: 600, h: 600 })).toBe(600);
    expect(outputSide({ x: 0, y: 0, w: 90, h: 90 })).toBe(256);
  });
});
