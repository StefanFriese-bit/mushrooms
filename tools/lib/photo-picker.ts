export type InatObservation = {
  id: number;
  faves_count?: number;
  user?: InatUser;
  photos: Array<{ id: number; license_code: string | null; attribution: string; url: string }>;
};

export type InatUser = { login: string; name?: string | null };

/** iNaturalist's own credit line; a CC0 photo's reads only "no rights reserved", so the observer's name is added. */
export function creditFor(attribution: string, user?: InatUser): string {
  if (/\(c\)|©/i.test(attribution) || !user) return attribution;
  return `${user.name?.trim() || user.login}, no rights reserved (CC0)`;
}

export type PickedPhoto = {
  observationId: number;
  photoId: number;
  licence: 'cc0' | 'cc-by' | 'cc-by-nc';
  credit: string;
  largeUrl: string;
  link: string;
};

const OPEN = new Set(['cc0', 'cc-by', 'cc-by-nc']);

/** Open-licence photos only (spec 5.3), most-faved observations first, up to `perObservation` from each — a sighting's
 *  first photo is usually the whole mushroom, the next ones often its gills and stem (Stefan 06/10: show cap, gills and
 *  stem, not just the top). Every sighting's first photo comes before any second photo, so the strip opens on whole
 *  mushrooms. */
export function pickPhotos(observations: InatObservation[], limit: number, perObservation = 1): PickedPhoto[] {
  const taken: Array<PickedPhoto & { position: number; rank: number }> = [];
  const sorted = [...observations].sort((a, b) => (b.faves_count ?? 0) - (a.faves_count ?? 0));
  for (const [rank, o] of sorted.entries()) {
    if (taken.length >= limit) break;
    const open = o.photos.filter((x) => x.license_code && OPEN.has(x.license_code)).slice(0, perObservation);
    for (const [position, p] of open.slice(0, limit - taken.length).entries()) {
      taken.push({
        observationId: o.id,
        photoId: p.id,
        licence: p.license_code as PickedPhoto['licence'],
        credit: creditFor(p.attribution, o.user),
        largeUrl: p.url.replace('/square.', '/large.'),
        link: `https://www.inaturalist.org/observations/${o.id}`,
        position,
        rank,
      });
    }
  }
  return taken
    .sort((a, b) => a.position - b.position || a.rank - b.rank)
    .map(({ position: _p, rank: _r, ...photo }) => photo);
}
