import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createInatClient } from './lib/inat.ts';
import { pickTestObservations, type TestObservation } from './lib/test-photo-picker.ts';
import type { SpeciesRecord } from '../src/types.ts';

// UK test photos for the scan test (spec 6.3): for each of our 300, research-grade observations with openly licensed
// photos — 50 for a dangerous species, 20 for the rest — never one the guide shows, spread over observers, up to three
// photos each at 500 px. Kept in cache/test-photos/ on the Mac only (never committed, never published).
const ROOT = new URL('../', import.meta.url);
const DIR = new URL('cache/test-photos/', ROOT);
const LICENCES = 'cc0,cc-by,cc-by-nc,cc-by-sa,cc-by-nd,cc-by-nc-sa,cc-by-nc-nd';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Entry = { species: string; inatId: number; obsId: number; month: number; files: string[] };

const exclude = new Set<number>();
for (const f of readdirSync(new URL('content/species/', ROOT)).filter((f) => f.endsWith('.json'))) {
  const r = JSON.parse(readFileSync(new URL(`content/species/${f}`, ROOT), 'utf8')) as SpeciesRecord;
  for (const p of r.photos) exclude.add(Number(p.link.split('/').pop()));
}

const list = (JSON.parse(readFileSync(new URL('content/species-list.json', ROOT), 'utf8')) as {
  species: Array<{ name: string; inatId: number; dangerLevel: string | null }>;
}).species;
const inat = createInatClient();
const index: Entry[] = [];
const downloads: Array<{ url: string; file: string }> = [];
for (const s of list) {
  const q = new URLSearchParams({ taxon_id: String(s.inatId), place_id: '6857', quality_grade: 'research', photos: 'true',
    photo_license: LICENCES, order_by: 'id', order: 'desc', per_page: '200' });
  const body = await inat.getJson(`/observations?${q}`);
  const picked = pickTestObservations((body.results ?? []) as TestObservation[], exclude, s.dangerLevel ? 50 : 20);
  for (const p of picked) {
    const files = p.urls.map((url, k) => {
      const file = `${s.inatId}/${p.obsId}-${k}.jpg`;
      downloads.push({ url, file });
      return file;
    });
    index.push({ species: s.name, inatId: s.inatId, obsId: p.obsId, month: p.month, files });
  }
  console.log(`${s.name}: ${picked.length} observations`);
}

let done = 0;
const failed = new Set<string>();
async function worker() {
  for (let d = downloads.shift(); d; d = downloads.shift()) {
    const dst = new URL(d.file, DIR);
    if (!existsSync(dst)) {
      mkdirSync(new URL('./', dst), { recursive: true });
      for (let attempt = 1; ; attempt++) {
        try {
          const res = await fetch(d.url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          writeFileSync(dst, Buffer.from(await res.arrayBuffer()));
          break;
        } catch (err) {
          if (attempt >= 3) { failed.add(d.file); console.log(`  could not download ${d.url}: ${String(err)}`); break; }
          await sleep(2000 * attempt);
        }
      }
    }
    if (++done % 1000 === 0) console.log(`${done} photos`);
  }
}
await Promise.all([worker(), worker(), worker(), worker()]);

// Only what is on disk goes into the index.
const kept = index
  .map((e) => ({ ...e, files: e.files.filter((f) => !failed.has(f) && existsSync(new URL(f, DIR))) }))
  .filter((e) => e.files.length > 0);
mkdirSync(DIR, { recursive: true });
writeFileSync(new URL('index.json', DIR), JSON.stringify(kept) + '\n');
console.log(`${kept.length} observations, ${kept.reduce((n, e) => n + e.files.length, 0)} photos, ${failed.size} downloads failed`);
