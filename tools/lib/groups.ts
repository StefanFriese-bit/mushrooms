import type { InatTaxon } from './inat.ts';

export type GroupRef = { name: string; rank: string; why?: string };
export type GroupsConfig = { placeId: number; include: GroupRef[]; exclude: GroupRef[] };
export type ResolvedGroup = GroupRef & { id: number };
export type ResolvedGroups = { include: ResolvedGroup[]; exclude: ResolvedGroup[] };

export async function resolveGroups(
  cfg: GroupsConfig,
  resolveTaxon: (name: string, rank: string) => Promise<InatTaxon>,
): Promise<ResolvedGroups> {
  const include: ResolvedGroup[] = [];
  for (const g of cfg.include) include.push({ ...g, id: (await resolveTaxon(g.name, g.rank)).id });
  const exclude: ResolvedGroup[] = [];
  for (const g of cfg.exclude) exclude.push({ ...g, id: (await resolveTaxon(g.name, g.rank)).id });
  return { include, exclude };
}

/** True when the taxon sits under an included group and under no excluded group. */
export function makeGroupFilter(groups: ResolvedGroups) {
  const inc = new Set(groups.include.map((g) => g.id));
  const exc = new Set(groups.exclude.map((g) => g.id));
  return (taxon: Pick<InatTaxon, 'id' | 'ancestor_ids'>): boolean => {
    const lineage = [...taxon.ancestor_ids, taxon.id];
    if (lineage.some((id) => exc.has(id))) return false;
    return lineage.some((id) => inc.has(id));
  };
}
