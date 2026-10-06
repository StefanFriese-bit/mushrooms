import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { createInatClient } from './lib/inat.ts';
import { pickPhotos, type InatObservation } from './lib/photo-picker.ts';
import type { SpeciesRecord } from '../src/types.ts';

// For every species record with fewer than four photos: the most-faved UK research-grade iNaturalist observations
// with an open licence (topped up from Europe when the UK has too few), saved as 800px WebP copies, each credited.
const ROOT = new URL('../', import.meta.url);
const WANT = 4;
const UK = '6857';
const EUROPE = '97391';
const inat = createInatClient();

for (const file of readdirSync(new URL('content/species/', ROOT)).filter((f) => f.endsWith('.json'))) {
  const url = new URL(`content/species/${file}`, ROOT);
  const rec = JSON.parse(readFileSync(url, 'utf8')) as SpeciesRecord;
  if (rec.photos.length >= WANT) continue;
  const search = async (placeId: string) => {
    const q = new URLSearchParams({
      taxon_id: String(rec.inatId), place_id: placeId, quality_grade: 'research', photos: 'true',
      photo_license: 'cc0,cc-by,cc-by-nc', order_by: 'votes', per_page: '30',
    });
    return pickPhotos((await inat.getJson(`/observations?${q}`)).results as InatObservation[], WANT);
  };
  const picked = await search(UK);
  // A rare species can have few open-licence UK photos (none for the Fool's Webcap): the rest come from Europe.
  if (picked.length < WANT) {
    for (const p of await search(EUROPE)) {
      if (picked.length < WANT && !picked.some((x) => x.observationId === p.observationId)) picked.push(p);
    }
  }
  mkdirSync(new URL(`public/photos/${rec.slug}/`, ROOT), { recursive: true });
  rec.photos = [];
  for (const [i, p] of picked.entries()) {
    const res = await fetch(p.largeUrl);
    if (!res.ok) throw new Error(`Photo ${p.largeUrl} answered HTTP ${res.status}`);
    const out = `photos/${rec.slug}/${i + 1}.webp`;
    await sharp(Buffer.from(await res.arrayBuffer()))
      .resize({ width: 800, withoutEnlargement: true })
      .webp({ quality: 72 })
      .toFile(fileURLToPath(new URL(`public/${out}`, ROOT)));
    rec.photos.push({ file: out, view: 'whole', credit: p.credit, licence: p.licence, link: p.link });
  }
  writeFileSync(url, JSON.stringify(rec, null, 2) + '\n');
  console.log(`${rec.slug}: ${rec.photos.length} photos`);
}
