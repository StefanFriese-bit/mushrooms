import { readFileSync } from 'node:fs';
import { createInatClient } from './lib/inat.ts';
import type { CoreLists } from './lib/core-lists.ts';

const lists = JSON.parse(readFileSync(new URL('./config/core-lists.json', import.meta.url), 'utf8')) as CoreLists;
const names = [...new Set([...lists.edibles.map((e) => e.name), ...lists.dangerous.map((d) => d.name)])];
const inat = createInatClient();
let notCurrent = 0;
for (const name of names) {
  try {
    await inat.resolveTaxon(name, 'species');
  } catch {
    notCurrent++;
    const q = new URLSearchParams({ q: name, per_page: '3' });
    const body = await inat.getJson(`/taxa?${q}`);
    const top = (body.results ?? [])[0];
    console.log(
      `NOT CURRENT: ${name} -> iNaturalist suggests "${top?.name ?? '(nothing)'}" ` +
        `(${top?.rank ?? '-'}, matched "${top?.matched_term ?? '-'}")`,
    );
  }
}
console.log(`${names.length - notCurrent} of ${names.length} names are iNaturalist's current names`);
process.exit(notCurrent > 0 ? 1 : 0);
