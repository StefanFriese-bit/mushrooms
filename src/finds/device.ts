import type { Spot } from './store';

// The phone's GPS and camera photos, for a find (spec 7). GPS works with no signal; it only needs the sky.
/**
 * Follows his position while a find is being made: the first fix can be rough (tens of metres), so every better fix
 * replaces it. Returns the function that stops following.
 */
export function followSpot(onSpot: (s: Spot) => void, onError: (message: string) => void): () => void {
  if (!('geolocation' in navigator)) {
    onError('This phone gives no location to the app. You can place the pin on the map instead.');
    return () => {};
  }
  let best: Spot | null = null;
  const id = navigator.geolocation.watchPosition(
    (p) => {
      const s = { lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy };
      if (!best || (s.accuracy ?? Infinity) <= (best.accuracy ?? Infinity)) { best = s; onSpot(s); }
    },
    (e) => onError(e.code === e.PERMISSION_DENIED
      ? 'Location is off for this app. You can allow it in the iPhone\'s Settings, or place the pin on the map instead.'
      : 'No GPS fix yet. It needs a view of the sky; or place the pin on the map.'),
    { enableHighAccuracy: true, timeout: 30000, maximumAge: 5000 },
  );
  return () => navigator.geolocation.clearWatch(id);
}

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
