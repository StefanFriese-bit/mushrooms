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

export type CompassAnswer = 'granted' | 'denied' | 'none';
let question: Promise<CompassAnswer> | null = null;
let answer: CompassAnswer | null = null;

/** The compass question while the app is open: null when it has not been asked yet; otherwise the phone's answer (null
 * while the question is still on screen) and the promise of it. */
export function compassAsked(): { answer: CompassAnswer | null; reply: Promise<CompassAnswer> } | null {
  return question ? { answer, reply: question } : null;
}

/** Asks for the compass (an iPhone shows its own question; it must come from his tap). The answer is kept while the app
 * is open, so the Take me there screen can follow it. Never fails: a refusal or an error is 'denied'. */
export function allowCompass(): Promise<CompassAnswer> {
  let reply: Promise<CompassAnswer>;
  if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) reply = Promise.resolve('none');
  else {
    const orientation = window.DeviceOrientationEvent as unknown as PermissionAsking;
    if (typeof orientation.requestPermission !== 'function') reply = Promise.resolve('granted');
    else {
      try {
        // Asked of the object itself, inside his tap: an iPhone shows its question only then.
        reply = orientation.requestPermission().then((r): CompassAnswer => (r === 'granted' ? 'granted' : 'denied'), () => 'denied');
      } catch { reply = Promise.resolve('denied'); }
    }
  }
  answer = null;
  const asked: Promise<CompassAnswer> = reply.then((a) => { if (question === asked) answer = a; return a; });
  question = asked;
  return asked;
}

/** A tap on "Take me there" (Stefan 10/10/2026: it should bring up the compass, the directions and the map). The
 * compass is asked for in that same tap, because an iPhone shows its question only from a tap; the link then opens the
 * screen as usual, and the arrow follows the compass as soon as he allows it. */
export function askForCompassOnTap(): void { void allowCompass(); }

/** Follows the compass; `onHeading` gets null while the phone gives no heading. Returns the function that stops. */
export function followHeading(onHeading: (h: Heading | null) => void): () => void {
  const absolute = 'ondeviceorientationabsolute' in window;
  const type = absolute ? 'deviceorientationabsolute' : 'deviceorientation';
  const listen = (e: Event) => onHeading(headingFrom(e as unknown as OrientationEventLike, absolute));
  window.addEventListener(type, listen);
  return () => window.removeEventListener(type, listen);
}
