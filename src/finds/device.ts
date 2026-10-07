import type { Spot } from './store';
import { steadySpot, type Fix } from './geo';

// The phone's GPS and camera photos, for a find (spec 7). GPS works with no signal; it only needs the sky.
/**
 * Follows his position while a find is being made. The first fix can be rough (tens of metres); every reading after
 * it is kept for a minute, and the spot offered is the steady one (src/finds/geo.ts steadySpot): the readings about as
 * good as the best, averaged — a single reading can jump about under trees. Returns the function that stops following.
 */
export function followSpot(onSpot: (s: Spot, readings: number) => void, onError: (message: string) => void): () => void {
  if (!('geolocation' in navigator)) {
    onError('This phone gives no location to the app. You can place the pin on the map instead.');
    return () => {};
  }
  let fixes: Fix[] = [];
  const id = navigator.geolocation.watchPosition(
    (p) => {
      const now = Date.now();
      fixes = [...fixes.filter((f) => now - f.at <= 60_000), { lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy, at: now }];
      const s = steadySpot(fixes, now);
      if (s) onSpot({ lat: s.lat, lon: s.lon, accuracy: s.accuracy }, s.readings);
    },
    (e) => onError(gpsProblem(e)),
    { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 },
  );
  return () => navigator.geolocation.clearWatch(id);
}

/** Follows where he is now, reading by reading (for walking back to a find). Returns the function that stops. */
export function followHere(onFix: (f: Fix) => void, onError: (message: string) => void): () => void {
  if (!('geolocation' in navigator)) {
    onError('This phone gives no location to the app.');
    return () => {};
  }
  const id = navigator.geolocation.watchPosition(
    (p) => onFix({ lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy, at: Date.now() }),
    (e) => onError(gpsProblem(e)),
    { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 },
  );
  return () => navigator.geolocation.clearWatch(id);
}

const gpsProblem = (e: GeolocationPositionError) => (e.code === e.PERMISSION_DENIED
  ? 'Location is off for this app. You can allow it in the iPhone\'s Settings, or place the pin on the map instead.'
  : 'No GPS fix yet. It needs a view of the sky; or place the pin on the map.');

/** A photo scaled down to at most `max` pixels on its longer side, as a JPEG (upright, as the phone shows it). */
export async function shrinkPhoto(file: Blob, max = 1600): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const g = canvas.getContext('2d');
    if (!g) throw new Error('This phone could not prepare the photo');
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('This phone could not prepare the photo'))), 'image/jpeg', 0.85));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Photos handed from a scan to a new find (kept in memory only, until the find is saved or the app closes). */
let pending: { photos: Blob[]; species: string | null } | null = null;
export const handOver = (photos: Blob[], species: string | null) => { pending = { photos, species }; };
export const takeHandOver = () => { const p = pending; pending = null; return p; };
