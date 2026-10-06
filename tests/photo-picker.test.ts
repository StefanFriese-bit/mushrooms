import { describe, expect, it } from 'vitest';
import { pickPhotos } from '../tools/lib/photo-picker.ts';

const obs = (id: number, licence: string | null, faves = 0) => ({
  id,
  faves_count: faves,
  photos: [{ id: id * 10, license_code: licence, attribution: `(c) person ${id}, some rights reserved (CC BY)`, url: `https://inaturalist-open-data.s3.amazonaws.com/photos/${id * 10}/square.jpg` }],
});

describe('pickPhotos', () => {
  it('keeps open licences only, most-faved first, one photo per observation, up to the limit', () => {
    const picked = pickPhotos([obs(1, 'cc-by', 2), obs(2, null, 9), obs(3, 'cc-by-nc', 5), obs(4, 'cc-by-sa', 7), obs(5, 'cc0', 1)], 3);
    expect(picked.map((p) => p.observationId)).toEqual([3, 1, 5]);
    expect(picked[0]).toMatchObject({ licence: 'cc-by-nc', link: 'https://www.inaturalist.org/observations/3' });
    expect(picked[0].largeUrl).toBe('https://inaturalist-open-data.s3.amazonaws.com/photos/30/large.jpg');
  });
  it('names the observer on a CC0 photo, whose iNaturalist credit is only "no rights reserved"', () => {
    const cc0 = (user: { login: string; name?: string | null }) => ({
      id: 7, faves_count: 0, user,
      photos: [{ id: 70, license_code: 'cc0', attribution: 'no rights reserved', url: 'https://x/photos/70/square.jpg' }],
    });
    expect(pickPhotos([cc0({ login: 'abc', name: 'Ann Bee' })], 1)[0].credit).toBe('Ann Bee, no rights reserved (CC0)');
    expect(pickPhotos([cc0({ login: 'abc', name: null })], 1)[0].credit).toBe('abc, no rights reserved (CC0)');
    expect(pickPhotos([obs(1, 'cc-by')], 1)[0].credit).toBe('(c) person 1, some rights reserved (CC BY)');
  });
});
