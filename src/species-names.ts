// The English and scientific names of our 300 species (the approved list), loaded when a screen first needs them.
export type SpeciesName = { name: string; english: string };
let loading: Promise<SpeciesName[]> | null = null;

export function speciesNames(): Promise<SpeciesName[]> {
  loading ??= import('../content/species-list.json').then((m) =>
    m.default.species
      .map((s: { name: string; english: string | null }) => ({ name: s.name, english: s.english ?? s.name }))
      .sort((a: SpeciesName, b: SpeciesName) => a.english.localeCompare(b.english, 'en-GB')));
  return loading;
}
