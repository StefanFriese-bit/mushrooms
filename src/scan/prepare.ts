// How a photo becomes the model's input: the browser twin of tools/scan-test/photos.py, so the scan test measures
// what ships. The photo is cut to a square as `fit` says, scaled to size × size and returned as red, green and blue
// planes with values 0–1 (1 × 3 × size × size, as the model file takes it).
//   squash  the whole photo, scaled to a square (a 4:3 photo is squeezed)
//   square  the centre square (the shorter side), scaled
//   timm    the centre square of 0.875 × the shorter side, scaled (the models' own evaluation crop)
export type Fit = 'squash' | 'square' | 'timm';
export type Rect = { x: number; y: number; w: number; h: number };

/** The part of a w × h photo the model sees, in the photo's own pixels (rounded as photos.py rounds). */
export function cropRect(w: number, h: number, fit: Fit): Rect {
  if (fit === 'squash') return { x: 0, y: 0, w, h };
  const side = Math.min(w, h) * (fit === 'timm' ? 0.875 : 1);
  const left = (w - side) / 2;
  const top = (h - side) / 2;
  const x = Math.round(left);
  const y = Math.round(top);
  return { x, y, w: Math.round(left + side) - x, h: Math.round(top + side) - y };
}

/** RGBA bytes, as a canvas gives them, → the model's three colour planes (0–1). */
export function toPlanes(rgba: ArrayLike<number>, size: number): Float32Array {
  const n = size * size;
  if (rgba.length !== 4 * n) throw new Error(`${rgba.length} bytes is not a ${size} × ${size} picture`);
  const out = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) {
    out[i] = rgba[4 * i] / 255;
    out[n + i] = rgba[4 * i + 1] / 255;
    out[2 * n + i] = rgba[4 * i + 2] / 255;
  }
  return out;
}

/** A decoded photo (upright, as the browser shows it) → the model's input. */
export function pixels(photo: { source: CanvasImageSource; width: number; height: number }, size: number, fit: Fit): Float32Array {
  const r = cropRect(photo.width, photo.height, fit);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d', { willReadFrequently: true });
  if (!g) throw new Error('this browser cannot draw the photo');
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(photo.source, r.x, r.y, r.w, r.h, 0, 0, size, size);
  return toPlanes(g.getImageData(0, 0, size, size).data, size);
}
