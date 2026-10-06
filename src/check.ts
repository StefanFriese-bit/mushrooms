import type { LookalikeKind, SpeciesRecord } from './types';

// Check (spec 8): a species side by side with its lookalikes, one row per feature from the page's sourced "tell them
// apart" rows. He ticks what he sees; a tick that fits a lookalike better is flagged. No verdict on eating.
/** A column: the species (kind null) or one of its lookalikes. */
export type Column = { english: string; scientific: string; slug: string | null; kind: LookalikeKind | null };
/** One feature: the species' words first, then each lookalike's (null when the page has no row for it). */
export type Row = { feature: string; cells: Array<string | null> };
export type Table = { columns: Column[]; rows: Row[] };

export function checkTable(s: SpeciesRecord): Table {
  const columns: Column[] = [{ english: s.english, scientific: s.scientific, slug: s.slug, kind: null },
    ...s.lookalikes.map((l) => ({ english: l.english, scientific: l.scientific, slug: l.slug, kind: l.kind }))];
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

export type Verdict = {
  ticked: number;
  fitsSpecies: number;
  /** Each row he ticked on a lookalike: the feature and every lookalike whose words in that row he ticked. */
  fitsLookalike: Array<{ feature: string; lookalikes: Column[] }>;
};

/** His ticks: row index → the column he ticked (0 = the species). */
export function verdict(t: Table, ticks: Map<number, number>): Verdict {
  const v: Verdict = { ticked: 0, fitsSpecies: 0, fitsLookalike: [] };
  for (const [row, col] of [...ticks].sort((a, b) => a[0] - b[0])) {
    const cells = t.rows[row]?.cells;
    const words = cells?.[col];
    if (!cells || words == null) continue;
    v.ticked++;
    if (col === 0) v.fitsSpecies++;
    else {
      const same = cells.flatMap((c, i) => (i > 0 && c === words ? [t.columns[i]] : []));
      v.fitsLookalike.push({ feature: t.rows[row].feature, lookalikes: same });
    }
  }
  return v;
}
