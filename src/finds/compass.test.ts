import { afterEach, describe, expect, it, vi } from 'vitest';
import { arrowTurn, headingFrom, mapTurnsWithMe, nextMapBearing, rememberMapTurns, signedTurn } from './compass';

describe('the compass for the arrow back to a find', () => {
  it('reads an iPhone\'s heading, and its own accuracy when it has one', () => {
    expect(headingFrom({ alpha: 10, webkitCompassHeading: 270, webkitCompassAccuracy: 15 }, false)).toEqual({ deg: 270, accuracy: 15 });
    expect(headingFrom({ alpha: 10, webkitCompassHeading: 0, webkitCompassAccuracy: -1 }, false)).toEqual({ deg: 0, accuracy: null }); // -1 = not known
  });
  it('reads other phones only from an orientation measured from north', () => {
    expect(headingFrom({ alpha: 90 }, true)).toEqual({ deg: 270, accuracy: null });
    expect(headingFrom({ alpha: 90 }, false)).toBeNull(); // alpha from wherever the phone started: no use as a compass
    expect(headingFrom({ alpha: null }, true)).toBeNull();
  });
  it('turns the arrow by the direction to the find less the way the phone points', () => {
    expect(arrowTurn(45, 0)).toBe(45); // facing north, the find north-east: arrow to the right-ish
    expect(arrowTurn(45, 45)).toBe(0); // facing it: straight ahead
    expect(arrowTurn(10, 350)).toBe(20);
    expect(arrowTurn(350, 10)).toBe(340);
  });
});

// The compass question (Stefan 10/10/2026: Take me there brings up the compass, the directions and the map). The module
// keeps the answer while the app is open, so each test loads it fresh.
describe('asking for the compass in the Take me there tap', () => {
  const load = async (orientation: unknown) => {
    vi.resetModules();
    vi.unstubAllGlobals();
    vi.stubGlobal('window', orientation === undefined ? {} : { DeviceOrientationEvent: orientation });
    return import('./compass');
  };
  afterEach(() => vi.unstubAllGlobals());

  it('asks an iPhone inside the tap itself, of the object itself, and keeps its yes', async () => {
    let answer: (r: 'granted' | 'denied') => void = () => {};
    const orientation = { requestPermission: vi.fn(function (this: unknown) {
      expect(this).toBe(orientation); // called as the object's own method, never loose
      return new Promise<'granted' | 'denied'>((done) => { answer = done; });
    }) };
    const c = await load(orientation);
    expect(c.compassAsked()).toBeNull(); // not asked before the tap
    c.askForCompassOnTap();
    expect(orientation.requestPermission).toHaveBeenCalledTimes(1); // already asked when the tap returns
    expect(c.compassAsked()?.answer).toBeNull(); // the question is on screen
    answer('granted');
    await expect(c.compassAsked()!.reply).resolves.toBe('granted');
    expect(c.compassAsked()?.answer).toBe('granted');
  });

  it('takes a no, or a question the phone refused to show, as not allowed', async () => {
    const no = await load({ requestPermission: () => Promise.resolve('denied') });
    await expect(no.allowCompass()).resolves.toBe('denied');
    expect(no.compassAsked()?.answer).toBe('denied');
    const refused = await load({ requestPermission: () => Promise.reject(new Error('NotAllowedError')) });
    await expect(refused.allowCompass()).resolves.toBe('denied');
    const thrown = await load({ requestPermission: () => { throw new Error('boom'); } });
    await expect(thrown.allowCompass()).resolves.toBe('denied');
  });

  it('needs no question on a phone that does not ask, and says so on one with no compass at all', async () => {
    const other = await load(function DeviceOrientationEvent() {});
    await expect(other.allowCompass()).resolves.toBe('granted');
    const none = await load(undefined);
    await expect(none.allowCompass()).resolves.toBe('none');
  });

  it('reports the newest question: a second tap starts it again', async () => {
    let first: (r: 'granted' | 'denied') => void = () => {};
    const replies = [new Promise<'granted' | 'denied'>((d) => { first = d; }), Promise.resolve<'granted' | 'denied'>('granted')];
    const c = await load({ requestPermission: () => replies.shift()! });
    void c.allowCompass();
    const second = c.allowCompass();
    first('denied'); // the first question's late answer must not stand for the second
    await expect(second).resolves.toBe('granted');
    await Promise.resolve();
    expect(c.compassAsked()?.answer).toBe('granted');
  });
});

describe('the map turned the way he points the phone', () => {
  it('turns the shortest way round, never the long way', () => {
    expect(signedTurn(350, 10)).toBe(20);
    expect(signedTurn(10, 350)).toBe(-20);
    // Exactly half a turn is as far one way as the other: it answers -180 every time, and only how far it is matters.
    expect(Math.abs(signedTurn(0, 180))).toBe(180);
    expect(Math.abs(signedTurn(90, 270))).toBe(180);
    expect(signedTurn(0, 0)).toBe(0);
  });

  it('leaves the map alone while the phone is only wandering, and turns it when he really turns', () => {
    expect(nextMapBearing(90, 91)).toBe(null); // 1° — the compass's own shiver
    expect(nextMapBearing(90, 92.9)).toBe(null);
    expect(nextMapBearing(90, 93)).toBe(93);
    expect(nextMapBearing(90, 270)).toBe(270);
    // Across north: 358° → 2° is a 4° turn, so it happens, and 359° → 1° is 2°, so it does not.
    expect(nextMapBearing(358, 2)).toBe(2);
    expect(nextMapBearing(359, 1)).toBe(null);
  });

  it('brings the map back to north the moment he locks it, however small the turn', () => {
    expect(nextMapBearing(1, null)).toBe(0); // 1° would be too small to follow him, but locking is his own choice
    expect(nextMapBearing(270, null)).toBe(0);
    expect(nextMapBearing(0, null)).toBe(null); // already north at the top: nothing to do
  });

  it('is given a direction that is already between 0 and 360, whatever the phone said', () => {
    expect(nextMapBearing(0, 400)).toBe(40);
    expect(nextMapBearing(0, -90)).toBe(270);
  });

  it('remembers his choice, and starts turning with him on a phone that keeps nothing', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v); },
    });
    expect(mapTurnsWithMe()).toBe(true); // nothing said yet
    rememberMapTurns(false);
    expect(mapTurnsWithMe()).toBe(false);
    rememberMapTurns(true);
    expect(mapTurnsWithMe()).toBe(true);
    // A phone that refuses storage altogether: the map still turns with him.
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('no'); }, setItem: () => { throw new Error('no'); } });
    expect(mapTurnsWithMe()).toBe(true);
    expect(() => rememberMapTurns(false)).not.toThrow();
  });
});
