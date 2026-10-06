export type Df20Row = { class_id: string; species: string; scientificName: string };
export type Df20Class = { id: number; name: string; filedAs: string; photos: number };
export type OurSpecies = { name: string; olderNames: string[] };

/** "Inocybe lilacina (Peck) Kauffman" → "Inocybe lilacina". */
export function binomial(scientificName: string): string | null {
  const m = /^([A-Z][a-z]+) ([a-z][a-z-]+)/.exec(scientificName.trim());
  return m ? `${m[1]} ${m[2]}` : null;
}

/** One entry per class number: its own scientific name, the species it is filed under, and its training photos. */
export function df20Classes(rows: Iterable<Df20Row>): Df20Class[] {
  const byId = new Map<number, Df20Class>();
  for (const r of rows) {
    const id = Number(r.class_id);
    const known = byId.get(id);
    if (known) { known.photos++; continue; }
    const filedAs = r.species.trim();
    byId.set(id, { id, name: binomial(r.scientificName) ?? filedAs, filedAs, photos: 1 });
  }
  return [...byId.values()].sort((a, b) => a.id - b.id);
}

/**
 * Which of our species each class is. A class's own name wins (current or older name of ours). The name it is filed
 * under counts only when its own name matches none of ours AND no class carries that name as its own — so a variety
 * filed under its parent species (class 728, Inocybe lilacina) is never taken for the parent.
 */
export function matchClasses(classes: Df20Class[], ours: OurSpecies[]): Map<number, string> {
  const ourByName = new Map<string, string>();
  for (const s of ours) ourByName.set(s.name, s.name);
  for (const s of ours) for (const o of s.olderNames) if (!ourByName.has(o)) ourByName.set(o, s.name);
  const ownNames = new Set(classes.map((c) => c.name));
  const out = new Map<number, string>();
  for (const c of classes) {
    const own = ourByName.get(c.name);
    if (own) out.set(c.id, own);
    else if (!ownNames.has(c.filedAs)) {
      const filed = ourByName.get(c.filedAs);
      if (filed) out.set(c.id, filed);
    }
  }
  return out;
}
