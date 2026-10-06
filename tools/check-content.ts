import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { checkRecords } from './lib/species-record.ts';
import { checkLearn, type LearnSection } from './lib/learn-page.ts';
import type { SpeciesRecord } from '../src/types.ts';

// Every content rule (spec 5.3/5.4) over content/species/*.json, plus: each species is on the approved list,
// every photo file exists, and the Learn page follows its own rules (tools/lib/learn-page.ts).
const ROOT = new URL('../', import.meta.url);
const hosts = (JSON.parse(readFileSync(new URL('tools/config/core-lists.json', ROOT), 'utf8')) as { allowedSourceHosts: string[] }).allowedSourceHosts;
const approved = new Set(
  (JSON.parse(readFileSync(new URL('content/species-list.json', ROOT), 'utf8')) as { species: Array<{ name: string }> }).species.map((s) => s.name),
);
const files = readdirSync(new URL('content/species/', ROOT)).filter((f) => f.endsWith('.json'));
const records = files.map((f) => JSON.parse(readFileSync(new URL(`content/species/${f}`, ROOT), 'utf8')) as SpeciesRecord);
const problems = checkRecords(records, hosts);
for (const r of records) {
  if (!approved.has(r.scientific)) problems.push(`${r.slug}: ${r.scientific} is not on the approved species list`);
  for (const p of r.photos) if (!existsSync(new URL(`public/${p.file}`, ROOT))) problems.push(`${r.slug}: photo file ${p.file} is missing`);
}
problems.push(...checkLearn(JSON.parse(readFileSync(new URL('content/learn.json', ROOT), 'utf8')) as LearnSection[], hosts));
console.log(`${records.length} species pages`);
if (problems.length > 0) {
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
console.log('0 problems');
