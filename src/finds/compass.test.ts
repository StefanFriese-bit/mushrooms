import { describe, expect, it } from 'vitest';
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
