export type InatObservation = {
  id: number;
  faves_count?: number;
  photos: Array<{ id: number; license_code: string | null; attribution: string; url: string }>;
};

export type PickedPhoto = {
  observationId: number;
  photoId: number;
  licence: 'cc0' | 'cc-by' | 'cc-by-nc';
  credit: string;
  largeUrl: string;
  link: string;
};

const OPEN = new Set(['cc0', 'cc-by', 'cc-by-nc']);

/** Open-licence photos only (spec 5.3), the observation's first such photo, most-faved observations first. */
export function pickPhotos(observations: InatObservation[], limit: number): PickedPhoto[] {
  return [...observations]
    .sort((a, b) => (b.faves_count ?? 0) - (a.faves_count ?? 0))
    .flatMap((o) => {
      const p = o.photos.find((x) => x.license_code && OPEN.has(x.license_code));
      if (!p) return [];
      return [{
        observationId: o.id,
        photoId: p.id,
        licence: p.license_code as PickedPhoto['licence'],
        credit: p.attribution,
        largeUrl: p.url.replace('/square.', '/large.'),
        link: `https://www.inaturalist.org/observations/${o.id}`,
      }];
    })
    .slice(0, limit);
}
