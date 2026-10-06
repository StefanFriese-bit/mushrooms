import { readFileSync } from 'node:fs';
import { validateCoreLists, type CoreLists } from './lib/core-lists.ts';

const lists = JSON.parse(readFileSync(new URL('./config/core-lists.json', import.meta.url), 'utf8')) as CoreLists;
const problems = validateCoreLists(lists);
console.log(
  `${lists.edibles.length} edible, ${lists.dangerous.length} dangerous, ${lists.pairs.length} pairs, ` +
    `${lists.noDangerousLookalike.length} with no dangerous lookalike`,
);
if (problems.length > 0) {
  console.log(`${problems.length} problem(s):`);
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
console.log('0 problems');
