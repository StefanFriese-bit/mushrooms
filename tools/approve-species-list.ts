import { readFileSync, writeFileSync } from 'node:fs';

const file = new URL('../content/species-list.json', import.meta.url);
const list = JSON.parse(readFileSync(file, 'utf8'));
const today = new Date().toISOString().slice(0, 10);
list.approved = { by: 'Stefan', on: today, count: list.species.length };
writeFileSync(file, JSON.stringify(list, null, 2) + '\n');
console.log(`Stamped ${list.species.length} species as approved by Stefan on ${today}`);
