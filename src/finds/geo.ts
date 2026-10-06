// Spots on the ground: how far apart, how exact, how they read, and the "take me there" link (spec 7).
export type LatLon = { lat: number; lon: number };

/** Metres between two spots along the ground (haversine; the Earth as a sphere of 6,371 km — ample for a walk). */
export function distanceM(a: LatLon, b: LatLon): number {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function sayDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  if (m < 10000) return `${(m / 1000).toFixed(1)} km`;
  return `${Math.round(m / 1000)} km`;
}

/** A GPS spot's accuracy (metres), or a spot he placed on the map by hand. */
export const sayAccuracy = (accuracy: number | null): string => (accuracy === null ? 'placed by hand' : `within ${Math.round(accuracy)} m`);

export const saySpot = (s: LatLon): string => `${s.lat.toFixed(5)}, ${s.lon.toFixed(5)}`;

/** Apple Maps, walking directions from where he is to the spot. */
export const appleMapsLink = (s: LatLon): string => `https://maps.apple.com/?daddr=${s.lat.toFixed(5)},${s.lon.toFixed(5)}&dirflg=w`;
