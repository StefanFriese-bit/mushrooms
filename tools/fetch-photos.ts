import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { createInatClient } from './lib/inat.ts';
import { pickPhotos, type InatObservation } from './lib/photo-picker.ts';
import type { SpeciesRecord } from '../src/types.ts';

// For every species record with fewer than four photos: the most-faved UK research-grade iNaturalist observations
// with an open licence, saved as 800px WebP copies, each credited in the record.
const ROOT = new URL('../', import.meta.url);
const WANT = 4;
const inat = createInatClient();

for (const file of readdirSync(new URL('content/species/', ROOT)).filter((f) => f.endsWith('.json'))) {
  const url = new URL(`content/species/${file}`, ROOT);
  const rec = JSON.parse(readFileSync(url, 'utf8')) as SpeciesRecord;
  if (rec.photos.length >= WANT) continue;
  const q = new URLSearchParams({
    taxon_id: String(rec.inatId), place_id: '6857', quality_grade: 'research', photos: 'true',
    photo_license: 'cc0,cc-by,cc-by-nc', order_by: 'votes', per_page: '30',
  });
  const body = await inat.getJson(`/observations?${q}`);
  const picked = pickPhotos(body.results as InatObservation[], WANT);
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
