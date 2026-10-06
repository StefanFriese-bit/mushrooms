import type { SpeciesRecord } from '../../src/types.ts';
import { hostOf } from './core-lists.ts';
import { sporeGroups } from '../../src/spore.ts';

const EDIBILITY = ['edible-cooked', 'edible-some-react', 'not-edible', 'poisonous', 'deadly'];
const KINDS = ['deadly', 'poisonous', 'edible', 'not-edible'];
const LICENCES = ['cc0', 'cc-by', 'cc-by-nc'];

/** Every problem with one record, in words. */
export function checkRecord(r: SpeciesRecord, allowedHosts: string[]): string[] {
  const out: string[] = [];
  const say = (m: string) => out.push(`${r.slug}: ${m}`);
  const allowed = new Set(allowedHosts.map((h) => h.replace(/^www\./, '')));
  const hostById = new Map<string, string>();
  for (const s of r.sources) {
    const h = hostOf(s.url);
    if (!h || !allowed.has(h)) say(`source "${s.id}" is on ${h ?? 'an invalid address'}, which is not on the allowed list`);
    else hostById.set(s.id, h);
  }

  const sourced = (what: string, sources: string[]) => {
    const hosts = new Set<string>();
    for (const id of sources) {
      const h = hostById.get(id);
      if (!h) {
        if (!r.sources.some((s) => s.id === id)) say(`${what} names an undeclared source "${id}"`);
      } else hosts.add(h);
    }
    if (hosts.size < 2) say(`${what} needs sources from two different websites (has ${hosts.size})`);
  };
  // Not a safety fact (spec 5.3): one declared, allowed source is enough.
  const sourcedOnce = (what: string, sources: string[]) => {
    for (const id of sources) if (!r.sources.some((s) => s.id === id)) say(`${what} names an undeclared source "${id}"`);
    if (!sources.some((id) => hostById.has(id))) say(`${what} needs at least one source`);
  };

  if (!/^[a-z0-9-]+$/.test(r.slug)) say('slug must be lower-case letters, digits and hyphens');
  if (!EDIBILITY.includes(r.edibility.value)) say(`edibility "${r.edibility.value}" is not one of ${EDIBILITY.join(', ')}`);
  sourced('edibility', r.edibility.sources);
  if (r.edibilityNote) sourced('edibilityNote', r.edibilityNote.sources);
  sourced('protectedInUk', r.protectedInUk.sources);
  if (r.topPoints.length < 3 || r.topPoints.length > 6) say(`needs 3 to 6 top points (has ${r.topPoints.length})`);
  r.topPoints.forEach((t, i) => sourced(`top point ${i + 1}`, t.sources));
  sourced('habitat', r.habitat.sources);
  sourcedOnce('seasonMonths', r.seasonMonths.sources);
  sourced('sporePrint', r.sporePrint.sources);
  if (sporeGroups(r.sporePrint.value).length === 0) say(`sporePrint "${r.sporePrint.value}" names no colour group Identify can ask about`);
  // The structural features the Check screen compares need two websites; how the flesh changes and how it smells
  // are descriptions (their safety use is in the "tell them apart" rows, which need two).
  const DESCRIPTIVE = new Set(['fleshChange', 'smell']);
  for (const [k, v] of Object.entries(r.features)) (DESCRIPTIVE.has(k) ? sourcedOnce : sourced)(`feature ${k}`, v.sources);

  for (const l of r.lookalikes) {
    if (!KINDS.includes(l.kind)) say(`lookalike ${l.english} has an unknown kind "${l.kind}"`);
    if (l.tellApart.length === 0) say(`lookalike ${l.english} needs at least one "tell them apart" row`);
    l.tellApart.forEach((row, i) => sourced(`lookalike ${l.english} row ${i + 1}`, row.sources));
  }
  const edible = r.edibility.value === 'edible-cooked' || r.edibility.value === 'edible-some-react';
  const dangerousLookalikes = r.lookalikes.filter((l) => l.kind === 'deadly' || l.kind === 'poisonous');
  if (edible && dangerousLookalikes.length === 0 && !r.noDangerousLookalike) {
    say('an edible species must name its dangerous lookalikes or carry "no dangerous lookalike"');
  }
  if (r.noDangerousLookalike) {
    if (dangerousLookalikes.length > 0) say('names dangerous lookalikes AND says it has none');
    sourced('noDangerousLookalike', r.noDangerousLookalike.sources);
  }

  if (r.photos.length === 0) say('needs at least one photo');
  r.photos.forEach((p, i) => {
    if (!LICENCES.includes(p.licence)) say(`photo ${i + 1} has a licence that is not allowed (${p.licence})`);
    if (!p.credit.trim()) say(`photo ${i + 1} has no credit`);
    if (!/^https:\/\/www\.inaturalist\.org\/observations\/\d+$/.test(p.link)) say(`photo ${i + 1} needs its iNaturalist observation link`);
  });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.checked)) say('checked must be a date like 2026-10-06');
  if (/\bsafe\b/i.test(JSON.stringify({ ...r, sources: [], photos: [] }))) say('uses the word "safe"');
  return out;
}

/** Rules across all records, plus each record's own rules. */
export function checkRecords(records: SpeciesRecord[], allowedHosts: string[]): string[] {
  const out = records.flatMap((r) => checkRecord(r, allowedHosts));
  const seen = new Set<string>();
  for (const r of records) {
    if (seen.has(r.slug)) out.push(`${r.slug}: slug used twice`);
    seen.add(r.slug);
  }
  const bySlug = new Map(records.map((r) => [r.slug, r]));
  for (const r of records) {
    for (const l of r.lookalikes) {
      const other = l.slug ? bySlug.get(l.slug) : undefined;
      if (other && !other.lookalikes.some((x) => x.slug === r.slug)) out.push(`${other.slug}: does not link back to its lookalike ${r.slug}`);
    }
  }
  return out;
}
