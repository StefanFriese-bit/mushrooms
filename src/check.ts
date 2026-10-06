import type { LookalikeKind, SpeciesRecord } from './types';

// Check (spec 8): a species side by side with its lookalikes, one row per feature from the page's sourced "tell them
// apart" rows. He ticks what he sees. A tick is a RED flag when the words he ticked belong to a Deadly or Poisonous
// species — the one being checked or a lookalike — never merely because it is a lookalike: checking the Deathcap and
// ticking the Field Mushroom's words is no danger sign, and no reason to trust it either. No verdict on eating.
export type Danger = 'deadly' | 'poisonous' | null;
/** A column: the species (kind null) or one of its lookalikes; `danger` says whether it is Deadly or Poisonous. */
export type Column = { english: string; scientific: string; slug: string | null; kind: LookalikeKind | null; danger: Danger };
/** One feature: the species' words first, then each lookalike's (null when the page has no row for it). */
export type Row = { feature: string; cells: Array<string | null> };
export type Table = { columns: Column[]; rows: Row[] };

const dangerOf = (v: string): Danger => (v === 'deadly' ? 'deadly' : v === 'poisonous' ? 'poisonous' : null);

export function checkTable(s: SpeciesRecord): Table {
  const columns: Column[] = [
    { english: s.english, scientific: s.scientific, slug: s.slug, kind: null, danger: dangerOf(s.edibility.value) },
    ...s.lookalikes.map((l) => ({ english: l.english, scientific: l.scientific, slug: l.slug, kind: l.kind, danger: dangerOf(l.kind) })),
  ];
  const rows: Row[] = [];
  s.lookalikes.forEach((l, i) => {
    for (const r of l.tellApart) {
      let row = rows.find((x) => x.feature.toLowerCase() === r.feature.toLowerCase());
      if (!row) {
        row = { feature: r.feature, cells: columns.map(() => null) };
        rows.push(row);
      }
      const own = row.cells[0];
      if (own === null) row.cells[0] = r.thisOne;
      else if (!own.split(' · ').includes(r.thisOne)) row.cells[0] = `${own} · ${r.thisOne}`;
      row.cells[i + 1] = r.thatOne;
    }
  });
  return { columns, rows };
}

/** One tick: its feature, every species whose words in that row are the words he ticked, and whether any is dangerous. */
export type Tick = { feature: string; species: Column[]; dangerous: boolean };
export type Verdict = {
  ticked: number;
  ticks: Tick[];
  /** The Deadly or Poisonous species his ticks fit, each once, in the order he ticked them. */
  dangerous: Column[];
  /** The other species his ticks fit, each once. */
  others: Column[];
};

/** His ticks: row index → the column he ticked (0 = the species). */
export function verdict(t: Table, ticks: Map<number, number>): Verdict {
  const v: Verdict = { ticked: 0, ticks: [], dangerous: [], others: [] };
  const add = (list: Column[], c: Column) => { if (!list.includes(c)) list.push(c); };
  for (const [row, col] of [...ticks].sort((a, b) => a[0] - b[0])) {
    const cells = t.rows[row]?.cells;
    const words = cells?.[col];
    if (!cells || words == null) continue;
    const species = cells.flatMap((c, i) => (c === words ? [t.columns[i]] : []));
    const dangerous = species.some((c) => c.danger !== null);
    v.ticked++;
    v.ticks.push({ feature: t.rows[row].feature, species, dangerous });
    for (const c of species) add(c.danger ? v.dangerous : v.others, c);
  }
  return v;
}
