import { afterEach, describe, expect, it, vi } from 'vitest';
import { arrowTurn, headingFrom } from './compass';

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
