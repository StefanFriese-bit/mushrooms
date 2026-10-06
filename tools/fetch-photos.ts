import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { createInatClient } from './lib/inat.ts';
import { pickPhotos, type InatObservation } from './lib/photo-picker.ts';
import type { Photo, SpeciesRecord } from '../src/types.ts';

// For every species record with fewer than six photos (or `--want N`; `--only slug,slug` for a few): the most-faved UK
// research-grade iNaturalist observations with an open licence (topped up from Europe when the UK has too few), up to
// three photos from each — so the strip shows the gills and stem, not only the top (Stefan, 06/10) — saved as 800px
// WebP copies, each credited. A species' old photos are replaced only once its new ones are all in hand.
const ROOT = new URL('../', import.meta.url);
const arg = (name: string) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };
const WANT = Number(arg('--want') ?? 6);
if (!Number.isInteger(WANT) || WANT < 1) throw new Error('--want needs a whole number of photos, 1 or more');
const ONLY = arg('--only')?.split(',');
const PER_SIGHTING = 3;
const UK = '6857';
const EUROPE = '97391';
const inat = createInatClient();
// Sightings never to use (UV light, microscope pictures …), each with a reason: tools/config/photo-skip.json.
const SKIP = new Set((JSON.parse(readFileSync(new URL('tools/config/photo-skip.json', ROOT), 'utf8')) as { skip: Array<{ observation: number }> })
  .skip.map((s) => s.observation));

/** The photo's bytes, asked for up to three times; null when it cannot be had (it is then left out, never half-saved). */
async function download(url: string): Promise<Buffer | null> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) return Buffer.from(await res.arrayBuffer());
      if (res.status === 403 || res.status === 404) return null;
    } catch { /* the network: ask again */ }
    await new Promise((r) => setTimeout(r, 2000 * attempt));
  }
  return null;
}

for (const file of readdirSync(new URL('content/species/', ROOT)).filter((f) => f.endsWith('.json'))) {
  const url = new URL(`content/species/${file}`, ROOT);
  const rec = JSON.parse(readFileSync(url, 'utf8')) as SpeciesRecord;
  if (ONLY ? !ONLY.includes(rec.slug) : rec.photos.length >= WANT) continue;
  const search = async (placeId: string) => {
    const q = new URLSearchParams({
      taxon_id: String(rec.inatId), place_id: placeId, quality_grade: 'research', photos: 'true',
      photo_license: 'cc0,cc-by,cc-by-nc', order_by: 'votes', per_page: '30',
    });
    return ((await inat.getJson(`/observations?${q}`)).results as InatObservation[]).filter((o) => !SKIP.has(o.id));
  };
  const uk = await search(UK);
  const picked = pickPhotos(uk, WANT, PER_SIGHTING);
  // A rare species can have few open-licence UK photos (none for the Fool's Webcap): the rest come from Europe.
  if (picked.length < WANT) {
    const seen = new Set(uk.map((o) => o.id));
    picked.push(...pickPhotos((await search(EUROPE)).filter((o) => !seen.has(o.id)), WANT - picked.length, PER_SIGHTING));
  }
  const ready: Array<{ webp: Buffer; photo: Omit<Photo, 'file'> }> = [];
  for (const p of picked) {
    const bytes = await download(p.largeUrl);
    if (!bytes) { console.log(`${rec.slug}: could not download ${p.largeUrl} — left out`); continue; }
    const webp = await sharp(bytes).resize({ width: 800, withoutEnlargement: true }).webp({ quality: 72 }).toBuffer();
    ready.push({ webp, photo: { view: 'whole', credit: p.credit, licence: p.licence, link: p.link } });
  }
  if (ready.length === 0) { console.log(`${rec.slug}: no photo could be had — its old photos stay`); continue; }
  const dir = new URL(`public/photos/${rec.slug}/`, ROOT);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  rec.photos = ready.map(({ webp, photo }, i) => {
    const out = `photos/${rec.slug}/${i + 1}.webp`;
    writeFileSync(fileURLToPath(new URL(`public/${out}`, ROOT)), webp);
    return { file: out, ...photo };
  });
  writeFileSync(url, JSON.stringify(rec, null, 2) + '\n');
  console.log(`${rec.slug}: ${rec.photos.length} photos`);
}
