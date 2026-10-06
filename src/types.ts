export type Edibility = 'edible-cooked' | 'edible-some-react' | 'not-edible' | 'poisonous' | 'deadly';
export type LookalikeKind = 'deadly' | 'poisonous' | 'edible' | 'not-edible';

/** A source, declared once per record and referred to by its id in each fact. */
export type SourceRef = { id: string; title: string; url: string };
/** Every safety fact names the sources (by id) that state it. */
export type Sourced<T> = { value: T; sources: string[] };

export type Photo = {
  file: string; // relative to the site root, e.g. "photos/field-mushroom/1.webp"
  view: 'top' | 'underneath' | 'base' | 'whole' | 'young' | 'old';
  credit: string; // the photographer, as iNaturalist gives it
  licence: 'cc0' | 'cc-by' | 'cc-by-nc';
  link: string; // the observation on iNaturalist
};

export type Lookalike = {
  scientific: string;
  english: string;
  slug: string | null; // the lookalike's own page, when the guide has one
  kind: LookalikeKind;
  /** One row per feature that tells the two apart. */
  tellApart: Array<{ feature: string; thisOne: string; thatOne: string; sources: string[] }>;
};

export type Features = {
  underside: Sourced<'gills' | 'pores' | 'teeth' | 'ridges' | 'smooth' | 'other'>;
  ring: Sourced<'yes' | 'no' | 'sometimes'>;
  bagAtBase: Sourced<'yes' | 'no'>;
  growsOn: Sourced<'ground' | 'wood' | 'other-fungi' | 'dung'>;
  /** Cap width in cm; null for a crust or patch with no set size, which Identify keeps under every size answer. */
  capCm: Sourced<[number, number] | null>;
  fleshChange: Sourced<string>;
  smell: Sourced<string>;
};

export type SpeciesRecord = {
  slug: string;
  inatId: number;
  scientific: string;
  english: string;
  olderNames: string[];
  /** Other English names the species goes by, as its sources list them ("Porcini" for the Penny Bun). */
  otherNames?: Sourced<string[]>;
  edibility: Sourced<Edibility>;
  edibilityNote: Sourced<string> | null;
  protectedInUk: Sourced<boolean>;
  topPoints: Sourced<string>[];
  habitat: Sourced<string>;
  seasonMonths: Sourced<number[]>;
  sporePrint: Sourced<string>;
  features: Features;
  lookalikes: Lookalike[];
  noDangerousLookalike: { sources: string[] } | null;
  photos: Photo[];
  sources: SourceRef[];
  checked: string; // ISO date the facts were last checked
};
