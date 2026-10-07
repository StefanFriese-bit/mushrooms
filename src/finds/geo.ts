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

/** The direction to walk from `a` to `b`, in degrees clockwise from north (0–360). */
export function bearingDeg(a: LatLon, b: LatLon): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const POINTS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
/** A bearing as one of the eight compass points ("north-east"). */
export const compassWord = (deg: number): string => POINTS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];

/** One GPS reading: where, how sure (metres, the phone's own figure), and when (ms). */
export type Fix = LatLon & { accuracy: number; at: number };

/**
 * The spot to save from the readings taken while a find is being added: the readings about as good as the best one
 * (within 1.5 × its accuracy, from the last `windowMs`), averaged with the better ones counting more (1/accuracy²) —
 * steadier than any single reading, which can jump about under trees. The accuracy it claims is the best single
 * reading's, never less: averaging is not allowed to make it sound more exact than the phone says. Readings that
 * disagree with the newest one (he has moved on) are left out.
 */
export function steadySpot(fixes: Fix[], now: number, windowMs = 60_000): (LatLon & { accuracy: number; readings: number }) | null {
  const fresh = fixes.filter((f) => now - f.at <= windowMs && Number.isFinite(f.accuracy) && f.accuracy > 0);
  if (fresh.length === 0) return null;
  // If he has walked on, readings from where he was are not this spot: only those that agree with the newest count.
  const newest = fresh.reduce((a, b) => (b.at >= a.at ? b : a));
  const recent = fresh.filter((f) => distanceM(f, newest) <= f.accuracy + newest.accuracy);
  const best = Math.min(...recent.map((f) => f.accuracy));
  const good = recent.filter((f) => f.accuracy <= best * 1.5);
  let w = 0, lat = 0, lon = 0;
  for (const f of good) { const k = 1 / f.accuracy ** 2; w += k; lat += f.lat * k; lon += f.lon * k; }
  return { lat: lat / w, lon: lon / w, accuracy: best, readings: good.length };
}

/** Close enough to stop walking: within what the two GPS readings (his now, the find's) can tell apart, and never
 * asked for closer than 5 m. */
export const isThere = (distance: number, hereAccuracy: number, findAccuracy: number | null): boolean =>
  distance <= Math.max(5, hereAccuracy + (findAccuracy ?? 0));

/** A circle of `radiusM` metres around a spot, as map coordinates ([lon, lat] … closed), for drawing how exact it is. */
export function circleRing(c: LatLon, radiusM: number, points = 48): Array<[number, number]> {
  const ring: Array<[number, number]> = [];
  const perDegLat = 111_320;
  const perDegLon = perDegLat * Math.cos((c.lat * Math.PI) / 180);
  for (let i = 0; i <= points; i++) {
    const t = (2 * Math.PI * (i % points)) / points;
    ring.push([c.lon + (radiusM * Math.sin(t)) / perDegLon, c.lat + (radiusM * Math.cos(t)) / perDegLat]);
  }
  return ring;
}
