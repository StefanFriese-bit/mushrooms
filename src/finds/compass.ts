// The phone's compass, for the arrow back to a find (spec 7). An iPhone gives the direction its top points to
// (`webkitCompassHeading`, degrees from magnetic north — within about 2° of true north in Britain) only after he allows
// it with a tap; other phones give an "absolute" orientation. It works with no signal.

export type Heading = { deg: number; /** the phone's own uncertainty in degrees, when it gives one */ accuracy: number | null };
type OrientationEventLike = { alpha: number | null; webkitCompassHeading?: number; webkitCompassAccuracy?: number };

/** The heading from one orientation event, or null when the event carries none. `absolute`: the event's alpha is
 * measured from north (the "deviceorientationabsolute" event), not from wherever the phone happened to start. */
export function headingFrom(e: OrientationEventLike, absolute: boolean): Heading | null {
  if (typeof e.webkitCompassHeading === 'number' && Number.isFinite(e.webkitCompassHeading)) {
    const acc = e.webkitCompassAccuracy;
    return { deg: ((e.webkitCompassHeading % 360) + 360) % 360, accuracy: typeof acc === 'number' && acc >= 0 ? acc : null };
  }
  if (absolute && typeof e.alpha === 'number' && Number.isFinite(e.alpha)) return { deg: (360 - e.alpha) % 360, accuracy: null };
  return null;
}

/** How far to turn the arrow on the screen: the direction to the find, seen from where the phone's top points. */
export const arrowTurn = (bearing: number, heading: number): number => (((bearing - heading) % 360) + 360) % 360;

type PermissionAsking = { requestPermission?: () => Promise<'granted' | 'denied'> };

/** Asks for the compass (an iPhone shows its own question; it must come from his tap). */
export async function allowCompass(): Promise<'granted' | 'denied' | 'none'> {
  if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) return 'none';
  const ask = (window.DeviceOrientationEvent as unknown as PermissionAsking).requestPermission;
  if (typeof ask !== 'function') return 'granted';
  try { return (await ask()) === 'granted' ? 'granted' : 'denied'; } catch { return 'denied'; }
}

/** Follows the compass; `onHeading` gets null while the phone gives no heading. Returns the function that stops. */
export function followHeading(onHeading: (h: Heading | null) => void): () => void {
  const absolute = 'ondeviceorientationabsolute' in window;
  const type = absolute ? 'deviceorientationabsolute' : 'deviceorientation';
  const listen = (e: Event) => onHeading(headingFrom(e as unknown as OrientationEventLike, absolute));
  window.addEventListener(type, listen);
  return () => window.removeEventListener(type, listen);
}
