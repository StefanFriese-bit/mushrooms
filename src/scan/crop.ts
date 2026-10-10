import type { Rect } from './prepare';

// Cropping a scan photo (Stefan 10/10/2026: "once I've selected the photo … I can crop the photo … just zoom in on the
// cap"): the photo moves and zooms under a fixed square, and the square is what the scan looks at. Pure: the screen
// (src/screens/crop.tsx) only turns fingers into these numbers.
/** How the photo sits under the square: its scale (screen points per photo pixel) and its top-left corner. */
export type View = { scale: number; x: number; y: number };
/** As close as the square may zoom in: eight times the whole-width view. */
export const MAX_ZOOM = 8;

/** The smallest scale at which the photo still fills the square. */
export const coverScale = (w: number, h: number, frame: number) => frame / Math.min(w, h);

/** The starting view: the photo's centre square — exactly what the scan looks at without a crop. */
export function centred(w: number, h: number, frame: number): View {
  const scale = coverScale(w, h, frame);
  return { scale, x: (frame - w * scale) / 2, y: (frame - h * scale) / 2 };
}

/** Keeps the square filled with photo: never smaller than the square, never further in than MAX_ZOOM. */
export function clampView(v: View, w: number, h: number, frame: number): View {
  const min = coverScale(w, h, frame);
  const scale = Math.min(Math.max(v.scale, min), min * MAX_ZOOM);
  return { scale, x: Math.min(0, Math.max(frame - w * scale, v.x)), y: Math.min(0, Math.max(frame - h * scale, v.y)) };
}

/** Zooms by `k` about a point of the square (a pinch's middle, or the centre), that point staying where it is. */
export function zoomAt(v: View, k: number, px: number, py: number, w: number, h: number, frame: number): View {
  const min = coverScale(w, h, frame);
  const scale = Math.min(Math.max(v.scale * k, min), min * MAX_ZOOM);
  const f = scale / v.scale;
  return clampView({ scale, x: px - (px - v.x) * f, y: py - (py - v.y) * f }, w, h, frame);
}

/** The zoom as the slider shows it: 1 = the whole width, up to MAX_ZOOM. */
export const zoomOf = (v: View, w: number, h: number, frame: number) => v.scale / coverScale(w, h, frame);

/** The part of the photo inside the square, in the photo's own pixels. */
export function sourceRect(v: View, frame: number): Rect {
  const side = frame / v.scale;
  return { x: (0 - v.x) / v.scale, y: (0 - v.y) / v.scale, w: side, h: side }; // 0 - x: never a minus zero
}

/** How many pixels the cropped photo gets: what the photo has there, at least 256, at most 1,024 (the scan scales every
 * photo to 500 at most before it looks). */
export const outputSide = (r: Rect) => Math.round(Math.min(1024, Math.max(256, r.w)));
